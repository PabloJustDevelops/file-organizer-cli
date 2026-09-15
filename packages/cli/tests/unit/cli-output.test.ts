import { describe, expect, it } from 'vitest';
import {
  fail,
  printJson,
  printOrganizeResult,
  printRules,
  printHistory,
  printConfig,
  printWelcome,
  printFileStats,
} from '../../src/cli/ui/output.js';
import { cliTestContext } from './cli-harness.js';
import type { OrganizeResult, Rule, UndoEntry } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-2: `src/cli/ui/output.ts` at 100%. These are the
 * adapter's observable surfaces — the exit code `fail()` sets, the stdout
 * channel `--json` owns, and the human reports.
 */
const ctx = cliTestContext('output');

describe('fail()', () => {
  it('reports to stderr and sets exitCode 1 without touching stdout', () => {
    fail('something broke');

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('something broke');
    expect(ctx.stdout).toBe('');
  });

  it('in JSON mode also writes an { error } payload to stdout', () => {
    fail('something broke', true);

    expect(process.exitCode).toBe(1);
    expect(JSON.parse(ctx.stdout)).toEqual({ error: 'something broke' });
  });
});

describe('printJson()', () => {
  it('writes pretty JSON to stdout and nothing to the console', () => {
    printJson({ rules: [{ name: 'Images' }] });

    expect(JSON.parse(ctx.stdout)).toEqual({ rules: [{ name: 'Images' }] });
    expect(ctx.captured.log).toHaveLength(0);
  });
});

describe('printOrganizeResult()', () => {
  const full: OrganizeResult = {
    moved: [{ from: '/src/a.jpg', to: '/dest/a.jpg', rule: 'Images' }],
    skipped: [{ file: '/src/b.jpg', reason: 'already exists' }],
    errors: [{ file: '/src/c.jpg', error: 'permission denied' }],
  };

  it('marks a dry run and lists moved, skipped and errored files', () => {
    printOrganizeResult(full, true);

    const text = ctx.text();
    expect(text).toContain('[DRY RUN]');
    expect(text).toContain('Files to move: 1');
    expect(text).toContain('Images');
    expect(text).toContain('already exists');
    expect(text).toContain('permission denied');
    expect(text).toContain('1 skipped');
    expect(text).toContain('1 errors');
  });

  it('reports a real run, lists the moved files and omits empty sections', () => {
    printOrganizeResult({ moved: full.moved, skipped: [], errors: [] });

    const text = ctx.text();
    expect(text).not.toContain('[DRY RUN]');
    expect(text).toContain('Files moved: 1');
    expect(text).not.toContain('Skipped:');
    expect(text).not.toContain('Errors:');
  });

  it('reports an empty result with a zero summary', () => {
    printOrganizeResult({ moved: [], skipped: [], errors: [] });

    expect(ctx.text()).toContain('0 moved');
  });
});

describe('printRules()', () => {
  it('reports an empty rule set', () => {
    printRules([]);

    expect(ctx.text()).toContain('No rules configured.');
  });

  it('renders status, priority and condition when present', () => {
    const rules: Rule[] = [
      {
        name: 'Images',
        patterns: ['*.jpg', '*.png'],
        destination: './images',
        priority: 5,
        condition: { type: 'extension', extensions: ['jpg'] },
      },
      { name: 'Disabled', patterns: ['*'], destination: './other', enabled: false },
    ];

    printRules(rules);

    const text = ctx.text();
    expect(text).toContain('Images');
    expect(text).toContain('[p:5]');
    expect(text).toContain('Condition:');
    expect(text).toContain('*.jpg, *.png');
    expect(text).toContain('Disabled');
  });
});

describe('printHistory()', () => {
  it('reports an empty history', () => {
    printHistory([]);

    expect(ctx.text()).toContain('No operations in history.');
  });

  it('numbers each recorded operation', () => {
    const history: UndoEntry[] = [
      {
        id: '12345678-abcd-ef01-2345-6789abcdef01',
        timestamp: new Date('2026-01-02T03:04:05Z'),
        operations: [{ from: '/a/x.jpg', to: '/b/x.jpg', rule: 'Images' }],
      },
      {
        id: 'abcdef01-2345-6789-abcd-ef0123456789',
        timestamp: new Date('2026-01-03T03:04:05Z'),
        operations: [],
      },
    ];

    printHistory(history);

    const text = ctx.text();
    expect(text).toContain('Operation History:');
    expect(text).toContain('12345678');
    expect(text).toContain('2.');
  });
});

describe('printConfig(), printWelcome() and printFileStats()', () => {
  it('serializes the config it is given', () => {
    printConfig({ rules: [], recursive: true });

    const text = ctx.text();
    expect(text).toContain('Current Configuration:');
    expect(text).toContain('"recursive": true');
  });

  it('prints the welcome banner', () => {
    printWelcome();

    expect(ctx.text()).toContain('File Organizer CLI');
  });

  it('totals file sizes, including an empty set', () => {
    printFileStats([
      { name: 'a.bin', size: 1024 },
      { name: 'b.bin', size: 1024 * 1024 },
    ]);
    expect(ctx.text()).toContain('2 files');

    ctx.captured.log.length = 0;
    printFileStats([]);
    expect(ctx.text()).toContain('0 files');
  });
});
