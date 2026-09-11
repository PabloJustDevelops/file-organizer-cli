import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the distribution contract of packages/cli/package.json (SPEC-distribution
 * AC-1…AC-4, AC-7). The package name is scoped because the unscoped npm name is
 * owned by a third party; the metadata fields feed the npm page and the scoped
 * publish requires publishConfig.access = "public".
 */
interface PackageJson {
  name?: unknown;
  bin?: unknown;
  publishConfig?: unknown;
  repository?: unknown;
  homepage?: unknown;
  bugs?: unknown;
  author?: unknown;
  license?: unknown;
  engines?: unknown;
  keywords?: unknown;
  scripts?: unknown;
}

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(packageDir, '../..');
const pkg = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')
) as PackageJson;

describe('package metadata (distribution)', () => {
  it('AC-2: package name is scoped', () => {
    expect(pkg.name).toBe('@pablojustdevelops/file-organizer-cli');
  });

  it('AC-4: publishConfig.access is public and bins are unchanged', () => {
    expect(pkg.publishConfig).toEqual({ access: 'public' });
    expect(pkg.bin).toEqual({
      fo: 'dist/cli/index.js',
      'file-organizer': 'dist/cli/index.js',
      'fo-tui': 'dist/tui/index.js',
    });
  });

  it('AC-3: repository, homepage, bugs, author, license, engines, keywords are present', () => {
    expect(pkg.repository).toBeTruthy();
    expect(pkg.homepage).toBeTruthy();
    expect(pkg.bugs).toBeTruthy();
    expect(pkg.author).toBeTruthy();
    expect(pkg.license).toBe('MIT');
    expect(pkg.engines).toBeTruthy();
    expect(Array.isArray(pkg.keywords)).toBe(true);
  });

  it('AC-7: prepublishOnly runs the real suite, not the bun test runner', () => {
    expect(pkg.scripts).toMatchObject({
      prepublishOnly: 'bun run build && bun run test',
    });
  });

  it('AC-1: LICENSE ships at the repo root and inside the package, and they match', () => {
    const rootLicense = path.join(repoRoot, 'LICENSE');
    const packageLicense = path.join(packageDir, 'LICENSE');
    expect(fs.existsSync(rootLicense)).toBe(true);
    expect(fs.existsSync(packageLicense)).toBe(true);

    const rootText = fs.readFileSync(rootLicense, 'utf-8');
    expect(rootText).toMatch(/MIT License/);
    expect(rootText).toMatch(/Copyright \(c\) \d{4} /);
    expect(fs.readFileSync(packageLicense, 'utf-8')).toBe(rootText);
  });
});
