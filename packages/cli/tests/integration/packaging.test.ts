import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Guards the published tarball (SPEC-distribution AC-5). `npm pack` reads the
 * real `files` allowlist + `.npmignore`, so this asserts the actual shipped set
 * rather than the intent: dist output + README + LICENSE, never source, tests,
 * tooling, or sourcemaps.
 *
 * Commands are literal strings run through the shell: passing an args array
 * alongside `shell: true` triggers Node's DEP0190, and spawning the Windows
 * `npm.cmd`/`bun.cmd` shims without a shell fails with EINVAL.
 */
interface PackFile {
  path: string;
  size: number;
}

interface PackResult {
  name: string;
  files: PackFile[];
}

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const buildEntry = path.join(packageDir, 'dist', 'cli', 'index.js');

function buildIfNeeded(): void {
  if (fs.existsSync(buildEntry)) return;
  execSync('bun run build', { cwd: packageDir, stdio: 'pipe' });
}

function packedFilePaths(): string[] {
  const stdout = execSync('npm pack --dry-run --json', {
    cwd: packageDir,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const results = JSON.parse(stdout) as PackResult[];
  if (results.length === 0) {
    throw new Error('npm pack --dry-run --json returned no result');
  }
  return results[0]!.files.map((file) => file.path);
}

describe('npm tarball (distribution)', () => {
  beforeAll(() => {
    buildIfNeeded();
  }, 300_000);

  it('AC-5: ships dist + README + LICENSE; excludes src, tests, tools, and sourcemaps', () => {
    const paths = packedFilePaths();

    const required = [
      'dist/cli/index.js',
      'dist/mcp/server.js',
      'dist/tui/index.js',
      'dist/index.js',
      'dist/index.d.ts',
      'package.json',
      'README.md',
      'LICENSE',
    ];
    for (const entry of required) {
      expect(paths, `tarball is missing ${entry}`).toContain(entry);
    }

    const forbiddenPrefixes = ['src/', 'tests/', 'tools/'];
    for (const filePath of paths) {
      expect(
        forbiddenPrefixes.some((prefix) => filePath.startsWith(prefix)),
        `tarball must not contain ${filePath}`
      ).toBe(false);
      expect(filePath.endsWith('.map'), `tarball must not contain ${filePath}`).toBe(false);
    }
  });
});
