import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import {
  PluginRegistry,
  PluginNotFoundError,
} from '../../src/core/plugins/loader.js';
import { Organizer } from '../../src/core/organizer.js';
import { loadConfig } from '../../src/config/loader.js';
import type { OrganizerPlugin } from '../../src/core/plugins/contract.js';

const fixturePlugin: OrganizerPlugin = {
  name: 'real-fixture-plugin',
  version: '1.2.3',
  async beforeOrganize() {
    /* no-op */
  },
  customRules() {
    return [];
  },
};

describe('PluginRegistry (integration, real fs + import)', () => {
  const tempDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'fo-plugin-loader-'))
  );

  afterAll(() => {
    fs.removeSync(tempDir);
  });

  it('AC-13: loads a real fixture plugin file end-to-end with default edges', async () => {
    // Written as real ESM on disk, loaded with the REAL dynamic import path
    // (pathToFileURL + import()), exercising the exact production route —
    // including Windows path handling.
    const pluginPath = path.join(tempDir, 'real-fixture-plugin.js');
    await fs.writeFile(
      pluginPath,
      [
        'export default {',
        `  name: ${JSON.stringify(fixturePlugin.name)},`,
        `  version: ${JSON.stringify(fixturePlugin.version)},`,
        '  async beforeOrganize() {},',
        '  customRules() { return []; },',
        '};',
        '',
      ].join('\n'),
      'utf-8'
    );

    const registry = new PluginRegistry();
    const loaded = await registry.load('./real-fixture-plugin.js', { baseDir: tempDir });

    expect(loaded.name).toBe('real-fixture-plugin');
    expect(loaded.version).toBe('1.2.3');
    expect(typeof loaded.beforeOrganize).toBe('function');
    expect(typeof loaded.customRules).toBe('function');
    expect(registry.list()).toHaveLength(1);

    // The hooks are actually invocable after the real import.
    await expect(loaded.beforeOrganize?.({} as never)).resolves.toBeUndefined();
    expect(loaded.customRules?.()).toEqual([]);
  });

  it('AC-13 (negative): a real missing file throws PluginNotFoundError through the real fs edge', async () => {
    const registry = new PluginRegistry();
    await expect(
      registry.load('./does-not-exist.js', { baseDir: tempDir })
    ).rejects.toThrow(/Plugin file not found/);
  });

  it('AC-7 (real edges): an unresolvable npm package throws PluginNotFoundError via createRequire', async () => {
    const registry = new PluginRegistry();
    await expect(
      registry.load('file-organizer-no-such-plugin-xyz', { baseDir: tempDir })
    ).rejects.toThrow(PluginNotFoundError);
  });

  it('AC-6 (real edges): load() without options falls back to process.cwd() as baseDir', async () => {
    // No baseDir passed: the default branch (process.cwd()) must resolve the
    // spec against the real cwd, proving the fallback branch end-to-end.
    const registry = new PluginRegistry();
    await expect(
      registry.load('./definitely-not-here.js')
    ).rejects.toThrow(/Plugin file not found/);
  });

  describe('config-driven organize (SPEC-config-plugins AC-10…AC-12, real fs)', () => {
    let configDir: string;
    let sourceDir: string;
    let historyDir: string;

    const mkdtempRealSync = (prefix: string): string =>
      fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));

    const yamlWith = (plugins: string[]): string =>
      [
        'rules:',
        '  - name: Images',
        '    patterns: ["*.jpg"]',
        '    destination: ./images',
        '',
        'plugins:',
        ...plugins.map((p) => `  - ${JSON.stringify(p)}`),
        '',
      ].join('\n');

    const writePluginModule = async (filePath: string, name: string): Promise<void> => {
      await fs.writeFile(
        filePath,
        [
          'export default {',
          `  name: ${JSON.stringify(name)},`,
          '  version: "1.0.0",',
          '  async beforeOrganize() {},',
          '};',
          '',
        ].join('\n'),
        'utf-8'
      );
    };

    const snapshotDir = async (dir: string): Promise<string> => {
      const walk = async (current: string): Promise<string[]> => {
        const entries = (await fs.readdir(current)).sort();
        const parts: string[] = [];
        for (const entry of entries) {
          const entryPath = path.join(current, entry);
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory()) {
            parts.push(`${entry}/`, ...(await walk(entryPath)));
          } else {
            parts.push(`${entry}:${await fs.readFile(entryPath, 'utf-8')}`);
          }
        }
        return parts;
      };
      return JSON.stringify(await walk(dir));
    };

    const cleanupAll: string[] = [];
    afterAll(async () => {
      await Promise.all(cleanupAll.map((dir) => fs.remove(dir)));
    });

    it('AC-10: organize end-to-end loads a real plugin declared in a real YAML', async () => {
      configDir = mkdtempRealSync('fo-cfg-pl-');
      sourceDir = mkdtempRealSync('fo-cfg-src-');
      historyDir = mkdtempRealSync('fo-cfg-h-');
      cleanupAll.push(configDir, sourceDir, historyDir);

      await writePluginModule(path.join(configDir, 'real-config-plugin.js'), 'config-plugin');
      await fs.writeFile(path.join(configDir, '.file-organizer.yaml'), yamlWith(['./real-config-plugin.js']), 'utf-8');
      await fs.writeFile(path.join(sourceDir, 'photo.jpg'), 'x', 'utf-8');

      const config = await loadConfig(path.join(configDir, '.file-organizer.yaml'));
      const organizer = new Organizer({ historyDir });

      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(result.moved).toHaveLength(1);
      expect(organizer.listPlugins().map((p) => p.name)).toEqual(['config-plugin']);
    });

    it('AC-11: a broken spec aborts organize and leaves the directory byte-identical', async () => {
      sourceDir = mkdtempRealSync('fo-cfg-src2-');
      historyDir = mkdtempRealSync('fo-cfg-h2-');
      cleanupAll.push(sourceDir, historyDir);
      await fs.writeFile(path.join(sourceDir, 'photo.jpg'), 'x', 'utf-8');
      const before = await snapshotDir(sourceDir);
      const config = await loadConfig(path.join(configDir, '.file-organizer.yaml'));
      const brokenConfig = { ...config, plugins: ['./no-such-plugin.js'] };
      const organizer = new Organizer({ historyDir });

      await expect(
        organizer.organize(sourceDir, { ...brokenConfig, pluginBaseDir: configDir })
      ).rejects.toThrow(/Plugin file not found/);

      expect(await snapshotDir(sourceDir)).toBe(before);
    });

    it('AC-12: config-relative specs resolve against pluginBaseDir, not cwd or sourceDir', async () => {
      sourceDir = mkdtempRealSync('fo-cfg-src3-');
      historyDir = mkdtempRealSync('fo-cfg-h3-');
      cleanupAll.push(sourceDir, historyDir);
      await fs.writeFile(path.join(sourceDir, 'photo.jpg'), 'x', 'utf-8');
      // Plugin lives under cfg/plugins/, YAML declares './plugins/x.js',
      // source dir is a different tree entirely — only pluginBaseDir works.
      await fs.ensureDir(path.join(configDir, 'plugins'));
      await writePluginModule(path.join(configDir, 'plugins', 'nested-plugin.js'), 'nested-plugin');
      await fs.writeFile(
        path.join(configDir, 'nested.yaml'),
        yamlWith(['./plugins/nested-plugin.js']),
        'utf-8'
      );

      const config = await loadConfig(path.join(configDir, 'nested.yaml'));
      const organizer = new Organizer({ historyDir });

      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(organizer.listPlugins().map((p) => p.name)).toContain('nested-plugin');
      expect(result.moved.length).toBeGreaterThan(0);
    });

    it('AC-8: a real plugin hook runs end-to-end and sees real scanned files', async () => {
      // Everything real: YAML on disk, plugin module on disk, native import(),
      // hook executed inside a real organize run. The hook writes a marker
      // file naming the scanned files — proof of real context data.
      sourceDir = mkdtempRealSync('fo-cfg-src4-');
      historyDir = mkdtempRealSync('fo-cfg-h4-');
      cleanupAll.push(sourceDir, historyDir);
      await fs.writeFile(path.join(sourceDir, 'holiday.jpg'), 'x', 'utf-8');

      await fs.writeFile(
        path.join(configDir, 'marker-plugin.js'),
        [
          'import fs from "fs";',
          'import path from "path";',
          'export default {',
          '  name: "marker-plugin",',
          '  version: "1.0.0",',
          '  async beforeOrganize(context) {',
          '    const names = context.files.map((f) => f.name).sort().join(",");',
          '    fs.writeFileSync(path.join(context.source, "hook-marker.txt"), names);',
          '  },',
          '};',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(configDir, 'marker.yaml'),
        yamlWith(['./marker-plugin.js']),
        'utf-8'
      );

      const config = await loadConfig(path.join(configDir, 'marker.yaml'));
      const organizer = new Organizer({ historyDir });

      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(result.pluginErrors).toBeUndefined(); // healthy hook
      expect(result.moved).toHaveLength(1);
      expect(
        await fs.readFile(path.join(sourceDir, 'hook-marker.txt'), 'utf-8')
      ).toBe('holiday'); // context.files had the real scanned file
      expect(organizer.listPlugins().map((p) => p.name)).toContain('marker-plugin');
    });

    it('AC-9 (plugin-rules): a real plugin customRules captures previously unmatched files', async () => {
      // other.xyz matches nothing in the YAML rules; the plugin's rule adds it.
      sourceDir = mkdtempRealSync('fo-cfg-src5-');
      historyDir = mkdtempRealSync('fo-cfg-h5-');
      cleanupAll.push(sourceDir, historyDir);
      await fs.writeFile(path.join(sourceDir, 'other.xyz'), 'x', 'utf-8');

      await fs.writeFile(
        path.join(configDir, 'xyz-plugin.js'),
        [
          'export default {',
          '  name: "xyz-plugin",',
          '  version: "1.0.0",',
          '  customRules() {',
          '    return [{ name: "XyzCapture", patterns: ["*.xyz"], destination: "./xyz-land", priority: 25 }];',
          '  },',
          '};',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(configDir, 'xyz.yaml'),
        yamlWith(['./xyz-plugin.js']), // plugin also declared in config; loader dedups
        'utf-8'
      );

      const config = await loadConfig(path.join(configDir, 'xyz.yaml'));
      const organizer = new Organizer({ historyDir });
      const loaded = await organizer.loadSpec('./xyz-plugin.js', { baseDir: configDir });
      expect(loaded.name).toBe('xyz-plugin');

      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(result.pluginErrors).toBeUndefined();
      expect(result.moved).toHaveLength(1);
      expect(result.moved[0].rule).toBe('XyzCapture');
      expect(result.moved[0].to).toContain('xyz-land');
    });

    it('AC-8 + AC-10 (plugin-transform): transformed metadata drives matching, destination, and beforeOrganize', async () => {
      // The scanner lowercases extensions at scan time, so the honest proof
      // of decision-layer semantics is an extension REMAP (log → txt): the
      // *.txt rule can only match after the transform runs (A/B below).
      sourceDir = mkdtempRealSync('fo-cfg-src6-');
      historyDir = mkdtempRealSync('fo-cfg-h6-');
      const markerDir = mkdtempRealSync('fo-cfg-marker6-');
      cleanupAll.push(sourceDir, historyDir, markerDir);
      const marker = path.join(markerDir, 'extensions.json');

      await fs.writeFile(
        path.join(configDir, 'remap-plugin.js'),
        [
          'import { appendFileSync } from "node:fs";',
          'export default {',
          '  name: "remap-plugin",',
          '  version: "1.0.0",',
          '  async beforeOrganize(context) {',
          `    appendFileSync(${JSON.stringify(marker)}, JSON.stringify(context.files.map((f) => f.extension)));`,
          '  },',
          '  async transform(file) {',
          '    return { ...file, extension: file.extension === "log" ? "txt" : file.extension };',
          '  },',
          '};',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(configDir, 'remap.yaml'),
        [
          'rules:',
          '  - name: Text',
          '    patterns: ["*.txt"]',
          '    destination: ./text',
          '',
          'plugins:',
          '  - "./remap-plugin.js"',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(path.join(sourceDir, 'notes.log'), 'x', 'utf-8');

      const config = await loadConfig(path.join(configDir, 'remap.yaml'));

      // A/B: without plugins, *.txt does not match a .log file.
      const plain = new Organizer({ historyDir });
      const plainResult = await plain.organize(sourceDir, {
        ...config,
        plugins: [],
        pluginBaseDir: configDir,
      });
      expect(plainResult.moved).toHaveLength(0);

      // With the plugin: log remapped to txt → rule matches → the move
      // composes the destination name from transformed metadata (D3).
      const organizer = new Organizer({ historyDir });
      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(result.pluginErrors).toBeUndefined();
      expect(result.moved).toHaveLength(1);
      expect(result.moved[0].to).toContain(path.join('text', 'notes.txt'));
      expect(await fs.pathExists(path.join(sourceDir, 'text', 'notes.txt'))).toBe(true);

      // AC-10: beforeOrganize ran AFTER transforms — it saw the remapped set.
      expect(JSON.parse(await fs.readFile(marker, 'utf-8'))).toEqual(['txt']);
    });

    it('AC-9 (plugin-transform): a failing transform is non-fatal — file kept, rest organized', async () => {
      sourceDir = mkdtempRealSync('fo-cfg-src7-');
      historyDir = mkdtempRealSync('fo-cfg-h7-');
      cleanupAll.push(sourceDir, historyDir);

      await fs.writeFile(
        path.join(configDir, 'failing-tx-plugin.js'),
        [
          'export default {',
          '  name: "failing-tx",',
          '  version: "1.0.0",',
          '  async transform(file) {',
          '    if (file.name === "cursed") throw new Error("nope");',
          '    return { ...file, extension: file.extension === "log" ? "txt" : file.extension };',
          '  },',
          '};',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(
        path.join(configDir, 'failing-tx.yaml'),
        [
          'rules:',
          '  - name: Text',
          '    patterns: ["*.txt"]',
          '    destination: ./text',
          '',
          'plugins:',
          '  - "./failing-tx-plugin.js"',
          '',
        ].join('\n'),
        'utf-8'
      );
      await fs.writeFile(path.join(sourceDir, 'cursed.log'), 'x', 'utf-8');
      await fs.writeFile(path.join(sourceDir, 'fine.log'), 'x', 'utf-8');

      const config = await loadConfig(path.join(configDir, 'failing-tx.yaml'));
      const organizer = new Organizer({ historyDir });
      const result = await organizer.organize(sourceDir, {
        ...config,
        pluginBaseDir: configDir,
      });

      expect(result.pluginErrors).toHaveLength(1);
      expect(result.pluginErrors?.[0]).toMatchObject({
        plugin: 'failing-tx',
        hook: 'transform',
      });
      expect(result.pluginErrors?.[0]?.error).toContain('threw: nope');

      // The healthy file still organized (log → txt); the cursed one kept
      // its extension, matches nothing, and stays untouched on disk.
      expect(result.moved).toHaveLength(1);
      expect(result.moved[0].to).toContain(path.join('text', 'fine.txt'));
      expect(await fs.pathExists(path.join(sourceDir, 'cursed.log'))).toBe(true);
    });
  });
});
