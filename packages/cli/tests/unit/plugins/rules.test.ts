import { describe, it, expect } from 'vitest';
import { collectPluginRules } from '../../../src/core/plugins/rules.js';
import type { OrganizerPlugin } from '../../../src/core/plugins/contract.js';
import type { Rule } from '../../../src/types/index.js';

describe('collectPluginRules', () => {
  it('AC-7: plugins without customRules are skipped silently', async () => {
    const plugins: OrganizerPlugin[] = [
      { name: 'no-rules', version: '1.0.0' },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules).toEqual([]);
    expect(failures).toEqual([]);
  });

  it('collects valid rules in registration order', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'p1',
        version: '1.0.0',
        customRules: () => [
          { name: 'Rule A', patterns: ['*.a'], destination: './a', priority: 30 },
        ],
      },
      {
        name: 'p2',
        version: '1.0.0',
        customRules: () => [
          { name: 'Rule B', patterns: ['*.b'], destination: './b', priority: 20 },
        ],
      },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules.map((r) => r.name)).toEqual(['Rule A', 'Rule B']);
    expect(failures).toEqual([]);
  });

  it('AC-3: non-array return is captured, other plugins unaffected', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'bad-shape',
        version: '1.0.0',
        customRules: () => ({ name: 'x' }) as unknown as ReturnType<OrganizerPlugin['customRules']>,
      },
      {
        name: 'good',
        version: '1.0.0',
        customRules: () => [{ name: 'Good', patterns: ['*.g'], destination: './g' }],
      },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules.map((r) => r.name)).toEqual(['Good']);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      plugin: 'bad-shape',
      hook: 'customRules',
      error: 'customRules() must return an array of rules',
    });
  });

  it('isolates a throwing customRules per plugin', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'thrower',
        version: '1.0.0',
        customRules(): Rule[] {
          throw new Error('boom');
        },
      },
      {
        name: 'good',
        version: '1.0.0',
        customRules: () => [{ name: 'Good', patterns: ['*.g'], destination: './g' }],
      },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules.map((r) => r.name)).toEqual(['Good']);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toContain('boom');
    expect(failures[0].plugin).toBe('thrower');
  });

  it('per-rule isolation: invalid rule does not sink the plugin\'s other rules', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'mixed',
        version: '1.0.0',
        customRules: () => [
          { name: 'NoDest' }, // invalid: missing patterns + destination
          { name: 'Valid', patterns: ['*.v'], destination: './v' },
        ],
      },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules.map((r) => r.name)).toEqual(['Valid']);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toContain('rule[0]');
  });

  it('captures non-Error throws as strings', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'string-thrower',
        version: '1.0.0',
        customRules(): Rule[] {
          throw 'plain string failure';
        },
      },
    ];

    const { rules, failures } = await collectPluginRules(plugins);

    expect(rules).toEqual([]);
    expect(failures).toEqual([
      { plugin: 'string-thrower', hook: 'customRules', error: 'customRules() threw: plain string failure' },
    ]);
  });
});
