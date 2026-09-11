/**
 * Rule validation — the single source of truth shared by YAML config rules
 * (config/loader.ts) and plugin-contributed rules (core/plugins/rules.ts).
 *
 * Core owns this logic; config depends on core, never the reverse
 * (Constitution Article II).
 *
 * Validation is a contract, not a formality (Article VI): an invalid regex or a
 * malformed `patterns` entry must fail here, at config time, naming the rule —
 * never later inside `new RegExp` during an organize run.
 */
import type { Rule } from '../types/index.js';

export function validateRuleCore(rule: unknown): Rule {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Invalid rule: must be an object');
  }

  const raw = rule as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== 'string') {
    throw new Error('Invalid rule: name is required');
  }

  const name = raw.name;

  if (!raw.patterns || !Array.isArray(raw.patterns) || raw.patterns.length === 0) {
    throw new Error(`Invalid rule "${name}": patterns must be a non-empty array`);
  }

  const patterns: string[] = [];
  raw.patterns.forEach((entry: unknown, index: number) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(
        `Invalid rule "${name}": patterns[${index}] must be a non-empty string`
      );
    }
    patterns.push(entry);
  });

  if (!raw.destination || typeof raw.destination !== 'string') {
    throw new Error(`Invalid rule "${name}": destination is required`);
  }

  const validated: Rule = {
    name,
    patterns,
    destination: raw.destination,
  };

  if (raw.priority !== undefined) {
    validated.priority = Number(raw.priority);
  }

  if (raw.enabled !== undefined) {
    validated.enabled = Boolean(raw.enabled);
  }

  if (raw.condition && typeof raw.condition === 'object') {
    validated.condition = validateCondition(
      raw.condition as Record<string, unknown>,
      name
    );
  }

  return validated;
}

function validateCondition(
  condition: Record<string, unknown>,
  ruleName: string
): Rule['condition'] {
  const validTypes = ['regex', 'extension', 'size', 'date'];

  if (!condition.type || !validTypes.includes(condition.type as string)) {
    throw new Error(
      `Invalid rule "${ruleName}": condition type must be one of ${validTypes.join(', ')}`
    );
  }

  const type = condition.type as NonNullable<Rule['condition']>['type'];
  const validated: NonNullable<Rule['condition']> = { type };

  if (type === 'regex' && condition.pattern === undefined) {
    // Matching "everything" is the opposite of what a regex condition promises;
    // RulesEngine.validateRule already documented this as required.
    throw new Error(`Invalid rule "${ruleName}": regex condition requires a pattern`);
  }

  if (condition.pattern !== undefined) {
    const pattern = String(condition.pattern);
    // Compile now so a typo fails here (naming the rule) instead of inside an
    // organize run. Flagless: the runtime flag does not affect compilability.
    try {
      new RegExp(pattern);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Invalid rule "${ruleName}": condition.pattern is not a valid regex: ${reason}`
      );
    }
    validated.pattern = pattern;
  }

  if (condition.extensions !== undefined && Array.isArray(condition.extensions)) {
    validated.extensions = condition.extensions.map(String);
  }

  if (condition.minSize !== undefined) {
    validated.minSize = Number(condition.minSize);
  }

  if (condition.maxSize !== undefined) {
    validated.maxSize = Number(condition.maxSize);
  }

  if (condition.after !== undefined) {
    validated.after = String(condition.after);
  }

  if (condition.before !== undefined) {
    validated.before = String(condition.before);
  }

  return validated;
}
