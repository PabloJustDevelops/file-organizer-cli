import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Organizer } from '../../src/core/organizer.js';
import type { Rule, OrganizeConfig } from '../../src/types/index.js';

const rules: Rule[] = [
  {
    name: 'Images',
    patterns: ['*.jpg'],
    destination: './images',
  },
];

const config: OrganizeConfig = { rules };

describe('Conflict resolution matrix', () => {
  let testDir: string;
  let historyDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-conflict-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-history-'));
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'source content');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('rename: creates photo (1).jpg when destination exists', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'rename',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.moved).toHaveLength(1);
    expect(await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')).toBe('existing');
    expect(await fs.readFile(path.join(testDir, 'images', 'photo (1).jpg'), 'utf-8')).toBe('source content');
  });

  it('overwrite: replaces existing destination file', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'overwrite',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.moved).toHaveLength(1);
    expect(await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')).toBe('source content');
  });

  it('skip: leaves existing file untouched and reports skipped', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    await fs.writeFile(path.join(testDir, 'images', 'photo.jpg'), 'existing');

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'skip',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.moved).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(await fs.readFile(path.join(testDir, 'images', 'photo.jpg'), 'utf-8')).toBe('existing');
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('newest: keeps destination when it is newer than source', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    const destPath = path.join(testDir, 'images', 'photo.jpg');
    await fs.writeFile(destPath, 'existing');

    // Make destination clearly newer than source
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(destPath, future, future);

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'newest',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.moved).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(await fs.readFile(destPath, 'utf-8')).toBe('existing');
  });

  it('newest: replaces destination when source is newer', async () => {
    await fs.ensureDir(path.join(testDir, 'images'));
    const destPath = path.join(testDir, 'images', 'photo.jpg');
    await fs.writeFile(destPath, 'existing');

    // Make source clearly newer than destination
    const future = new Date(Date.now() + 60_000);
    await fs.utimes(path.join(testDir, 'photo.jpg'), future, future);

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config,
      conflictResolution: 'newest',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.moved).toHaveLength(1);
    expect(await fs.readFile(destPath, 'utf-8')).toBe('source content');
  });
});

describe('Dry-run history isolation', () => {
  let testDir: string;
  let historyDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-dryrun-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-history-'));
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'content');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('dry-run does not create undo history entries', async () => {
    const organizer = new Organizer({ historyDir });

    await organizer.organize(testDir, { config, dryRun: true });

    expect(await organizer.getHistory()).toHaveLength(0);
  });

  it('real run after dry-run undoes only the real run', async () => {
    const organizer = new Organizer({ historyDir });

    await organizer.organize(testDir, { config, dryRun: true });
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);

    await organizer.organize(testDir, { config });
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(false);

    expect(await organizer.getHistory()).toHaveLength(1);

    await organizer.undo();
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
    expect((await organizer.getHistory()).length).toBe(0);
  });

  it('undo is conflict-safe: falls back to a unique name instead of failing', async () => {
    const organizer = new Organizer({ historyDir });

    await organizer.organize(testDir, { config });

    // Simulate something taking the original spot while the file was away
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'someone else');

    const result = await organizer.undo();

    expect(result).not.toBeNull();
    expect(result!.errors).toHaveLength(0);
    expect(result!.moved).toHaveLength(1);
    // Original content survives under a renamed file
    expect(await fs.readFile(result!.moved[0].to, 'utf-8')).toBe('content');
  });

  it('extension-less files move without a trailing dot', async () => {
    await fs.writeFile(path.join(testDir, 'LICENSE'), 'MIT');
    const noExtConfig: OrganizeConfig = {
      rules: [{ name: 'Docs', patterns: ['*'], destination: './docs' }],
    };

    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, { config: noExtConfig });

    expect(result.errors).toHaveLength(0);
    expect(result.moved.find((m) => m.from.endsWith('LICENSE'))).toBeDefined();
    expect(await fs.pathExists(path.join(testDir, 'docs', 'LICENSE'))).toBe(true);
    expect(await fs.pathExists(path.join(testDir, 'docs', 'LICENSE.'))).toBe(false);
  });
});
