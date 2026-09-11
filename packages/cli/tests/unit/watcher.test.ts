import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDestinationDirs, buildDestinationIgnores } from '../../src/core/watcher.js';
import { parseDebounce } from '../../src/cli/commands/watch.js';
import type { Rule } from '../../src/types/index.js';

describe('buildDestinationIgnores', () => {
  it('AC-5: derives globs from the first static segment of each destination', () => {
    const rules: Rule[] = [
      { name: 'Photos', patterns: ['*.jpg'], destination: './photos/{year}' },
      { name: 'Docs', patterns: ['*.pdf'], destination: './documents' },
      { name: 'External', patterns: ['*'], destination: '/mnt/external/archive' },
    ];

    expect(buildDestinationIgnores(rules)).toEqual(['**/photos/**', '**/documents/**']);
  });

  it('AC-5: deduplicates segments shared by several rules', () => {
    const rules: Rule[] = [
      { name: 'A', patterns: ['*.a'], destination: './media/a' },
      { name: 'B', patterns: ['*.b'], destination: './media/b' },
    ];

    expect(buildDestinationIgnores(rules)).toEqual(['**/media/**']);
  });
});

describe('buildDestinationDirs', () => {
  it('AC-5: resolves static destination prefixes, skipping templated and absolute roots', () => {
    const rules: Rule[] = [
      { name: 'Photos', patterns: ['*.jpg'], destination: './photos/{year}' },
      { name: 'Nested', patterns: ['*.a'], destination: './a/b/{x}' },
      { name: 'Templated', patterns: ['*'], destination: './{year}' },
      { name: 'External', patterns: ['*'], destination: '/mnt/external' },
    ];

    expect(buildDestinationDirs(rules, '/source')).toEqual([
      path.resolve('/source', 'photos'),
      path.resolve('/source', 'a', 'b'),
    ]);
  });
});

describe('parseDebounce', () => {
  it('AC-7: accepts positive integers', () => {
    expect(parseDebounce('2500')).toBe(2500);
    expect(parseDebounce('1')).toBe(1);
  });

  it('AC-7: rejects zero, negatives, non-numeric and non-integer values', () => {
    for (const value of ['abc', '0', '-5', '2.5', '']) {
      expect(() => parseDebounce(value)).toThrow();
    }
  });
});
