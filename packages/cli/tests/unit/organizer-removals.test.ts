import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Organizer } from '../../src/core/organizer.js';
import { FileScanner } from '../../src/core/file-scanner.js';
import type { MovedFile } from '../../src/types/index.js';

/**
 * `recordRemovals`/`backupForRemoval` back the undoable `dedup --delete`
 * (SPEC-safe-mutations AC-2…AC-4): a file moved aside is restorable by `undo`.
 */
describe('Organizer removals (dedup backup)', () => {
  let historyDir: string;
  let workDir: string;

  beforeEach(async () => {
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-rem-hist-'));
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-rem-work-'));
  });

  afterEach(async () => {
    await fs.remove(historyDir);
    await fs.remove(workDir);
  });

  it('records nothing for an empty removal list', async () => {
    const organizer = new Organizer({ historyDir });

    await organizer.recordRemovals([]);

    expect(await organizer.getHistory()).toEqual([]);
  });

  it('moves a file to backup and records a restorable entry', async () => {
    const organizer = new Organizer({ historyDir });
    const original = path.join(workDir, 'dupe.txt');
    await fs.writeFile(original, 'content');

    const backupPath = await organizer.backupForRemoval(original);
    expect(await fs.pathExists(original)).toBe(false);

    const removal: MovedFile = { from: original, to: backupPath, rule: 'dedup' };
    await organizer.recordRemovals([removal]);

    const history = await organizer.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].operations).toEqual([removal]);
  });

  it('persists removals across organizer instances', async () => {
    const first = new Organizer({ historyDir });
    const original = path.join(workDir, 'dupe.txt');
    await fs.writeFile(original, 'content');
    const backupPath = await first.backupForRemoval(original);
    await first.recordRemovals([{ from: original, to: backupPath, rule: 'dedup' }]);

    const second = new Organizer({ historyDir });
    const history = await second.getHistory();

    expect(history).toHaveLength(1);
    expect(history[0].operations[0].rule).toBe('dedup');
  });

  it('trims history down to the configured size', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.setHistorySize(1);

    await organizer.recordRemovals([{ from: '/old', to: '/old-backup', rule: 'dedup' }]);
    await organizer.recordRemovals([{ from: '/new', to: '/new-backup', rule: 'dedup' }]);

    const history = await organizer.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].operations[0].from).toBe('/new');
  });

  it('exposes its scanner and the history file path', () => {
    const organizer = new Organizer({ historyDir });

    expect(organizer.getScanner()).toBeInstanceOf(FileScanner);
    expect(organizer.getHistoryFilePath()).toContain('history.json');
  });
});
