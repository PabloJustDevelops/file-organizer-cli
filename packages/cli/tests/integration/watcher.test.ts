import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Organizer } from '../../src/core/organizer.js';
import { FolderWatcher } from '../../src/core/watcher.js';
import type { OrganizeConfig } from '../../src/types/index.js';

describe('FolderWatcher (integration)', () => {
  let testDir: string;
  let historyDir: string;
  let watcher: FolderWatcher | null = null;

  const config: OrganizeConfig = {
    rules: [
      { name: 'Images', patterns: ['*.jpg'], destination: './images' },
    ],
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-watch-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-watch-hist-'));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  const startWatcher = async (): Promise<FolderWatcher> => {
    const organizer = new Organizer({ historyDir });
    organizer.setRules(config.rules);
    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
    });
    await w.start();
    watcher = w;
    return w;
  };

  const waitFor = async (
    fn: () => Promise<boolean>,
    timeoutMs = 10_000,
    intervalMs = 50
  ): Promise<void> => {
    const start = Date.now();
    while (!(await fn())) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('waitFor: condition not met within timeout');
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  it('organizes a file dropped into the watched directory', async () => {
    const w = await startWatcher();

    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'content');

    await waitFor(async () => (await fs.pathExists(path.join(testDir, 'images', 'photo.jpg'))));
    await w.idle();

    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(false);
    expect(
      await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')
    ).toBe('content');
  });

  it('organizes a file dropped into a subdirectory (recursive scan)', async () => {
    const w = await startWatcher();

    await fs.ensureDir(path.join(testDir, 'inbox'));
    await fs.writeFile(path.join(testDir, 'inbox', 'pic.jpg'), 'nested');

    await waitFor(async () =>
      (await fs.pathExists(path.join(testDir, 'images', 'pic.jpg')))
    );
    await w.idle();

    expect(
      await fs.readFile(path.join(testDir, 'images', 'pic.jpg'), 'utf-8')
    ).toBe('nested');
  });

  it('does not react to its own moves (destination folders ignored)', async () => {
    const w = await startWatcher();

    // Pre-create the destination folder with a file: watcher must not touch it
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'already.jpg'), 'untouched');

    // Drop a new file that WILL be organized
    await fs.writeFile(path.join(testDir, 'new.jpg'), 'new');

    await waitFor(async () =>
      (await fs.pathExists(path.join(testDir, 'images', 'new.jpg')))
    );
    await w.idle();

    // The pre-existing destination file must be exactly where it was
    expect(
      await fs.readFile(path.join(testDir, 'images', 'already.jpg'), 'utf-8')
    ).toBe('untouched');
  });

  it('records undo history for watched operations', async () => {
    const w = await startWatcher();

    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'content');
    await waitFor(async () =>
      (await fs.pathExists(path.join(testDir, 'images', 'photo.jpg')))
    );
    await w.idle();

    const organizer = new Organizer({ historyDir });
    const history = await organizer.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });
});
