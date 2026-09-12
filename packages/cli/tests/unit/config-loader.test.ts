import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { validateAndNormalizeConfig, DEFAULT_CONFIG } from '../../src/config/loader.js';
import { getExampleConfig, CONFIG_SCHEMA } from '../../src/config/schema.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('Config Loader', () => {
  describe('validateAndNormalizeConfig', () => {
    it('validates minimal config', () => {
      const config = validateAndNormalizeConfig({
        rules: [
          {
            name: 'Images',
            patterns: ['*.jpg'],
            destination: './images',
          },
        ],
      });

      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe('Images');
    });

    it('throws on invalid config', () => {
      expect(() => validateAndNormalizeConfig(null)).toThrow();
      expect(() => validateAndNormalizeConfig({})).not.toThrow();
    });

    it('normalizes conflict resolution', () => {
      const config = validateAndNormalizeConfig({
        rules: [],
        conflictResolution: 'invalid',
      });

      expect(config.conflictResolution).toBe('rename');
    });

    it('accepts valid conflict resolution', () => {
      const config = validateAndNormalizeConfig({
        rules: [],
        conflictResolution: 'overwrite',
      });

      expect(config.conflictResolution).toBe('overwrite');
    });

    it('validates rule patterns', () => {
      expect(() =>
        validateAndNormalizeConfig({
          rules: [
            {
              name: 'Invalid',
              patterns: [],
              destination: './test',
            },
          ],
        })
      ).toThrow();
    });

    it('validates rule destination', () => {
      expect(() =>
        validateAndNormalizeConfig({
          rules: [
            {
              name: 'Invalid',
              patterns: ['*.jpg'],
              destination: '',
            },
          ],
        })
      ).toThrow();
    });

    it('handles optional fields', () => {
      const config = validateAndNormalizeConfig({
        rules: [
          {
            name: 'With options',
            patterns: ['*.jpg'],
            destination: './images',
            priority: 10,
            enabled: false,
          },
        ],
      });

      expect(config.rules[0].priority).toBe(10);
      expect(config.rules[0].enabled).toBe(false);
    });

    it('validates condition types', () => {
      expect(() =>
        validateAndNormalizeConfig({
          rules: [
            {
              name: 'Bad condition',
              patterns: ['*'],
              destination: './test',
              condition: {
                type: 'invalid',
              },
            },
          ],
        })
      ).toThrow();
    });

    it('accepts valid conditions', () => {
      const config = validateAndNormalizeConfig({
        rules: [
          {
            name: 'With condition',
            patterns: ['*'],
            destination: './test',
            condition: {
              type: 'regex',
              pattern: '^test-',
            },
          },
        ],
      });

      expect(config.rules[0].condition?.type).toBe('regex');
    });

    it('accepts a valid locale', () => {
      const config = validateAndNormalizeConfig({
        rules: [],
        locale: 'es-ES',
      });
      expect(config.locale).toBe('es-ES');
    });

    it('rejects an invalid locale', () => {
      expect(() =>
        validateAndNormalizeConfig({ rules: [], locale: 123 })
      ).toThrow('locale must be a non-empty string');
    });
  });

  describe('plugins field (SPEC-config-plugins C1–C3)', () => {
    it('AC-1: absent plugins stays undefined', () => {
      const config = validateAndNormalizeConfig({ rules: [] });
      expect(config.plugins).toBeUndefined();
    });

    it('AC-2: valid plugins array is normalized as-is', () => {
      const config = validateAndNormalizeConfig({
        rules: [],
        plugins: ['./my-plugin.js', 'file-organizer-compress'],
      });
      expect(config.plugins).toEqual(['./my-plugin.js', 'file-organizer-compress']);
    });

    it('AC-3: non-array plugins throws', () => {
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: 'x' })
      ).toThrow('Invalid config: plugins must be an array of strings');
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: {} })
      ).toThrow('Invalid config: plugins must be an array of strings');
    });

    it('AC-4: empty and non-string entries throw with the offending index', () => {
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: [''] })
      ).toThrow('Invalid config: plugins[0] must be a non-empty string');
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: ['./ok.js', 42] })
      ).toThrow('Invalid config: plugins[1] must be a non-empty string');
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: ['./ok.js', null] })
      ).toThrow('Invalid config: plugins[1] must be a non-empty string');
    });

    it('AC-5: duplicates throw naming the spec and index', () => {
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: ['./a.js', './a.js'] })
      ).toThrow('Invalid config: plugins[1] duplicates "./a.js"');
      expect(() =>
        validateAndNormalizeConfig({ rules: [], plugins: ['a', 'b', 'a'] })
      ).toThrow('Invalid config: plugins[2] duplicates "a"');
    });

    it('accepts an empty plugins array (no plugins configured)', () => {
      const config = validateAndNormalizeConfig({ rules: [], plugins: [] });
      expect(config.plugins).toEqual([]);
    });
  });

  describe('SPEC-config-integrity: content validated at config time', () => {
    const withCondition = (condition: unknown) =>
      validateAndNormalizeConfig({
        rules: [{ name: 'Bad', patterns: ['*'], destination: './x', condition }],
      });

    it('AC-1: rejects an invalid regex and names the rule', () => {
      expect(() => withCondition({ type: 'regex', pattern: '([' })).toThrow(
        /Invalid rule "Bad": condition\.pattern is not a valid regex/
      );
    });

    it('AC-2: keeps a valid regex untouched', () => {
      const config = withCondition({ type: 'regex', pattern: '^(project\\d+)-' });
      expect(config.rules[0].condition?.pattern).toBe('^(project\\d+)-');
    });

    it('AC-3: a regex condition without a pattern is an error', () => {
      expect(() => withCondition({ type: 'regex' })).toThrow(
        'Invalid rule "Bad": regex condition requires a pattern'
      );
    });

    it('AC-4: only regex requires a pattern (size without it is fine)', () => {
      expect(() => withCondition({ type: 'size', minSize: 10 })).not.toThrow();
    });

    it('AC-5: non-string / empty patterns[] entries are rejected with the index', () => {
      for (const bad of [[42], [''], [null], ['  ']]) {
        expect(() =>
          validateAndNormalizeConfig({
            rules: [{ name: 'Bad', patterns: bad, destination: './x' }],
          })
        ).toThrow('Invalid rule "Bad": patterns[0] must be a non-empty string');
      }
    });

    it('AC-6: valid patterns are preserved', () => {
      const config = validateAndNormalizeConfig({
        rules: [{ name: 'Ok', patterns: ['*.jpg', '*.png'], destination: './x' }],
      });
      expect(config.rules[0].patterns).toEqual(['*.jpg', '*.png']);
    });

    it('AC-7/AC-8: recursive defaults to false and is honored when true', () => {
      expect(validateAndNormalizeConfig({ rules: [] }).recursive).toBe(false);
      expect(
        validateAndNormalizeConfig({ rules: [], recursive: true }).recursive
      ).toBe(true);
    });

    it('AC-9: the example config agrees with the loader default', () => {
      expect(getExampleConfig().recursive).toBe(false);
    });

    it('rejects a structurally invalid locale tag (Intl throws)', () => {
      expect(() => validateAndNormalizeConfig({ rules: [], locale: 'en_US' })).toThrow(
        'is not a valid BCP-47 locale tag'
      );
    });

    it('rejects non-positive sizeBuckets values', () => {
      for (const bad of [0, -1, 'abc']) {
        expect(() =>
          validateAndNormalizeConfig({ rules: [], sizeBuckets: { small: bad } })
        ).toThrow('sizeBuckets.small must be a positive number of bytes');
      }
    });

    it('keeps only the sizeBuckets keys that were provided', () => {
      const config = validateAndNormalizeConfig({
        rules: [],
        sizeBuckets: { medium: 2048 },
      });
      expect(config.sizeBuckets).toEqual({ medium: 2048 });
    });

    it('AC-10: the dead condition.match field is gone from the schema', () => {
      const condition = CONFIG_SCHEMA.definitions.condition as {
        properties: Record<string, unknown>;
      };
      expect(condition.properties).not.toHaveProperty('match');
    });

    it('AC-16: every shipped config example validates', () => {
      const dir = path.join(repoRoot, 'config-examples');
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const raw = yaml.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
        expect(
          () => validateAndNormalizeConfig(raw),
          `config-examples/${file} does not validate`
        ).not.toThrow();
      }
    });

    it('AC-16: the generated example config validates too', () => {
      expect(() => validateAndNormalizeConfig(getExampleConfig())).not.toThrow();
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_CONFIG.historySize).toBe(50);
      expect(DEFAULT_CONFIG.conflictResolution).toBe('rename');
      expect(DEFAULT_CONFIG.logLevel).toBe('info');
      expect(DEFAULT_CONFIG.defaultRules).toEqual([]);
    });
  });
});
