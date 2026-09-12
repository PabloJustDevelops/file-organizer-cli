import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from '../../src/utils/logger.js';

/**
 * A path can pass the directory listing and still fail to stat: deleted between
 * the two, permissions, a broken link. Those are OS-level races, so the
 * filesystem boundary (`getFileInfo`) is stubbed — the point under test is the
 * scanner's per-file error handling, not `fs.stat`.
 *
 * This lives in its own file because the stub replaces the module for every
 * importer; `file-scanner.test.ts` exercises the real one.
 */
vi.mock('../../src/utils/file-utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/file-utils.js')>();
  return {
    ...actual,
    getFileInfo: async (filePath: string) => {
      if (filePath.endsWith('a.jpg')) throw new Error('EACCES: permission denied');
      return actual.getFileInfo(filePath);
    },
  };
});

const { FileScanner } = await import('../../src/core/file-scanner.js');

describe('FileScanner unreadable file', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-scan-err-'));
    await fs.writeFile(path.join(testDir, 'a.jpg'), 'a');
    await fs.writeFile(path.join(testDir, 'b.txt'), 'b');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    vi.restoreAllMocks();
  });

  it('skips the file that cannot be read and keeps the rest', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    const files = await new FileScanner().scan(testDir);
    const names = files.map((f) => path.basename(f.path)).sort();

    expect(names).toEqual(['b.txt']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not read file'));
  });
});
