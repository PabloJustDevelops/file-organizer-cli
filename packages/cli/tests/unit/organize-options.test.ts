import { describe, expect, it } from 'vitest';
import { buildOrganizeOptions } from '../../src/core/organize-options.js';
import type { OrganizeConfig } from '../../src/types/index.js';

const base: OrganizeConfig = { rules: [] };

describe('buildOrganizeOptions (SPEC-mcp-surface AC-11)', () => {
  it('applies the built-in defaults when config is silent', () => {
    expect(buildOrganizeOptions(base)).toMatchObject({
      dryRun: false,
      recursive: false,
      includeHidden: false,
      conflictResolution: 'rename',
    });
  });

  it('config values win over the defaults', () => {
    const options = buildOrganizeOptions({
      ...base,
      dryRun: true,
      recursive: true,
      includeHidden: true,
      conflictResolution: 'skip',
    });

    expect(options).toMatchObject({
      dryRun: true,
      recursive: true,
      includeHidden: true,
      conflictResolution: 'skip',
    });
  });

  it('explicit overrides win over config', () => {
    const options = buildOrganizeOptions(
      { ...base, recursive: true, dryRun: true },
      { recursive: false, dryRun: false }
    );

    expect(options).toMatchObject({ recursive: false, dryRun: false });
  });

  it('carries the config so the core reads rules/locale/sizeBuckets/plugins', () => {
    const config: OrganizeConfig = {
      rules: [],
      locale: 'es-ES',
      sizeBuckets: { small: 10 },
    };

    expect(buildOrganizeOptions(config).config).toBe(config);
  });

  it('passes pluginBaseDir only when provided', () => {
    expect(buildOrganizeOptions(base).pluginBaseDir).toBeUndefined();
    expect(buildOrganizeOptions(base, { pluginBaseDir: '/tmp/plugins' }).pluginBaseDir).toBe(
      '/tmp/plugins'
    );
  });
});
