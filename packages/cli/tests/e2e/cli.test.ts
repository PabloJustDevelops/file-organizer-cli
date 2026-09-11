import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, packageDir, removeDir, runCli, writeFileAt } from './helpers.js';

/**
 * End-to-end happy paths against the built binary (SPEC-verification AC-1…AC-8).
 * Failure-path exit codes are deliberately out of scope — that is cli-contract's
 * deliverable; these assert that the commands work and that dry-run/undo leave
 * the filesystem in the expected state.
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

const packageVersion = (
  JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')) as {
    version: string;
  }
).version;

describe('fo CLI (e2e, built binary)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir('cli');
  });

  afterEach(() => {
    removeDir(dir);
  });

  it('AC-1: --version prints the package version', () => {
    const result = runCli(['--version'], dir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageVersion);
  });

  it('AC-2: --help lists the core commands', () => {
    const result = runCli(['--help'], dir);
    expect(result.status).toBe(0);
    for (const command of ['organize', 'watch', 'rules', 'undo', 'config', 'dedup']) {
      expect(result.stdout).toContain(command);
    }
  });

  it('AC-3: config init creates a file that validates', () => {
    const init = runCli(['config', 'init'], dir);
    expect(init.status).toBe(0);
    expect(fs.existsSync(path.join(dir, '.file-organizer.yaml'))).toBe(true);

    const validate = runCli(['config', 'validate'], dir);
    expect(validate.status).toBe(0);
  });

  it('AC-4: organize --dry-run previews without moving anything', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) writeFileAt(dir, name, 'x');

    const result = runCli(['organize', '.', '--dry-run'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('3');
    expect(fs.existsSync(path.join(dir, 'images'))).toBe(false);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) {
      expect(fs.existsSync(path.join(dir, name))).toBe(true);
    }
  });

  it('AC-5/AC-6: organize moves files, then undo restores them', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) writeFileAt(dir, name, 'x');

    const organize = runCli(['organize', '.', '-y'], dir);
    expect(organize.status).toBe(0);

    const year = new Date().getFullYear().toString();
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) {
      expect(fs.existsSync(path.join(dir, 'images', year, name))).toBe(true);
      expect(fs.existsSync(path.join(dir, name))).toBe(false);
    }

    const undo = runCli(['undo', '-y'], dir);
    expect(undo.status).toBe(0);
    for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) {
      expect(fs.existsSync(path.join(dir, name))).toBe(true);
    }
  });

  it('AC-7: rules list prints the configured rules', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);

    const result = runCli(['rules', 'list'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Images');
    expect(result.stdout).toContain('Docs');
  });

  it('AC-8: dedup reports duplicates without deleting them', () => {
    writeFileAt(dir, 'one.txt', 'duplicate-content');
    writeFileAt(dir, 'two.txt', 'duplicate-content');

    const result = runCli(['dedup', '.', '-r'], dir);

    expect(result.status).toBe(0);
    expect(result.stdout.toLowerCase()).toContain('duplicate');
    expect(fs.existsSync(path.join(dir, 'one.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'two.txt'))).toBe(true);
  });
});
