import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { packageDir, removeDir } from './helpers.js';

/**
 * Install smoke (SPEC-verification AC-9, which also closes distribution's
 * AC-6/AC-10): pack the real tarball, install it into an isolated prefix, and
 * prove the installed package exposes its bins and runs.
 *
 * The shims are asserted on disk but not spawned — on Windows a `.cmd` cannot be
 * spawned without a shell — so the installed JS entry is executed directly with
 * `process.execPath`.
 */
const SCOPED_PACKAGE_DIR = path.join(
  'node_modules',
  '@pablojustdevelops',
  'file-organizer-cli'
);

describe('tarball install smoke (e2e)', () => {
  let prefix: string;
  let tarball: string | undefined;

  beforeAll(() => {
    prefix = fs.mkdtempSync(path.join(os.tmpdir(), 'fo-e2e-install-'));

    const packed = execSync('npm pack', {
      cwd: packageDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    tarball = packed.trim().split(/\r?\n/).pop()?.trim();
    if (!tarball) throw new Error('npm pack produced no tarball name');

    execSync(`npm install -g --prefix "${prefix}" "${path.join(packageDir, tarball)}"`, {
      stdio: 'pipe',
    });
  }, 300_000);

  afterAll(() => {
    if (tarball) fs.rmSync(path.join(packageDir, tarball), { force: true });
    if (prefix) removeDir(prefix);
  });

  it('AC-9: installed package exposes its bins and runs', () => {
    const binNames =
      process.platform === 'win32'
        ? ['fo.cmd', 'file-organizer.cmd', 'fo-tui.cmd']
        : ['fo', 'file-organizer', 'fo-tui'];
    for (const bin of binNames) {
      expect(fs.existsSync(path.join(prefix, bin)), `missing bin ${bin}`).toBe(true);
    }

    const entry = path.join(prefix, SCOPED_PACKAGE_DIR, 'dist', 'cli', 'index.js');
    expect(fs.existsSync(entry)).toBe(true);

    const result = spawnSync(process.execPath, [entry, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect((result.stdout ?? '').trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
