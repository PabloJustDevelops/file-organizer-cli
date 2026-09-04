import { describe, it, expect } from 'vitest';
import { validateAndNormalizeConfig, DEFAULT_CONFIG } from '../../src/config/loader.js';

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

  describe('DEFAULT_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_CONFIG.historySize).toBe(50);
      expect(DEFAULT_CONFIG.conflictResolution).toBe('rename');
      expect(DEFAULT_CONFIG.logLevel).toBe('info');
      expect(DEFAULT_CONFIG.defaultRules).toEqual([]);
    });
  });
});
