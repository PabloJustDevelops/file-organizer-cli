import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, removeDir, runCli, writeFileAt } from './helpers.js';

/**
 * Mutations that must be reversible or must refuse to run (SPEC-safe-mutations):
 * `dedup --delete` is undoable, and `watch` validates its flags before starting.
 */
const CONFIG = `rules:
  - name: Images
    patterns: ["*.jpg"]
    destination: ./images
conflictResolution: rename
`;

describe('safe mutations (e2e)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir('safe');
  });

  afterEach(() => {
    removeDir(dir);
  });

  it('AC-2/AC-3/AC-4: dedup --delete is recorded in history and undo restores it', () => {
    writeFileAt(dir, 'one.txt', 'duplicate-content');
    writeFileAt(dir, 'two.txt', 'duplicate-content');

    expect(runCli(['undo', '--list'], dir).stdout).toContain('No operations in history');

    const removal = runCli(['dedup', '.', '-r', '--delete', '-y'], dir);
    expect(removal.status).toBe(0);

    const remaining = ['one.txt', 'two.txt'].filter((name) =>
      fs.existsSync(path.join(dir, name))
    );
    expect(remaining).toHaveLength(1);

    // AC-4: the removal is recorded in the same history `undo` reads.
    expect(runCli(['undo', '--list'], dir).stdout).toContain('Operation History');

    // AC-3: undo restores the removed copy.
    const undo = runCli(['undo', '-y'], dir);
    expect(undo.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'one.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'two.txt'))).toBe(true);
  });

  it('AC-8: watch --debounce abc exits 1 before watching starts', () => {
    writeFileAt(dir, '.file-organizer.yaml', CONFIG);

    const result = runCli(['watch', '.', '--debounce', 'abc'], dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('debounce');
  });
});
