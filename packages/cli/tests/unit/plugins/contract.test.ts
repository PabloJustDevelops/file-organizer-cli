import { describe, it, expect } from 'vitest';
import {
  validatePlugin,
  PluginError,
  PluginTypeError,
  PluginFieldError,
} from '../../../src/core/plugins/contract.js';
import type { OrganizerPlugin } from '../../../src/core/plugins/contract.js';

function validPlugin(): OrganizerPlugin {
  return {
    name: 'my-plugin',
    version: '1.0.0',
    async beforeOrganize() {},
  };
}

describe('plugin contract', () => {
  describe('validatePlugin — valid candidates (V5)', () => {
    it('AC-1: returns the same reference typed as OrganizerPlugin', () => {
      const candidate = validPlugin();
      const result = validatePlugin(candidate);
      expect(result).toBe(candidate);
    });

    it('AC-6: preserves unknown extra properties without rejecting them', () => {
      const candidate = Object.assign(validPlugin(), { extraFlag: 'kept' });
      const result = validatePlugin(candidate);
      expect(result).toBe(candidate);
      expect((result as Record<string, unknown>)['extraFlag']).toBe('kept');
    });

    it('AC-7: accepts a minimal plugin with only name and version', () => {
      const result = validatePlugin({ name: 'minimal', version: '0.2.1' });
      expect(result.name).toBe('minimal');
      expect(result.version).toBe('0.2.1');
    });

    it('accepts semver with prerelease and build metadata', () => {
      expect(() =>
        validatePlugin({ name: 'meta', version: '1.2.3-beta.1+build.7' })
      ).not.toThrow();
    });
  });

  describe('validatePlugin — V1: non-object candidates', () => {
    it.each([null, undefined, 'a string', 42, true])(
      'AC-2: rejects %p with PluginTypeError',
      (candidate) => {
        expect(() => validatePlugin(candidate)).toThrow(PluginTypeError);
      }
    );

    it('AC-2: the error message states what was received', () => {
      expect(() => validatePlugin(null)).toThrow(/must be an object.*null/s);
    });
  });

  describe('validatePlugin — V2: name validation', () => {
    it.each([
      ['missing name', {}],
      ['empty name', { name: '', version: '1.0.0' }],
      ['CamelCase name', { name: 'MyPlugin', version: '1.0.0' }],
      ['name with spaces', { name: 'my plugin', version: '1.0.0' }],
      ['name with underscores', { name: 'my_plugin', version: '1.0.0' }],
      ['non-string name', { name: 7, version: '1.0.0' }],
      ['leading/trailing hyphen', { name: '-plugin-', version: '1.0.0' }],
    ])('AC-3: rejects %s with PluginFieldError on "name"', (_label, candidate) => {
      try {
        validatePlugin(candidate);
        expect.unreachable('expected validatePlugin to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PluginFieldError);
        expect((err as PluginFieldError).field).toBe('name');
      }
    });

    it('accepts single-segment kebab-case names', () => {
      expect(() => validatePlugin({ name: 'plugin', version: '1.0.0' })).not.toThrow();
    });

    it('describes function-valued names as a function type', () => {
      expect(() => validatePlugin({ name: () => 'x', version: '1.0.0' })).toThrow(
        /type function/
      );
    });

    it('describes array-valued fields as an array', () => {
      expect(() =>
        validatePlugin({ name: ['array', 'name'], version: '1.0.0' })
      ).toThrow(/an array/);
    });
  });

  describe('validatePlugin — V3: version validation', () => {
    it.each(['1.0', 'abc', 'v1.0.0', '1.0.0.0', '', 1.0])(
      'AC-4: rejects version %p with PluginFieldError on "version"',
      (version) => {
        const candidate = { name: 'my-plugin', version };
        try {
          validatePlugin(candidate);
          expect.unreachable('expected validatePlugin to throw');
        } catch (err) {
          expect(err).toBeInstanceOf(PluginFieldError);
          expect((err as PluginFieldError).field).toBe('version');
          expect((err as PluginFieldError).pluginName).toBe('my-plugin');
        }
      }
    );
  });

  describe('validatePlugin — V4: optional member types', () => {
    it.each([
      ['beforeOrganize', 'not-a-function'],
      ['afterOrganize', 123],
      ['customRules', true],
      ['transform', {}],
    ])(
      'AC-5: rejects non-function %s with PluginFieldError on that field',
      (field, value) => {
        const candidate = {
          name: 'my-plugin',
          version: '1.0.0',
          [field]: value,
        };
        try {
          validatePlugin(candidate);
          expect.unreachable('expected validatePlugin to throw');
        } catch (err) {
          expect(err).toBeInstanceOf(PluginFieldError);
          expect((err as PluginFieldError).field).toBe(field);
        }
      }
    );

    it('accepts undefined optional members as absent', () => {
      const candidate = { name: 'my-plugin', version: '1.0.0', transform: undefined };
      expect(() => validatePlugin(candidate)).not.toThrow();
    });
  });

  describe('error hierarchy', () => {
    it('AC-8: PluginTypeError is an instance of PluginError', () => {
      try {
        validatePlugin('nope');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(PluginError);
        expect(err).toBeInstanceOf(PluginTypeError);
      }
    });

    it('AC-8: PluginFieldError is an instance of PluginError', () => {
      try {
        validatePlugin({});
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(PluginError);
        expect(err).toBeInstanceOf(PluginFieldError);
      }
    });

    it('error names are set for debugging output', () => {
      try {
        validatePlugin(42);
      } catch (err) {
        expect((err as Error).name).toBe('PluginTypeError');
      }
      try {
        validatePlugin({ version: '1.0.0' });
      } catch (err) {
        expect((err as Error).name).toBe('PluginFieldError');
      }
    });
  });
});
