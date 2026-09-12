import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { HistoryStore } from '../../src/utils/history-store.js';
import { logger } from '../../src/utils/logger.js';
import type { UndoEntry } from '../../src/types/index.js';

describe('HistoryStore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-history-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  function makeStore() {
    return new HistoryStore({ historyDir: tempDir });
  }

  function makeEntry(id: string, from: string, to: string): UndoEntry {
    return {
      id,
      timestamp: new Date('2026-09-03T10:00:00Z'),
      operations: [{ from, to, rule: 'test' }],
    };
  }

  it('starts with empty history', async () => {
    const store = makeStore();
    const entries = await store.load();
    expect(entries).toEqual([]);
  });

  it('saves and loads entries', async () => {
    const store = makeStore();
    const entry = makeEntry('1', '/a/file.txt', '/b/file.txt');
    await store.save([entry]);

    const store2 = makeStore();
    const loaded = await store2.load();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('1');
    expect(loaded[0].operations[0].from).toBe('/a/file.txt');
  });

  it('persists across instances', async () => {
    const store1 = makeStore();
    const entry1 = makeEntry('1', '/a/1.txt', '/b/1.txt');
    await store1.save([entry1]);

    const store2 = makeStore();
    const entry2 = makeEntry('2', '/a/2.txt', '/b/2.txt');
    const loaded = await store2.load();
    await store2.save([...loaded, entry2]);

    const store3 = makeStore();
    const finalLoad = await store3.load();

    expect(finalLoad).toHaveLength(2);
    expect(finalLoad.map(e => e.id)).toEqual(['1', '2']);
  });

  it('clears history', async () => {
    const store = makeStore();
    const entry = makeEntry('1', '/a/file.txt', '/b/file.txt');
    await store.save([entry]);
    await store.clear();

    const loaded = await store.load();
    expect(loaded).toEqual([]);
  });

  it('returns history file path', () => {
    const store = makeStore();
    expect(store.getFilePath()).toContain('history.json');
  });

  it('handles corrupted file gracefully', async () => {
    await fs.ensureDir(tempDir);
    await fs.writeFile(path.join(tempDir, 'history.json'), 'not valid json');

    const store = makeStore();
    const loaded = await store.load();
    expect(loaded).toEqual([]);
  });

  it('warns and starts clean when the corrupt file cannot be moved aside', async () => {
    await fs.ensureDir(tempDir);
    await fs.writeFile(path.join(tempDir, 'history.json'), 'not valid json');
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(fs, 'move').mockRejectedValueOnce(new Error('EBUSY: locked'));

    const loaded = await makeStore().load();

    expect(loaded).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be moved aside'));
    vi.restoreAllMocks();
  });

  it('round-trips a replaced list and omits an empty one', async () => {
    const withReplaced: UndoEntry = {
      ...makeEntry('1', '/a/f.txt', '/b/f.txt'),
      replaced: [{ path: '/b/f.txt', backupPath: '/h/replaced/x.txt' }],
    };
    const withEmpty: UndoEntry = { ...makeEntry('2', '/a/g.txt', '/b/g.txt'), replaced: [] };
    await makeStore().save([withReplaced, withEmpty]);

    const loaded = await makeStore().load();

    expect(loaded[0].replaced).toEqual([{ path: '/b/f.txt', backupPath: '/h/replaced/x.txt' }]);
    expect(loaded[1].replaced).toBeUndefined();
  });

  it('caches after first load', async () => {
    const store = makeStore();
    const entry = makeEntry('1', '/a/file.txt', '/b/file.txt');
    await store.save([entry]);

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
  });

  it('AC-11: moveToBackup moves the file and preserves the extension', async () => {
    const store = makeStore();
    const source = path.join(tempDir, 'duplicate.txt');
    await fs.writeFile(source, 'data');

    const backupPath = await store.moveToBackup(source);

    expect(await fs.pathExists(source)).toBe(false);
    expect(backupPath).toContain('dedup');
    expect(path.extname(backupPath)).toBe('.txt');
    expect(await fs.readFile(backupPath, 'utf-8')).toBe('data');
  });
});
