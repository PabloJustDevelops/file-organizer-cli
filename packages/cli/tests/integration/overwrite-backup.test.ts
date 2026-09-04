import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Organizer } from '../../src/core/organizer.js';
import { HistoryStore } from '../../src/utils/history-store.js';
import type { OrganizeConfig } from '../../src/types/index.js';

describe('Overwrite backup + undo', () => {
  let testDir: string;
  let historyDir: string;

  const config: OrganizeConfig = {
    rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-bak-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-bak-h-'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('overwrite: undo restores BOTH the moved file and the clobbered file', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'PRECIOUS ORIGINAL');
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'new incoming');

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'overwrite',
    });
    expect(result.errors).toHaveLength(0);

    // The overwrite destroyed the original content
    expect(
      await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')
    ).toBe('new incoming');

    // Undo must bring back BOTH files with their original contents
    await organizer.undo();
    expect(
      await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')
    ).toBe('PRECIOUS ORIGINAL');
    expect(await fs.readFile(path.join(testDir, 'photo.jpg'), 'utf-8')).toBe('new incoming');
  });

  it('newest: clobbered file is restorable too', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'older original');
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'newer incoming');

    // Make source newer so newest-resolution overwrites the destination
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(path.join(testDir, 'photo.jpg'), future, future);

    const organizer = new Organizer({ historyDir });
    await organizer.organize(testDir, { config, conflictResolution: 'newest' });

    expect(
      await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')
    ).toBe('newer incoming');

    await organizer.undo();
    expect(
      await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')
    ).toBe('older original');
    expect(await fs.readFile(path.join(testDir, 'photo.jpg'), 'utf-8')).toBe('newer incoming');
  });

  it('skip and rename runs create no replaced entries', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'incoming'); // file that will move

    const organizer = new Organizer({ historyDir });
    await organizer.organize(testDir, { config, conflictResolution: 'rename' });

    const history = await organizer.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].replaced).toBeUndefined();
  });
});

describe('Corrupt history handling', () => {
  let historyDir: string;

  beforeEach(async () => {
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-corrupt-'));
  });

  afterEach(async () => {
    await fs.remove(historyDir);
  });

  it('quarantines a malformed history file instead of silently resetting', async () => {
    const historyFile = path.join(historyDir, 'history.json');
    await fs.writeFile(historyFile, '{ this is not valid JSON !!!');

    const store = new HistoryStore({ historyDir });
    const entries = await store.load();

    expect(entries).toHaveLength(0);
    // Original file moved aside, not deleted
    const dirContents = await fs.readdir(historyDir);
    expect(dirContents.some((f) => f.startsWith('history.json.corrupt-'))).toBe(true);
    expect(await fs.pathExists(historyFile)).toBe(false);
  });

  it('quarantines structurally invalid JSON (valid parse, wrong shape)', async () => {
    const historyFile = path.join(historyDir, 'history.json');
    await fs.writeFile(historyFile, JSON.stringify({ version: 1, nope: true }));

    const store = new HistoryStore({ historyDir });
    const entries = await store.load();
    expect(entries).toHaveLength(0);
    const dirContents = await fs.readdir(historyDir);
    expect(dirContents.some((f) => f.startsWith('history.json.corrupt-'))).toBe(true);
  });

  it('saves still work after a quarantine', async () => {
    const historyFile = path.join(historyDir, 'history.json');
    await fs.writeFile(historyFile, 'garbage');

    const store = new HistoryStore({ historyDir });
    await store.load();
    await store.save([
      {
        id: 'test-id',
        timestamp: new Date(),
        operations: [{ from: '/a', to: '/b', rule: 'r' }],
      },
    ]);

    const reloaded = await new HistoryStore({ historyDir }).load();
    expect(reloaded).toHaveLength(1);
  });
});
