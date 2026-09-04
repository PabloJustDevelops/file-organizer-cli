import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Organizer } from '../../src/core/organizer.js';
import type { Rule } from '../../src/types/index.js';

function mkdtempRealSync(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

describe('Organizer Integration', () => {
  let organizer: Organizer;
  let testDir: string;
  let historyDir: string;

  const rules: Rule[] = [
    {
      name: 'Images',
      patterns: ['*.jpg', '*.png'],
      destination: './images',
    },
    {
      name: 'Documents',
      patterns: ['*.pdf', '*.txt'],
      destination: './documents',
    },
  ];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-test-'));
    // Isolate undo history per test — the default dir (~/.file-organizer) is
    // real global state and races with other test files running in parallel.
    historyDir = mkdtempRealSync('fo-test-h-');
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'fake jpg content');
    await fs.writeFile(path.join(testDir, 'image.png'), 'fake png content');
    await fs.writeFile(path.join(testDir, 'document.pdf'), 'fake pdf content');
    await fs.writeFile(path.join(testDir, 'notes.txt'), 'some notes');
    await fs.writeFile(path.join(testDir, 'other.xyz'), 'unknown type');
    organizer = new Organizer({ historyDir });
    organizer.setRules(rules);
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('organizes files by extension', async () => {
    const result = await organizer.organize(testDir, {
      conflictResolution: 'rename',
    });

    expect(result.moved.length).toBe(4);
    expect(result.errors).toHaveLength(0);
  });

  it('does not move files in dry-run mode', async () => {
    const result = await organizer.organize(testDir, {
      dryRun: true,
      conflictResolution: 'rename',
    });

    expect(result.moved.length).toBe(4);
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('skips unmatched files', async () => {
    const result = await organizer.organize(testDir, {
      conflictResolution: 'rename',
    });

    const movedNames = result.moved.map((m) => path.basename(m.from));
    expect(movedNames).not.toContain('other.xyz');
  });

  it('handles undo operation', async () => {
    await organizer.organize(testDir, {
      conflictResolution: 'rename',
    });

    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(false);

    const undoResult = await organizer.undo();

    expect(undoResult?.moved.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('handles conflict resolution rename', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');

    const result = await organizer.organize(testDir, {
      conflictResolution: 'rename',
    });

    expect(result.errors).toHaveLength(0);
    expect(await fs.pathExists(path.join(testDir, 'images', 'photo.jpg'))).toBe(true);
    expect(await fs.pathExists(path.join(testDir, 'images', 'photo (1).jpg'))).toBe(true);
  });

  it('handles conflict resolution skip', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');

    const result = await organizer.organize(testDir, {
      conflictResolution: 'skip',
    });

    expect(result.skipped.length).toBeGreaterThan(0);
  });
});
