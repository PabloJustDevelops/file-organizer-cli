/**
 * Rule validation — the single source of truth shared by YAML config rules
 * (config/loader.ts) and plugin-contributed rules (core/plugins/rules.ts).
 *
 * Core owns this logic; config depends on core, never the reverse
 * (Constitution Article II).
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

  if (!raw.patterns || !Array.isArray(raw.patterns) || raw.patterns.length === 0) {
    throw new Error(`Invalid rule "${raw.name}": patterns must be a non-empty array`);
  }

  if (!raw.destination || typeof raw.destination !== 'string') {
    throw new Error(`Invalid rule "${raw.name}": destination is required`);
  }

  const validated: Rule = {
    name: raw.name,
    patterns: raw.patterns as string[],
    destination: raw.destination as string,
  };

  if (raw.priority !== undefined) {
    validated.priority = Number(raw.priority);
  }

  if (raw.enabled !== undefined) {
    validated.enabled = Boolean(raw.enabled);
  }

  if (raw.condition && typeof raw.condition === 'object') {
    validated.condition = validateCondition(raw.condition as Record<string, unknown>);
  }

  return validated;
}

function validateCondition(condition: Record<string, unknown>): Rule['condition'] {
  const validTypes = ['regex', 'extension', 'size', 'date'];

  if (!condition.type || !validTypes.includes(condition.type as string)) {
    throw new Error(`Invalid condition type: must be one of ${validTypes.join(', ')}`);
  }

  const validated: NonNullable<Rule['condition']> = {
    type: condition.type as NonNullable<Rule['condition']>['type'],
  };

  if (condition.pattern !== undefined) {
    validated.pattern = String(condition.pattern);
  }

  if (condition.match !== undefined) {
    validated.match = String(condition.match);
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
