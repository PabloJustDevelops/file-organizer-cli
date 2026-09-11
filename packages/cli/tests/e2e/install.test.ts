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
 *
 * npm's global layout is platform-dependent: POSIX puts bins in `<prefix>/bin`
 * and packages in `<prefix>/lib/node_modules`, while Windows puts both closer to
 * the prefix root. Both layouts are probed rather than assuming one.
 */
const SCOPED_PACKAGE_DIR = path.join('@pablojustdevelops', 'file-organizer-cli');

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((candidate) => fs.existsSync(candidate));
}

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
    const binDir = firstExisting([path.join(prefix, 'bin'), prefix]) ?? prefix;
    const binNames =
      process.platform === 'win32'
        ? ['fo.cmd', 'file-organizer.cmd', 'fo-tui.cmd']
        : ['fo', 'file-organizer', 'fo-tui'];
    for (const bin of binNames) {
      expect(fs.existsSync(path.join(binDir, bin)), `missing bin ${bin} in ${binDir}`).toBe(true);
    }

    const installedDir =
      firstExisting([
        path.join(prefix, 'lib', 'node_modules', SCOPED_PACKAGE_DIR),
        path.join(prefix, 'node_modules', SCOPED_PACKAGE_DIR),
      ]) ?? path.join(prefix, 'node_modules', SCOPED_PACKAGE_DIR);
    const entry = path.join(installedDir, 'dist', 'cli', 'index.js');
    expect(fs.existsSync(entry), `missing entry ${entry}`).toBe(true);

    const result = spawnSync(process.execPath, [entry, '--version'], { encoding: 'utf-8' });
    expect(result.status).toBe(0);
    expect((result.stdout ?? '').trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
