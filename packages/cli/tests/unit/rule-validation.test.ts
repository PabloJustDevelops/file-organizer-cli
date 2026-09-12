import { describe, expect, it } from 'vitest';
import { validateRuleCore } from '../../src/core/rule-validation.js';

/**
 * `validateRuleCore` is the single validation point for YAML rules and
 * plugin-contributed rules. These cases cover every condition shape so the
 * branch that builds each field is exercised.
 */
describe('validateRuleCore (SPEC-config-integrity)', () => {
  const base = { name: 'R', patterns: ['*.jpg'], destination: './x' };

  it('keeps priority and enabled when present', () => {
    const rule = validateRuleCore({ ...base, priority: 10, enabled: false });
    expect(rule.priority).toBe(10);
    expect(rule.enabled).toBe(false);
  });

  it('omits priority/enabled when absent', () => {
    const rule = validateRuleCore(base);
    expect('priority' in rule).toBe(false);
    expect('enabled' in rule).toBe(false);
  });

  it('rejects a non-object, a missing name, and a missing destination', () => {
    expect(() => validateRuleCore(null)).toThrow('must be an object');
    expect(() => validateRuleCore({ patterns: ['*'], destination: './x' })).toThrow(
      'name is required'
    );
    expect(() => validateRuleCore({ name: 'R', patterns: ['*'] })).toThrow(
      'destination is required'
    );
  });

  it('accepts an extension condition and maps its extensions to strings', () => {
    const rule = validateRuleCore({
      ...base,
      condition: { type: 'extension', extensions: ['jpg', 'png'] },
    });
    expect(rule.condition).toEqual({ type: 'extension', extensions: ['jpg', 'png'] });
  });

  it('ignores a non-array extensions value', () => {
    const rule = validateRuleCore({
      ...base,
      condition: { type: 'extension', extensions: 'jpg' },
    });
    expect(rule.condition?.extensions).toBeUndefined();
  });

  it('accepts a size condition with both bounds', () => {
    const rule = validateRuleCore({
      ...base,
      condition: { type: 'size', minSize: 10, maxSize: 20 },
    });
    expect(rule.condition).toEqual({ type: 'size', minSize: 10, maxSize: 20 });
  });

  it('accepts a date condition with after and before', () => {
    const rule = validateRuleCore({
      ...base,
      condition: { type: 'date', after: '2024-01-01', before: '2024-12-31' },
    });
    expect(rule.condition).toEqual({
      type: 'date',
      after: '2024-01-01',
      before: '2024-12-31',
    });
  });

  it('rejects an unknown condition type', () => {
    expect(() => validateRuleCore({ ...base, condition: { type: 'nope' } })).toThrow(
      'condition type must be one of'
    );
  });

  it('rejects a condition with no type', () => {
    expect(() => validateRuleCore({ ...base, condition: {} })).toThrow(
      'condition type must be one of'
    );
  });
});
