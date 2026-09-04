import { describe, it, expect } from 'vitest';
import { RulesEngine } from '../../src/core/rules-engine.js';
import type { FileInfo, Rule } from '../../src/types/index.js';

describe('Template variables', () => {
  const makeEngine = (rules: Rule[], locale?: string) => {
    const engine = new RulesEngine();
    engine.setRules(rules);
    engine.setLocale(locale);
    return engine;
  };

  const file = (over: Partial<FileInfo> = {}): FileInfo => ({
    path: '/test/2024/invoice.pdf',
    name: 'invoice',
    extension: 'pdf',
    size: 500 * 1024, // 500 KB → medium
    createdAt: new Date('2024-03-15T10:00:00'),
    modifiedAt: new Date('2024-03-15T10:00:00'),
    isDirectory: false,
    ...over,
  });

  const resolve = (rules: Rule[], f: FileInfo, locale?: string) => {
    const engine = makeEngine(rules, locale);
    return engine.matchFile(f)?.destination;
  };

  describe('case-insensitive placeholders', () => {
    it('resolves {YEAR}, {Month}, {MONTHNAME} like lowercase', () => {
      const rules: Rule[] = [
        { name: 'X', patterns: ['*'], destination: './{YEAR}/{Month}/{MONTHNAME}' },
      ];
      expect(resolve(rules, file())).toBe('./2024/03/march');
    });
  });

  describe('{parent} variable', () => {
    it('resolves to the source subfolder name', () => {
      const rules: Rule[] = [
        { name: 'X', patterns: ['*'], destination: './out/{parent}' },
      ];
      expect(resolve(rules, file())).toBe('./out/2024');
    });
  });

  describe('{sizeBucket} variable', () => {
    const rule: Rule[] = [
      { name: 'X', patterns: ['*'], destination: './{sizeBucket}' },
    ];

    it('buckets by size', () => {
      expect(resolve(rule, file({ size: 500 }))).toBe('./tiny');          // < 1 KB
      expect(resolve(rule, file({ size: 50 * 1024 }))).toBe('./small');   // < 100 KB
      expect(resolve(rule, file({ size: 500 * 1024 }))).toBe('./medium'); // < 1 MB
      expect(resolve(rule, file({ size: 50 * 1024 * 1024 }))).toBe('./large');   // < 100 MB
      expect(resolve(rule, file({ size: 500 * 1024 * 1024 }))).toBe('./huge');   // ≥ 100 MB
    });
  });

  describe('{now:fmt} variable', () => {
    it('uses run time, not file time', () => {
      const rules: Rule[] = [
        { name: 'X', patterns: ['*'], destination: './inbox/{now:year-month}' },
      ];
      const resolved = resolve(rules, file())!;
      const expected = `./inbox/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      expect(resolved).toBe(expected);
    });

    it('supports year, month, day formats', () => {
      const rules: Rule[] = [
        { name: 'X', patterns: ['*'], destination: '{now:year}-{now:month}-{now:day}' },
      ];
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(resolve(rules, file())).toBe(expected);
    });
  });

  describe('locale support', () => {
    const rules: Rule[] = [
      { name: 'X', patterns: ['*'], destination: './{monthName}' },
    ];

    it('defaults to English month names', () => {
      expect(resolve(rules, file())).toBe('./march');
    });

    it('resolves Spanish month names with es-ES', () => {
      expect(resolve(rules, file(), 'es-ES')).toBe('./marzo');
    });

    it('resolves German month names with de-DE', () => {
      expect(resolve(rules, file(), 'de-DE')).toBe('./märz');
    });
  });

  describe('unknown placeholders', () => {
    it('getTemplateWarnings lists unknown tokens', () => {
      const engine = new RulesEngine();
      expect(engine.getTemplateWarnings('./out/{quartal}/{year}')).toEqual(['{quartal}']);
      expect(engine.getTemplateWarnings('./out/{YEAR}/{now:year}')).toEqual([]);
      expect(engine.getTemplateWarnings('./{match1}/{type}')).toEqual([]);
    });

    it('leaves unknown tokens literal in the path (and warns)', () => {
      const rules: Rule[] = [
        { name: 'X', patterns: ['*'], destination: './{quartal}' },
      ];
      const engine = makeEngine(rules);
      expect(engine.getTemplateWarnings('./{quartal}')).toEqual(['{quartal}']);
      // literal preserved — no silent wrong substitution
      expect(engine.matchFile(file())?.destination).toBe('./{quartal}');
    });
  });
});
