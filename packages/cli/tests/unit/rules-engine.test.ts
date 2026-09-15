import { describe, it, expect, beforeEach } from 'vitest';
import { RulesEngine } from '../../src/core/rules-engine.js';
import type { FileInfo, Rule } from '../../src/types/index.js';

describe('RulesEngine', () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  const createFile = (name: string, ext: string): FileInfo => ({
    path: `/test/${name}.${ext}`,
    name,
    extension: ext,
    size: 1000,
    createdAt: new Date('2024-03-15'),
    modifiedAt: new Date('2024-03-15'),
    isDirectory: false,
  });

  describe('Pattern matching', () => {
    it('matches extension patterns', () => {
      const rule: Rule = {
        name: 'Images',
        patterns: ['*.jpg', '*.png'],
        destination: './images',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('photo', 'jpg'))).toBeTruthy();
      expect(engine.matchFile(createFile('photo', 'png'))).toBeTruthy();
      expect(engine.matchFile(createFile('doc', 'pdf'))).toBeNull();
    });

    it('matches wildcard pattern', () => {
      const rule: Rule = {
        name: 'All files',
        patterns: ['*'],
        destination: './all',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('anything', 'txt'))).toBeTruthy();
    });

    it('matches partial name patterns', () => {
      const rule: Rule = {
        name: 'Screenshots',
        patterns: ['*screenshot*'],
        destination: './screenshots',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('Screenshot 2024', 'png'))).toBeTruthy();
      expect(engine.matchFile(createFile('my-screenshot', 'jpg'))).toBeTruthy();
      expect(engine.matchFile(createFile('photo', 'jpg'))).toBeNull();
    });

    it('matches composite glob patterns (*.db.backup-*)', () => {
      const rule: Rule = {
        name: 'Db backups',
        patterns: ['*.db.backup-*'],
        destination: './backups',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('engraphis.db.backup-1.5', '5'))).toBeTruthy();
      expect(engine.matchFile(createFile('engraphis.db', 'db'))).toBeNull();
    });
    it('matches a literal pattern with no wildcard', () => {
      const rule: Rule = {
        name: 'Literal',
        patterns: ['screenshot'],
        destination: './literal',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('my-screenshot-2024', 'png'))).toBeTruthy();
      expect(engine.matchFile(createFile('holiday', 'png'))).toBeNull();
    });

    it('matches a composite glob against a file with no extension', () => {
      const rule: Rule = {
        name: 'Composite',
        patterns: ['*.tar.gz'],
        destination: './composite',
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('archive.tar', 'gz'))).toBeTruthy();
      // extension-less file exercises the fullName fallback
      expect(engine.matchFile(createFile('noext', ''))).toBeNull();
    });
  });

  describe('Rule ordering', () => {
    it('sorts rules by priority when passed directly to the constructor', () => {
      const constructed = new RulesEngine([
        { name: 'Low priority', patterns: ['*.jpg'], destination: './low', priority: 0 },
        { name: 'High priority', patterns: ['*.jpg'], destination: './high', priority: 10 },
      ]);

      expect(constructed.getRules().map((r) => r.name)).toEqual([
        'High priority',
        'Low priority',
      ]);
    });

    it('defaults a missing priority to 0 when sorting rules passed to the constructor', () => {
      const constructed = new RulesEngine([
        { name: 'No priority', patterns: ['*.jpg'], destination: './default' },
        { name: 'High priority', patterns: ['*.jpg'], destination: './high', priority: 10 },
      ]);

      expect(constructed.getRules().map((r) => r.name)).toEqual([
        'High priority',
        'No priority',
      ]);
    });

    it('defaults a missing priority to 0 on both sides of the comparator (constructor, 3+ rules)', () => {
      // Three rules force the sort comparator to run with every pairing —
      // regardless of which argument order the engine picks, both the "a"
      // and "b" side of `?? 0` are exercised by at least one comparison.
      const constructed = new RulesEngine([
        { name: 'High priority', patterns: ['*.jpg'], destination: './high', priority: 10 },
        { name: 'No priority A', patterns: ['*.jpg'], destination: './a' },
        { name: 'No priority B', patterns: ['*.jpg'], destination: './b' },
      ]);

      expect(constructed.getRules().map((r) => r.name)).toEqual([
        'High priority',
        'No priority A',
        'No priority B',
      ]);
    });

    it('sorts mixed explicit and default priorities without dropping rules', () => {
      engine.addRule({ name: 'NoPrioA', patterns: ['*.txt'], destination: './a' });
      engine.addRule({ name: 'NoPrioB', patterns: ['*.txt'], destination: './b' });
      engine.addRule({ name: 'High', patterns: ['*.txt'], destination: './c', priority: 10 });
      engine.addRule({ name: 'Zero', patterns: ['*.txt'], destination: './d', priority: 0 });

      expect(engine.getRules().map((r) => r.name)).toEqual([
        'High',
        'NoPrioA',
        'NoPrioB',
        'Zero',
      ]);
    });
  });

  describe('Template warnings', () => {
    it('returns nothing for a template with no tokens', () => {
      expect(engine.getTemplateWarnings('./plain/path')).toEqual([]);
    });
  });

  describe('Priority handling', () => {
    it('applies higher priority rules first', () => {
      const rules: Rule[] = [
        {
          name: 'Low priority',
          patterns: ['*.jpg'],
          destination: './low',
          priority: 0,
        },
        {
          name: 'High priority',
          patterns: ['*.jpg'],
          destination: './high',
          priority: 10,
        },
      ];
      engine.setRules(rules);

      const result = engine.matchFile(createFile('photo', 'jpg'));
      expect(result?.rule.name).toBe('High priority');
    });
  });

  describe('Disabled rules', () => {
    it('skips disabled rules', () => {
      const rule: Rule = {
        name: 'Disabled',
        patterns: ['*.jpg'],
        destination: './disabled',
        enabled: false,
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('photo', 'jpg'))).toBeNull();
    });
  });

  describe('Conditions', () => {
    it('matches regex condition', () => {
      const rule: Rule = {
        name: 'Project files',
        patterns: ['*'],
        destination: './projects/{match1}',
        condition: {
          type: 'regex',
          pattern: '^(project\\d+)-',
        },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('project1-report', 'pdf'))).toBeTruthy();
      expect(engine.matchFile(createFile('random-file', 'txt'))).toBeNull();
    });

    it('matches extension condition', () => {
      const rule: Rule = {
        name: 'Specific extensions',
        patterns: ['*'],
        destination: './specific',
        condition: {
          type: 'extension',
          extensions: ['jpg', 'png'],
        },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('photo', 'jpg'))).toBeTruthy();
      expect(engine.matchFile(createFile('doc', 'pdf'))).toBeNull();
    });

    it('matches size condition', () => {
      const rule: Rule = {
        name: 'Large files',
        patterns: ['*'],
        destination: './large',
        condition: {
          type: 'size',
          minSize: 5000,
        },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('big', 'zip'))).toBeNull();
    });

    it('matches when the file is above minSize', () => {
      const rule: Rule = {
        name: 'Not tiny',
        patterns: ['*'],
        destination: './not-tiny',
        condition: { type: 'size', minSize: 500 },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('file', 'txt'))).toBeTruthy();
    });

    it('honors maxSize in both directions', () => {
      const small: Rule = {
        name: 'Small',
        patterns: ['*'],
        destination: './small',
        condition: { type: 'size', maxSize: 2000 },
      };
      engine.setRules([small]);
      expect(engine.matchFile(createFile('fits', 'txt'))).toBeTruthy();

      const tiny: Rule = {
        name: 'Tiny',
        patterns: ['*'],
        destination: './tiny',
        condition: { type: 'size', maxSize: 500 },
      };
      engine.setRules([tiny]);
      expect(engine.matchFile(createFile('too-big', 'txt'))).toBeNull();
    });

    it('matches a date condition inside the range (inclusive days)', () => {
      const rule: Rule = {
        name: 'March',
        patterns: ['*'],
        destination: './march',
        condition: { type: 'date', after: '2024-03-01', before: '2024-03-31' },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('inside', 'txt'))).toBeTruthy();
    });

    it('rejects a date condition when the file is outside the range', () => {
      const rule: Rule = {
        name: 'Older than March',
        patterns: ['*'],
        destination: './old',
        condition: { type: 'date', before: '2024-01-01' },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('outside', 'txt'))).toBeNull();
    });

    it('fails closed when a date bound is unparseable', () => {
      const rule: Rule = {
        name: 'Bad bound',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'date', after: 'nope' },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('anything', 'txt'))).toBeNull();
    });

    // The two fallbacks below are reachable only through the programmatic API:
    // validateRuleCore rejects both shapes at config time (SPEC-config-integrity).
    it('treats a regex condition with no pattern as matching everything', () => {
      const rule: Rule = {
        name: 'RegexNoPattern',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'regex' },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('anything', 'txt'))).toBeTruthy();
    });

    it('treats an extension condition with no extensions as matching everything', () => {
      const rule: Rule = {
        name: 'ExtNoList',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'extension' },
      };
      engine.setRules([rule]);

      expect(engine.matchFile(createFile('anything', 'txt'))).toBeTruthy();
    });
  });

  describe('Destination variables', () => {
    it('resolves year variable', () => {
      const rule: Rule = {
        name: 'By year',
        patterns: ['*'],
        destination: './{year}',
      };
      engine.setRules([rule]);

      const result = engine.matchFile(createFile('photo', 'jpg'));
      expect(result?.destination).toBe('./2024');
    });

    it('resolves month variable', () => {
      const rule: Rule = {
        name: 'By month',
        patterns: ['*'],
        destination: './{year}/{month}',
      };
      engine.setRules([rule]);

      const result = engine.matchFile(createFile('photo', 'jpg'));
      expect(result?.destination).toBe('./2024/03');
    });

    it('resolves extension variable', () => {
      const rule: Rule = {
        name: 'By extension',
        patterns: ['*'],
        destination: './{type}',
      };
      engine.setRules([rule]);

      const result = engine.matchFile(createFile('photo', 'jpg'));
      expect(result?.destination).toBe('./image');
    });

    it('resolves year-month variable', () => {
      const rule: Rule = {
        name: 'By year-month',
        patterns: ['*'],
        destination: './{year-month}',
      };
      engine.setRules([rule]);

      const result = engine.matchFile(createFile('photo', 'jpg'));
      expect(result?.destination).toBe('./2024-03');
    });

    it('falls back to year-month for an empty {now:} format', () => {
      const resolved = engine.resolveDestination(createFile('photo', 'jpg'), './{now:}');

      expect(resolved).toMatch(/^\.\/\d{4}-\d{2}$/);
    });

    it('substitutes an empty string for a capture group that did not participate', () => {
      const rule: Rule = {
        name: 'Optional group',
        patterns: ['*'],
        destination: './{match2}',
        condition: { type: 'regex', pattern: '^(x)' },
      };

      expect(engine.resolveDestination(createFile('xyz', 'txt'), rule.destination, rule)).toBe(
        './'
      );
    });

    it('leaves {match} literal when the only matching rule is disabled', () => {
      const disabled: Rule = {
        name: 'Disabled',
        patterns: ['*'],
        destination: './x',
        enabled: false,
        condition: { type: 'regex', pattern: '^(a)' },
      };
      engine.setRules([disabled]);

      // No rule argument → the engine re-derives one, and must skip disabled ones.
      expect(engine.resolveDestination(createFile('abc', 'txt'), './{match1}')).toBe(
        './{match1}'
      );
    });
  });

  describe('Rule management', () => {
    it('adds rules', () => {
      const rule: Rule = {
        name: 'New rule',
        patterns: ['*.txt'],
        destination: './text',
      };
      engine.addRule(rule);
      expect(engine.getRules()).toHaveLength(1);
    });

    it('removes rules by name', () => {
      const rule: Rule = {
        name: 'To remove',
        patterns: ['*.txt'],
        destination: './text',
      };
      engine.setRules([rule]);
      expect(engine.removeRule('To remove')).toBe(true);
      expect(engine.getRules()).toHaveLength(0);
    });

    it('returns false when removing non-existent rule', () => {
      expect(engine.removeRule('non-existent')).toBe(false);
    });
  });

  describe('Validation', () => {
    it('validates required fields', () => {
      const errors = engine.validateRule({
        name: '',
        patterns: [],
        destination: '',
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('passes valid rule', () => {
      const errors = engine.validateRule({
        name: 'Valid',
        patterns: ['*.jpg'],
        destination: './images',
      });
      expect(errors).toHaveLength(0);
    });

    it('flags a regex condition without a pattern', () => {
      const errors = engine.validateRule({
        name: 'R',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'regex' },
      });
      expect(errors).toContain('Regex condition requires a pattern');
    });

    it('flags an extension condition without extensions', () => {
      const errors = engine.validateRule({
        name: 'R',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'extension' },
      });
      expect(errors).toContain('Extension condition requires extensions array');
    });

    it('accepts a fully specified condition', () => {
      const errors = engine.validateRule({
        name: 'R',
        patterns: ['*'],
        destination: './x',
        condition: { type: 'regex', pattern: '^a' },
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('Capture groups ({match})', () => {
    const captureRule: Rule = {
      name: 'Projects',
      patterns: ['*'],
      destination: './projects',
      condition: { type: 'regex', pattern: '(project\\d+)' },
    };

    it('derives the capture from the matching rule when none is passed', () => {
      engine.setRules([captureRule]);

      expect(engine.resolveDestination(createFile('project42', 'jpg'), './out/{match1}')).toBe(
        './out/project42'
      );
    });

    it('supports the bare {match} form (whole match)', () => {
      engine.setRules([captureRule]);

      expect(engine.resolveDestination(createFile('project42', 'jpg'), './out/{match}')).toBe(
        './out/project42'
      );
    });

    it('leaves the token literal when no rule matches the file', () => {
      engine.setRules([]);

      expect(engine.resolveDestination(createFile('x', 'jpg'), './out/{match1}')).toBe(
        './out/{match1}'
      );
    });

    it('leaves the token literal when the pattern does not match the name', () => {
      engine.setRules([
        { ...captureRule, condition: { type: 'regex', pattern: '(nomatch\\d+)' } },
      ]);

      expect(engine.resolveDestination(createFile('other', 'jpg'), './out/{match1}')).toBe(
        './out/{match1}'
      );
    });
  });
});
