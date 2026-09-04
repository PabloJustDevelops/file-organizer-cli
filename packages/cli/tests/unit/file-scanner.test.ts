import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { FileScanner } from '../../src/core/file-scanner.js';

// Symlink creation on Windows may require privileges; skip gracefully there.
const canSymlink = (() => {
  try {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fo-symlink-'));
    const link = path.join(testDir, 'link');
    fs.symlinkSync(testDir, link, 'dir');
    fs.removeSync(testDir);
    return true;
  } catch {
    return false;
  }
})();

describe('FileScanner', () => {
  let testDir: string;
  const scanner = new FileScanner();

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-scan-'));
    await fs.writeFile(path.join(testDir, 'a.jpg'), 'a');
    await fs.writeFile(path.join(testDir, 'b.txt'), 'b');
    await fs.writeFile(path.join(testDir, '.hidden'), 'h');
    await fs.ensureDir(path.join(testDir, 'sub'));
    await fs.writeFile(path.join(testDir, 'sub', 'c.jpg'), 'c');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('scans a flat directory by default', async () => {
    const files = await scanner.scan(testDir);
    const names = files.map((f) => path.basename(f.path)).sort();
    // 'sub' directory is not a file; hidden excluded by default
    expect(names).toEqual(['a.jpg', 'b.txt']);
  });

  it('scans recursively when asked', async () => {
    const files = await scanner.scan(testDir, { recursive: true });
    const names = files.map((f) => path.basename(f.path)).sort();
    expect(names).toEqual(['a.jpg', 'b.txt', 'c.jpg']);
  });

  it('includes hidden files when asked', async () => {
    const files = await scanner.scan(testDir, { includeHidden: true });
    const names = files.map((f) => path.basename(f.path)).sort();
    expect(names).toContain('.hidden');
  });

  it('filters by extension', async () => {
    const files = await scanner.scan(testDir, { extensions: ['jpg'] });
    expect(files).toHaveLength(1);
    expect(path.basename(files[0].path)).toBe('a.jpg');
  });

  it('gathers real file stats (size, dates, extension)', async () => {
    const files = await scanner.scan(testDir);
    const jpg = files.find((f) => f.name === 'a');
    expect(jpg).toBeDefined();
    expect(jpg!.extension).toBe('jpg');
    expect(jpg!.size).toBe(1);
    expect(jpg!.modifiedAt).toBeInstanceOf(Date);
    expect(jpg!.isDirectory).toBe(false);
  });

  it.skipIf(!canSymlink)('does not follow directory symlinks (no cycles, no duplicates)', async () => {
    // Link pointing back at the scan root itself — a naive recursive walk
    // would loop forever or duplicate every file.
    await fs.symlink(testDir, path.join(testDir, 'loop'), 'dir');

    const files = await scanner.scan(testDir, { recursive: true, includeHidden: true });
    const names = files.map((f) => path.basename(f.path)).sort();

    expect(names).toEqual(['.hidden', 'a.jpg', 'b.txt', 'c.jpg']);
  });
});
