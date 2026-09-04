import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Organizer } from '../../src/core/organizer.js';
import type { LoaderEdges } from '../../src/core/plugins/loader.js';
import type { Rule } from '../../src/types/index.js';

describe('Organizer options API', () => {
  let testDir: string;
  let historyDir: string;

  const rules: Rule[] = [
    { name: 'Images', patterns: ['*.jpg'], destination: './{monthName}' },
  ];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-opts-'));
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-opts-h-'));
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'x');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('flat rules option reaches the engine (API unification)', async () => {
    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, { rules, dryRun: true });

    // Previously the flat `rules` option was silently ignored → 0 matches.
    expect(result.moved).toHaveLength(1);
  });

  it('config.rules still works as before', async () => {
    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config: { rules },
      dryRun: true,
    });
    expect(result.moved).toHaveLength(1);
  });

  it('locale option flows through to template resolution (es-ES)', async () => {
    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      rules,
      locale: 'es-ES',
      dryRun: true,
    });

    // {monthName} uses file mtime month in Spanish (septiembre here)
    expect(result.moved[0].to).toContain('septiembre');
  });

  it('locale from config is honored too', async () => {
    const organizer = new Organizer({ historyDir });
    const result = await organizer.organize(testDir, {
      config: { rules, locale: 'es-ES' },
      dryRun: true,
    });
    expect(result.moved[0].to).toContain('septiembre');
  });

  describe('plugins option (SPEC-config-plugins AC-7…AC-9)', () => {
    function pluginEdges(): { edges: LoaderEdges; loadCount(): number } {
      let loads = 0;
      return {
        edges: {
          fileExists: async () => true,
          resolvePackage: (name: string) => `/resolved/${name}/index.js`,
          importModule: async () => {
            loads += 1;
            return {
              default: { name: 'fake-plugin', version: '1.0.0' },
            };
          },
        },
        loadCount: () => loads,
      };
    }

    it('AC-7: valid plugin spec registers before organizing', async () => {
      const { edges } = pluginEdges();
      const organizer = new Organizer({ historyDir, pluginEdges: edges });
      const result = await organizer.organize(testDir, {
        rules,
        plugins: ['./local-plugin.js'],
        pluginBaseDir: testDir,
        dryRun: true,
      });
      expect(result.moved).toHaveLength(1); // organize proceeded
      expect(organizer.listPlugins().map((p) => p.name)).toContain('fake-plugin');
    });

    it('AC-8: unresolvable plugin spec aborts before scanning; no moves', async () => {
      const organizer = new Organizer({
        historyDir,
        pluginEdges: {
          fileExists: async () => false,
          resolvePackage: () => {
            throw new Error('Cannot find module');
          },
        },
      });
      const snapshot = await fs.readFile(path.join(testDir, 'photo.jpg'), 'utf-8');

      await expect(
        organizer.organize(testDir, {
          rules,
          plugins: ['./missing-plugin.js'],
          pluginBaseDir: testDir,
        })
      ).rejects.toThrow(/Plugin file not found/);

      // The file was never touched — the scan never ran.
      expect(await fs.readFile(path.join(testDir, 'photo.jpg'), 'utf-8')).toBe(snapshot);
      expect(await fs.readdir(testDir)).toEqual(['photo.jpg']);
    });

    it('AC-9: duplicate plugin name (programmatic + config) propagates DuplicatePluginError', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({ name: 'fake-plugin', version: '1.0.0' });

      const { edges } = pluginEdges();
      const conflicting = new Organizer({ historyDir, pluginEdges: edges });
      conflicting.loadPlugin({ name: 'fake-plugin', version: '2.0.0' });

      await expect(
        conflicting.organize(testDir, {
          rules,
          plugins: ['./whatever.js'],
          pluginBaseDir: testDir,
          dryRun: true,
        })
      ).rejects.toThrow(/already registered/);
    });

    it('preview + organize double-pass loads each spec exactly once (idempotency)', async () => {
      const { edges, loadCount } = pluginEdges();
      const organizer = new Organizer({ historyDir, pluginEdges: edges });
      const options = {
        rules,
        plugins: ['./local-plugin.js'],
        pluginBaseDir: testDir,
        dryRun: true,
      };

      await organizer.organize(testDir, options); // acts as preview
      await organizer.organize(testDir, options); // acts as the real pass

      expect(loadCount()).toBe(1);
      expect(organizer.listPlugins()).toHaveLength(1);
    });

    it('plugins from config.plugins are consumed identically to the flat option', async () => {
      const { edges } = pluginEdges();
      const organizer = new Organizer({ historyDir, pluginEdges: edges });
      await organizer.organize(testDir, {
        config: { rules, plugins: ['./via-config.js'] },
        pluginBaseDir: testDir,
        dryRun: true,
      });
      expect(organizer.listPlugins().map((p) => p.name)).toContain('fake-plugin');
    });
  });

  describe('plugin hooks wiring (SPEC-plugin-hooks AC-3…AC-5)', () => {
    it('AC-3: a throwing hook is reported in pluginErrors and moves still happen', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'explosive',
        version: '1.0.0',
        async beforeOrganize() {
          throw new Error('hook exploded');
        },
      });

      const result = await organizer.organize(testDir, { rules, dryRun: true });

      expect(result.moved).toHaveLength(1); // moves unaffected
      expect(result.pluginErrors).toEqual([
        { plugin: 'explosive', hook: 'beforeOrganize', error: 'hook exploded' },
      ]);
    });

    it('AC-4: a failing plugin does not block a healthy one', async () => {
      const organizer = new Organizer({ historyDir });
      const ran: string[] = [];
      organizer.loadPlugin({
        name: 'broken',
        version: '1.0.0',
        async beforeOrganize() {
          throw new Error('nope');
        },
        async afterOrganize() {
          ran.push('broken-after'); // isolation: still reached
        },
      });
      organizer.loadPlugin({
        name: 'healthy',
        version: '1.0.0',
        async beforeOrganize() {
          ran.push('healthy-before');
        },
        async afterOrganize() {
          ran.push('healthy-after');
        },
      });

      const result = await organizer.organize(testDir, { rules, dryRun: true });

      expect(ran).toEqual(['healthy-before', 'broken-after', 'healthy-after']);
      expect(result.pluginErrors).toHaveLength(1); // exactly the beforeOrganize failure
      expect(result.pluginErrors?.[0]?.plugin).toBe('broken');
    });

    it('AC-5: no plugins → pluginErrors absent, behavior identical', async () => {
      const organizer = new Organizer({ historyDir });
      const result = await organizer.organize(testDir, { rules, dryRun: true });
      expect(result.moved).toHaveLength(1);
      expect(result.pluginErrors).toBeUndefined();
    });
  });

  describe('plugin rules injection (SPEC-plugin-rules ACs)', () => {
    it('AC-1: plugin rule with higher priority beats the config rule', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'rule-provider',
        version: '1.0.0',
        customRules: () => [
          { name: 'Prio', patterns: ['*.jpg'], destination: './from-plugin', priority: 20 },
        ],
      });

      const result = await organizer.organize(testDir, {
        rules,
        dryRun: true,
      });

      expect(result.moved).toHaveLength(1);
      expect(result.moved[0].rule).toBe('Prio');
      expect(result.moved[0].to).toContain('from-plugin');
      expect(result.pluginErrors).toBeUndefined();
    });

    it('AC-2: invalid plugin rule is captured; valid one from same plugin still works', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'mixed-rules',
        version: '1.0.0',
        customRules: () => [
          { name: 'Broken' }, // no patterns, no destination
          { name: 'Works', patterns: ['*.jpg'], destination: './works', priority: 20 },
        ],
      });

      const result = await organizer.organize(testDir, { rules, dryRun: true });

      expect(result.moved[0].rule).toBe('Works');
      expect(result.pluginErrors).toHaveLength(1);
      expect(result.pluginErrors?.[0]?.hook).toBe('customRules');
      expect(result.pluginErrors?.[0]?.error).toContain('Broken');
    });

    it('AC-4: conflicting rule name → config wins, conflict reported', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'conflictor',
        version: '1.0.0',
        customRules: () => [
          { name: 'Images', patterns: ['*.jpg'], destination: './shadow-attempt' },
        ],
      });

      const result = await organizer.organize(testDir, { rules, dryRun: true });

      expect(result.moved[0].rule).toBe('Images');
      expect(result.moved[0].to).not.toContain('shadow-attempt');
      expect(result.pluginErrors).toHaveLength(1);
      expect(result.pluginErrors?.[0]?.error).toContain('conflicts with an existing config rule');
    });

    it('AC-6: preview + organize double pass injects rules once', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'stable-rules',
        version: '1.0.0',
        customRules: () => [
          { name: 'Stable', patterns: ['*.jpg'], destination: './stable', priority: 20 },
        ],
      });
      const options = { rules, dryRun: true };

      await organizer.organize(testDir, options); // preview pass
      const result = await organizer.organize(testDir, options); // real pass

      expect(result.moved[0].rule).toBe('Stable');
      expect(result.pluginErrors).toBeUndefined(); // no conflict, no duplicate
    });

    it('AC-8: disabled plugin rule is injected but matches nothing', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'disabled-provider',
        version: '1.0.0',
        customRules: () => [
          { name: 'Disabled', patterns: ['*.jpg'], destination: './disabled', enabled: false },
        ],
      });

      const result = await organizer.organize(testDir, { rules: [], dryRun: true });

      // The rule is in the engine but enabled:false matches nothing.
      expect(result.moved).toHaveLength(0);
      expect(result.pluginErrors).toBeUndefined();
    });

    it('AC-10: multiple plugin rules sort among config rules by priority', async () => {
      const organizer = new Organizer({ historyDir });
      organizer.loadPlugin({
        name: 'low-prio',
        version: '1.0.0',
        customRules: () => [
          { name: 'Low', patterns: ['*.jpg'], destination: './low', priority: 5 },
        ],
      });
      organizer.loadPlugin({
        name: 'high-prio',
        version: '1.0.0',
        customRules: () => [
          { name: 'High', patterns: ['*.jpg'], destination: './high', priority: 30 },
        ],
      });

      const result = await organizer.organize(testDir, {
        rules: [{ name: 'Cfg', patterns: ['*.jpg'], destination: './cfg', priority: 10 }],
        dryRun: true,
      });

      expect(result.moved[0].rule).toBe('High');
    });
  });
});