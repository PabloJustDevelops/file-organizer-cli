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

  it('AC-6: keeps its own destination out of the scan (no self-reaction)', async () => {
    const customConfig: OrganizeConfig = {
      rules: [
        { name: 'Photos', patterns: ['*.jpg'], destination: './photos' },
        { name: 'Graphics', patterns: ['*.png'], destination: './graphics' },
      ],
    };
    const organizer = new Organizer({ historyDir });
    organizer.setRules(customConfig.rules);
    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
      organizeOnStart: false,
    });
    await w.start();
    watcher = w;

    // A .png inside the Photos destination matches the Graphics rule; it must
    // survive because destination folders are excluded from the scan.
    await fs.ensureDir(path.join(testDir, 'photos'));
    await fs.writeFile(path.join(testDir, 'photos', 'logo.png'), 'logo');

    await fs.writeFile(path.join(testDir, 'new.jpg'), 'new');
    await waitFor(async () => fs.pathExists(path.join(testDir, 'photos', 'new.jpg')));
    await w.idle();
    await new Promise((r) => setTimeout(r, 250));
    await w.idle();

    expect(await fs.readFile(path.join(testDir, 'photos', 'logo.png'), 'utf-8')).toBe('logo');
    expect(await fs.pathExists(path.join(testDir, 'graphics', 'logo.png'))).toBe(false);
  });

  it('AC-9: organizes existing files on start when organizeOnStart is enabled', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.setRules(config.rules);
    await fs.writeFile(path.join(testDir, 'pre.jpg'), 'existing');
    // Let the write settle before the watch registers, so only the initial
    // pass can move it — not a stray add event from the registration race.
    await new Promise((r) => setTimeout(r, 500));

    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
      organizeOnStart: true,
    });
    await w.start();
    watcher = w;

    await waitFor(async () => fs.pathExists(path.join(testDir, 'images', 'pre.jpg')));
    await w.idle();

    expect(await fs.pathExists(path.join(testDir, 'pre.jpg'))).toBe(false);
  });

  it('AC-10: does nothing on start when organizeOnStart is false', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.setRules(config.rules);
    await fs.writeFile(path.join(testDir, 'pre.jpg'), 'existing');
    await new Promise((r) => setTimeout(r, 500));

    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
      organizeOnStart: false,
    });
    await w.start();
    watcher = w;

    await new Promise((r) => setTimeout(r, 400));
    await w.idle();

    expect(await fs.pathExists(path.join(testDir, 'pre.jpg'))).toBe(true);
    expect(await fs.pathExists(path.join(testDir, 'images', 'pre.jpg'))).toBe(false);
  });

  it('AC-6: learns a templated destination so it is not re-scanned', async () => {
    const templated: OrganizeConfig = {
      rules: [{ name: 'ByYear', patterns: ['*.jpg'], destination: './{year}' }],
    };
    const organizer = new Organizer({ historyDir });
    organizer.setRules(templated.rules);
    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
      organizeOnStart: false,
    });
    await w.start();
    watcher = w;

    await fs.writeFile(path.join(testDir, 'a.jpg'), 'a');
    const year = new Date().getFullYear().toString();
    await waitFor(async () => fs.pathExists(path.join(testDir, year, 'a.jpg')));
    await w.idle();

    // A file that lands inside the (now learned) destination must stay put:
    // the destination is excluded from events and from the scan.
    await fs.writeFile(path.join(testDir, year, 'b.jpg'), 'b');
    await new Promise((r) => setTimeout(r, 300));
    await w.idle();

    expect(await fs.pathExists(path.join(testDir, year, 'b.jpg'))).toBe(true);
  });

  it('survives a failing organize pass without crashing', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.setRules(config.rules);
    // An unresolvable plugin spec makes every organize pass throw before it
    // scans; the watcher must swallow it and keep watching.
    const w = new FolderWatcher(organizer, testDir, {
      debounceMs: 20,
      organizeOnStart: true,
      plugins: ['./missing-plugin.js'],
      pluginBaseDir: testDir,
    });
    await w.start();
    watcher = w;
    await w.idle();

    await fs.writeFile(path.join(testDir, 'boom.jpg'), 'x');
    await new Promise((r) => setTimeout(r, 300));
    await w.idle();

    // The run failed, so nothing moved and the watcher is still alive.
    expect(await fs.pathExists(path.join(testDir, 'boom.jpg'))).toBe(true);
  });
});
