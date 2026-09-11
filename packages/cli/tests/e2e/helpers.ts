import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/cli — the workspace package whose built binary the E2E drives. */
export const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
export const cliEntry = path.join(packageDir, 'dist', 'cli', 'index.js');

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run the built CLI in an isolated environment. `home` defaults to `cwd` so the
 * organizer's history store (`~/.file-organizer`) never reads or writes the
 * developer's real one. BOTH `HOME` and `USERPROFILE` are set because
 * `os.homedir()` reads `USERPROFILE` on Windows.
 *
 * Spawned via `process.execPath` with an args array and no shell: portable, and
 * avoids both the Windows `.cmd`-without-shell EINVAL and Node's DEP0190.
 */
export function runCli(args: string[], cwd: string, home?: string): CliResult {
  const isolatedHome = home ?? cwd;
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, HOME: isolatedHome, USERPROFILE: isolatedHome },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function makeTempDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `fo-e2e-${label}-`));
}

export function writeFileAt(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, 'utf-8');
}

export function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}
