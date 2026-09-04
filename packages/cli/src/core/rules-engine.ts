import path from 'path';
import type { FileInfo, Rule, RuleCondition } from '../types/index.js';
// path is used for {parent} resolution (path.basename/dirname)
import { getFileType } from '../utils/file-utils.js';
import { getDateValue, isDateInRange } from '../utils/date-utils.js';

export interface MatchResult {
  rule: Rule;
  destination: string;
}

export class RulesEngine {
  private rules: Rule[];
  private locale?: string;
  private sizeBuckets?: { small?: number; medium?: number; large?: number };

  constructor(rules: Rule[] = []) {
    // Copy before sorting: `sort()` mutates in place, and storing the
    // caller's array by reference let addRule()/removeRule() leak engine
    // state back into shared config rule arrays.
    this.rules = [...rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  setRules(rules: Rule[]): void {
    this.rules = [...rules].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  getRules(): Rule[] {
    return [...this.rules];
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  removeRule(name: string): boolean {
    const index = this.rules.findIndex((r) => r.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /** Whether a rule with this exact name is currently loaded. */
  hasRule(name: string): boolean {
    return this.rules.some((r) => r.name === name);
  }

  matchFile(file: FileInfo): MatchResult | null {
    for (const rule of this.rules) {
      if (rule.enabled === false) continue;

      if (this.matchesRule(file, rule)) {
        const destination = this.resolveDestination(file, rule.destination, rule);
        return { rule, destination };
      }
    }
    return null;
  }

  /**
   * Placeholder tokens found in a template that this engine does not provide.
   * Used to warn users about typos like {quartal} before files land in
   * folders literally named "{quartal}".
   */
  getTemplateWarnings(template: string): string[] {
    const known = new Set([
      'year', 'month', 'monthname', 'day', 'year-month', 'yearmonth',
      'extension', 'name', 'type', 'parent', 'sizebucket',
    ]);
    const warnings: string[] = [];
    const tokens = template.match(/\{[^{}]+\}/g) ?? [];
    for (const token of tokens) {
      const key = token.slice(1, -1).toLowerCase();
      const isNow = key.startsWith('now:');
      const isMatch = /^match\d?$/.test(key);
      if (!known.has(key) && !isNow && !isMatch) {
        warnings.push(token);
      }
    }
    return warnings;
  }

  matchFiles(files: FileInfo[]): Map<FileInfo, MatchResult> {
    const results = new Map<FileInfo, MatchResult>();

    for (const file of files) {
      const match = this.matchFile(file);
      if (match) {
        results.set(file, match);
      }
    }

    return results;
  }

  private matchesRule(file: FileInfo, rule: Rule): boolean {
    const patternMatch = this.matchesPatterns(file, rule.patterns);
    if (!patternMatch) return false;

    if (rule.condition) {
      return this.matchesCondition(file, rule.condition);
    }

    return true;
  }

  private matchesPatterns(file: FileInfo, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === '*') return true;

      // Fast path: plain extension globs like "*.jpg". Composite patterns
      // ("*.tar.gz", "*.db.backup-*") must fall through to the generic glob
      // handling below — they span name AND extension.
      if (pattern.startsWith('*.') && !pattern.slice(2).includes('.') && !pattern.slice(2).includes('*')) {
        const ext = pattern.slice(2).toLowerCase();
        return file.extension === ext;
      }

      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*') + '$',
          'i'
        );
        // Composite globs like "*.tar.gz" span name AND extension, so test
        // the full filename too — name alone can never match them.
        const fullName = file.extension ? `${file.name}.${file.extension}` : file.name;
        return (
          regex.test(file.name) ||
          regex.test(file.name + '.' + file.extension) ||
          regex.test(fullName)
        );
      }

      return file.name.toLowerCase().includes(pattern.toLowerCase());
    });
  }

  private matchesCondition(file: FileInfo, condition: RuleCondition): boolean {
    switch (condition.type) {
      case 'regex': {
        if (!condition.pattern) return true;
        const regex = new RegExp(condition.pattern, 'i');
        return regex.test(file.name) || regex.test(file.path);
      }

      case 'extension': {
        if (!condition.extensions || condition.extensions.length === 0) return true;
        return condition.extensions.some(
          (ext) => ext.toLowerCase() === file.extension
        );
      }

      case 'size': {
        if (condition.minSize && file.size < condition.minSize) return false;
        if (condition.maxSize && file.size > condition.maxSize) return false;
        return true;
      }

      case 'date': {
        return isDateInRange(file.modifiedAt, condition.after, condition.before);
      }

      default:
        return true;
    }
  }

  /**
   * Resolve destination template variables for a file.
   * Placeholders are case-insensitive ({YEAR} works like {year}).
   * Supported: {year} {month} {monthName} {day} {year-month}/{yearMonth}
   * {extension} {name} {type} {parent} {sizeBucket} {now:<date-utils format>}
   * {match} / {match1}... (regex capture groups from the rule condition)
   */
  resolveDestination(file: FileInfo, template: string, rule?: Rule): string {
    const locale = this.locale ?? 'en-US';
    const now = new Date();
    const yearMonth = getDateValue(file.modifiedAt, 'year-month', locale);

    // lowercased lookup — resolution is case-insensitive
    const variables: Record<string, string> = {
      year: getDateValue(file.modifiedAt, 'year', locale),
      month: getDateValue(file.modifiedAt, 'month', locale),
      monthname: getDateValue(file.modifiedAt, 'monthName', locale),
      day: getDateValue(file.modifiedAt, 'day', locale),
      'year-month': yearMonth,
      yearmonth: yearMonth,
      extension: file.extension,
      name: file.name,
      type: getFileType(file.extension),
      parent: path.basename(path.dirname(file.path)),
      sizebucket: this.getSizeBucket(file.size),
    };

    let resolved = template;

    // Replace every {token}: known variables by lookup, {now:...} via
    // date-utils formats evaluated against run time. Unknown tokens are left
    // as-is — getTemplateWarnings surfaces them to the user instead.
    resolved = resolved.replace(/\{([^{}]+)\}/g, (token, rawKey: string) => {
      const key = rawKey.toLowerCase();
      if (key in variables) return variables[key];
      if (key.startsWith('now:')) {
        const fmt = key.slice(4).trim() || 'year-month';
        return getDateValue(now, fmt, locale);
      }
      return token; // unknown — leave literal, warned elsewhere
    });

    const regexMatch = template.match(/\{match(\d)?\}/i);
    if (regexMatch) {
      // Use the rule that actually matched — re-deriving by pattern alone can
      // pick a different rule than the one that won the match.
      const condition = rule?.condition ?? this.getRuleForFile(file)?.condition;
      if (condition?.pattern) {
        const match = file.name.match(new RegExp(condition.pattern));
        if (match) {
          const groupIndex = regexMatch[1] ? parseInt(regexMatch[1]) : 0;
          resolved = resolved.replace(
            regexMatch[0],
            match[groupIndex] || ''
          );
        }
      }
    }

    return resolved;
  }

  private getSizeBucket(size: number): string {
    const KB = 1024;
    const MB = 1024 * 1024;
    const small = this.sizeBuckets?.small ?? 100 * KB;
    const medium = this.sizeBuckets?.medium ?? MB;
    const large = this.sizeBuckets?.large ?? 100 * MB;
    if (size < KB) return 'tiny';
    if (size < small) return 'small';
    if (size < medium) return 'medium';
    if (size < large) return 'large';
    return 'huge';
  }

  setLocale(locale: string | undefined): void {
    this.locale = locale;
  }

  setSizeBuckets(buckets: { small?: number; medium?: number; large?: number } | undefined): void {
    this.sizeBuckets = buckets;
  }

  private getRuleForFile(file: FileInfo): Rule | undefined {
    return this.rules.find((rule) => {
      if (rule.enabled === false) return false;

      return this.matchesPatterns(file, rule.patterns);
    });
  }

  validateRule(rule: Rule): string[] {
    const errors: string[] = [];

    if (!rule.name) {
      errors.push('Rule name is required');
    }

    if (!rule.patterns || rule.patterns.length === 0) {
      errors.push('At least one pattern is required');
    }

    if (!rule.destination) {
      errors.push('Destination is required');
    }

    if (rule.condition) {
      if (rule.condition.type === 'regex' && !rule.condition.pattern) {
        errors.push('Regex condition requires a pattern');
      }
      if (rule.condition.type === 'extension' && !rule.condition.extensions) {
        errors.push('Extension condition requires extensions array');
      }
    }

    return errors;
  }
}
