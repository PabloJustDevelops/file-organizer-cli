import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, removeDir, runCli, writeFileAt } from './helpers.js';

/**
 * The CLI's process-level contract (SPEC-cli-contract AC-1…AC-12, AC-14):
 * failures exit non-zero and the three read/compute commands can emit pure JSON.
 * Runs the built binary because exit codes only exist at the process boundary.
 */
const CONFIG = `rules:
  - name: Images
    patterns: ["*.jpg", "*.png"]
    destination: ./images/{year}
  - name: Docs
    patterns: ["*.pdf"]
    destination: ./documents
conflictResolution: rename
`;

// Missing `destination` — loadConfig rejects it ("destination is required").
const INVALID_CONFIG = `rules:
  - name: Broken
    patterns: ["*.jpg"]
`;

// ESC (U+001B) built at runtime: a literal escape inside a regex trips oxlint's
// control-character rule.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[`);

describe('fo CLI contract (e2e)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir('contract');
  });

  afterEach(() => {
    removeDir(dir);
  });

  it('AC-1: organize without a config exits 1', () => {
    const result = runCli(['organize', '.'], dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No config');
  });

  it('AC-2: rules list without a config exits 1', () => {
    expect(runCli(['rules', 'list'], dir).status).toBe(1);
  });

  it('AC-3: rules remove without a config exits 1', () => {
    expect(runCli(['rules', 'remove'], dir).status).toBe(1);
  });

  it('AC-4: config show without a config exits 1', () => {
    expect(runCli(['config', 'show'], dir).status).toBe(1);
  });

  it('AC-5: config show with an invalid config exits 1', () => {
    writeFileAt(dir, '.file-organizer.yaml', INVALID_CONFIG);
    expect(runCli(['config', 'show'], dir).status).toBe(1);
  });

  it('AC-6: config init then validate exits 0 (regression)', () => {
    expect(runCli(['config', 'init'], dir).status).toBe(0);
    expect(runCli(['config', 'validate'], dir).status).toBe(0);
  });

  it('AC-7/AC-12: organize --dry-run --json is pure JSON and moves nothing', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) writeFileAt(dir, name, 'x');

    const result = runCli(['organize', '.', '--dry-run', '--json'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(ANSI);
    const payload = JSON.parse(result.stdout) as { dryRun: boolean; moved: unknown[] };
    expect(payload.dryRun).toBe(true);
    expect(payload.moved).toHaveLength(3);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) {
      expect(fs.existsSync(path.join(dir, name))).toBe(true);
    }
  });

  it('AC-8: organize -y --json emits JSON and moves the files', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) writeFileAt(dir, name, 'x');

    const result = runCli(['organize', '.', '-y', '--json'], dir);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { dryRun: boolean; moved: unknown[] };
    expect(payload.dryRun).toBe(false);
    expect(payload.moved).toHaveLength(3);
  });

  it('AC-9: organize --json without a config exits 1 with a JSON error', () => {
    const result = runCli(['organize', '.', '--json'], dir);

    expect(result.status).toBe(1);
    expect(result.stdout).not.toMatch(ANSI);
    const payload = JSON.parse(result.stdout) as { error: string };
    expect(payload.error).toContain('No config');
  });

  it('AC-10: rules list --json emits the rule array', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);

    const result = runCli(['rules', 'list', '--json'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(ANSI);
    const rules = JSON.parse(result.stdout) as { name: string }[];
    expect(rules.map((rule) => rule.name)).toEqual(['Images', 'Docs']);
  });

  it('AC-11: config show --json emits the config object', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);

    const result = runCli(['config', 'show', '--json'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).not.toMatch(ANSI);
    const config = JSON.parse(result.stdout) as { rules: unknown[] };
    expect(config.rules).toHaveLength(2);
  });

  it('AC-14: organize --json with 20 files does not prompt or hang', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);
    for (let index = 0; index < 20; index++) writeFileAt(dir, `img-${index}.jpg`, 'x');

    const result = runCli(['organize', '.', '--json'], dir);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { moved: unknown[] };
    expect(payload.moved).toHaveLength(20);
  });
});
