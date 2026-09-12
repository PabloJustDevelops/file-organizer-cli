import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Organizer } from '../../src/core/organizer.js';
import type { LoaderEdges } from '../../src/core/plugins/loader.js';
import type { OrganizeConfig, Rule } from '../../src/types/index.js';

/**
 * Error and edge paths of a run. Every case here drives a real filesystem into
 * the state that reaches the branch — no module stubbing except one `fs.remove`
 * rejection, which is the only way to make a backup removal fail.
 */
describe('Organizer error paths', () => {
  let testDir: string;
  let historyDir: string;

  const rules: Rule[] = [
    { name: 'Out', patterns: ['*.jpg'], destination: './out' },
  ];

  const pluginEdges = (mod: unknown): LoaderEdges => ({
    fileExists: async () => true,
    resolvePackage: (name: string) => `/resolved/${name}/index.js`,
    importModule: async () => ({ default: mod }),
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-err-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-err-h-'));
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'content');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('honors an absolute destination', async () => {
    const absDest = path.join(historyDir, 'absolute-target');
    const organizer = new Organizer({ historyDir });

    const result = await organizer.organize(testDir, {
      rules: [{ name: 'Abs', patterns: ['*.jpg'], destination: absDest }],
    });

    expect(result.moved).toHaveLength(1);
    expect(result.moved[0].to).toBe(path.join(absDest, 'photo.jpg'));
    expect(await fs.readFile(result.moved[0].to, 'utf-8')).toBe('content');
  });

  it('skips a file whose destination is its own location', async () => {
    const result = await new Organizer({ historyDir }).organize(testDir, {
      rules: [{ name: 'InPlace', patterns: ['*.jpg'], destination: '.' }],
    });

    expect(result.moved).toHaveLength(0);
    expect(result.skipped).toEqual([
      { file: path.join(testDir, 'photo.jpg'), reason: 'Source and destination are the same' },
    ]);
  });

  it('reports a per-file move failure without aborting the run', async () => {
    // A FILE where the destination needs a directory: ensureDir cannot recover.
    await fs.writeFile(path.join(testDir, 'blocker'), 'not a directory');

    const result = await new Organizer({ historyDir }).organize(testDir, {
      rules: [{ name: 'Blocked', patterns: ['*.jpg'], destination: './blocker/sub' }],
    });

    expect(result.moved).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe(path.join(testDir, 'photo.jpg'));
    expect(result.errors[0].error).toBeTruthy();
  });

  it('reports an afterOrganize hook failure in pluginErrors', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.loadPlugin({
      name: 'after-boom',
      version: '1.0.0',
      async afterOrganize() {
        throw new Error('after exploded');
      },
    });

    const result = await organizer.organize(testDir, { rules });

    expect(result.moved).toHaveLength(1); // moves unaffected
    expect(result.pluginErrors).toEqual([
      { plugin: 'after-boom', hook: 'afterOrganize', error: 'after exploded' },
    ]);
  });

  it('resolves plugin specs against cwd when no pluginBaseDir is given', async () => {
    const organizer = new Organizer({
      historyDir,
      pluginEdges: pluginEdges({ name: 'cwd-plugin', version: '1.0.0' }),
    });

    await organizer.organize(testDir, { rules, plugins: ['some-plugin'] });

    expect(organizer.listPlugins().map((p) => p.name)).toContain('cwd-plugin');
  });

  it('does not report an already-injected plugin rule as a config conflict', async () => {
    const organizer = new Organizer({ historyDir });
    organizer.loadPlugin({
      name: 'provider',
      version: '1.0.0',
      customRules: () => [
        { name: 'PluginRule', patterns: ['*.jpg'], destination: './from-plugin' },
      ],
    });

    await organizer.organize(testDir, { rules, dryRun: true }); // injects PluginRule
    // Second pass WITHOUT `rules`: setRules() is not called, so the engine still
    // holds the plugin rule. It is ours — re-reporting it as a config conflict
    // would be a false positive.
    const second = await organizer.organize(testDir, { dryRun: true });

    expect(second.pluginErrors ?? []).toHaveLength(0);
  });

  describe('undo failure paths', () => {
    /** Organize over an existing destination so `replaced` is populated. */
    async function organizeWithOverwrite(): Promise<Organizer> {
      await fs.ensureDir(path.join(testDir, 'out'));
      await fs.writeFile(path.join(testDir, 'out', 'photo.jpg'), 'old');
      const organizer = new Organizer({ historyDir });
      const config: OrganizeConfig = { rules, conflictResolution: 'overwrite' };
      const result = await organizer.organize(testDir, { config });
      expect(result.moved).toHaveLength(1);
      return organizer;
    }

    it('reports a per-file revert failure and still clears history', async () => {
      const organizer = await organizeWithOverwrite();
      // Removing a backup is the one step with no filesystem recovery; if it
      // fails, the revert of that file is reported instead of aborting.
      vi.spyOn(fs, 'remove').mockRejectedValueOnce(new Error('EBUSY: locked'));

      const result = await organizer.undo();

      expect(result).not.toBeNull();
      expect(result!.errors).toHaveLength(1);
      expect(result!.errors[0].error).toBe('EBUSY: locked');
      expect(await organizer.getHistory()).toEqual([]);
    });

    it('reports a restore failure when the destination vanished mid-undo', async () => {
      const organizer = await organizeWithOverwrite();
      // The destination directory is gone and its name is taken by a file, so
      // the clobbered file cannot be put back where it belongs.
      await fs.remove(path.join(testDir, 'out'));
      await fs.writeFile(path.join(testDir, 'out'), 'not a directory');

      const result = await organizer.undo();

      expect(result).not.toBeNull();
      expect(result!.errors).toHaveLength(1);
      expect(result!.errors[0].file).toBe(path.join(testDir, 'out', 'photo.jpg'));
      expect(await organizer.getHistory()).toEqual([]);
    });
  });
});
