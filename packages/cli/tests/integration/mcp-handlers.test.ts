import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { handleToolCall } from '../../src/mcp/server.js';
import { validateAndNormalizeConfig } from '../../src/config/loader.js';

describe('MCP tool handlers', () => {
  let testDir: string;
  let configPath: string;
  let historyDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-mcp-'));
    // Isolated history store: these tests must never touch ~/.file-organizer.
    historyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-mcp-h-'));
    configPath = path.join(testDir, '.file-organizer.yaml');
    await fs.writeFile(
      configPath,
      yaml.stringify({
        rules: [
          { name: 'Images', patterns: ['*.jpg'], destination: './images' },
        ],
      })
    );
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'content');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('organize_files: dry-run default does not move files', async () => {
    const outcome = await handleToolCall('organize_files', { source: testDir, config: configPath }, { historyDir });

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;

    expect(outcome.dryRun).toBe(true);
    expect(outcome.result.moved).toHaveLength(1);
    // File untouched
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('organize_files: explicit dryRun:false moves files', async () => {
    const outcome = await handleToolCall(
      'organize_files',
      {
        source: testDir,
        config: configPath,
        dryRun: false,
      },
      { historyDir }
    );

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;

    expect(outcome.dryRun).toBe(false);
    expect(await fs.pathExists(path.join(testDir, 'images', 'photo.jpg'))).toBe(true);
  });

  it('organize_files: errors when no config exists', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-mcp-empty-'));
    try {
      const outcome = await handleToolCall('organize_files', { source: emptyDir });
      expect(outcome.kind).toBe('error');
    } finally {
      await fs.remove(emptyDir);
    }
  });

  it('preview_organization: returns matches without moving', async () => {
    const outcome = await handleToolCall('preview_organization', {
      source: testDir,
      config: configPath,
    }, { historyDir });

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;

    expect(outcome.result.moved).toHaveLength(1);
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('list_rules: returns formatted rules text', async () => {
    const outcome = await handleToolCall('list_rules', { config: configPath });

    expect(outcome.kind).toBe('text');
    if (outcome.kind !== 'text') return;

    expect(outcome.text).toContain('Images');
    expect(outcome.text).toContain('*.jpg');
  });

  it('add_rule: persists a new rule to config', async () => {
    const outcome = await handleToolCall('add_rule', {
      config: configPath,
      name: 'Docs',
      patterns: ['*.pdf'],
      destination: './docs',
    });

    expect(outcome.kind).toBe('text');

    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules).toHaveLength(2);
    expect(saved.rules[1].name).toBe('Docs');
  });

  it('undo_last: undoes the last organize and reports it', async () => {
    // Real run first
    await handleToolCall(
      'organize_files',
      {
        source: testDir,
        config: configPath,
        dryRun: false,
      },
      { historyDir }
    );
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(false);

    const outcome = await handleToolCall('undo_last', {}, { historyDir });

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;

    expect(outcome.result.moved.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.join(testDir, 'photo.jpg'))).toBe(true);
  });

  it('undo_last: reports empty result when history is empty', async () => {
    // Isolated per-test history store → guaranteed empty → deterministic no-op.
    const outcome = await handleToolCall('undo_last', {}, { historyDir });
    expect(outcome.kind).toBe('text');
    if (outcome.kind !== 'text') return;
    expect(outcome.text).toContain('No operations to undo');
  });

  it('unknown tool returns an error', async () => {
    const outcome = await handleToolCall('nonexistent_tool', {});
    expect(outcome.kind).toBe('error');
  });
});

/**
 * Parity between the MCP adapter and the CLI (SPEC-mcp-surface AC-5…AC-10):
 * both resolve config through `buildOrganizeOptions`, so a value honored by one
 * is honored by the other.
 */
describe('MCP tool handlers — config parity', () => {
  let testDir: string;
  let historyDir: string;
  let configPath: string;

  const writeConfig = async (config: Record<string, unknown>) => {
    await fs.writeFile(configPath, yaml.stringify(config));
  };

  beforeEach(async () => {
    // realpath: GitHub's Windows runner has an 8.3 short os.tmpdir()
    // (C:\Users\RUNNER~1\...), which the ESM loader cannot import a plugin from.
    // Same guard as tests/integration/plugin-loader.test.ts.
    testDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fo-mcp-parity-')));
    historyDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fo-mcp-parity-h-')));
    configPath = path.join(testDir, '.file-organizer.yaml');
  });

  afterEach(async () => {
    await fs.remove(testDir);
    await fs.remove(historyDir);
  });

  it('AC-5: honors recursive from config', async () => {
    await fs.ensureDir(path.join(testDir, 'sub'));
    await fs.writeFile(path.join(testDir, 'sub', 'nested.jpg'), 'x');
    await writeConfig({
      recursive: true,
      rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
    });

    const outcome = await handleToolCall(
      'organize_files',
      { source: testDir, config: configPath, dryRun: false },
      { historyDir }
    );

    expect(outcome.kind).toBe('result');
    expect(await fs.pathExists(path.join(testDir, 'images', 'nested.jpg'))).toBe(true);
  });

  it('AC-6: loads plugins from config (config-relative)', async () => {
    await fs.writeFile(
      path.join(testDir, 'plugin.mjs'),
      `export default {
  name: 'parity-plugin',
  version: '1.0.0',
  customRules: () => [{ name: 'Plugin Catch', patterns: ['*.dat'], destination: './plugged' }],
};
`
    );
    await fs.writeFile(path.join(testDir, 'thing.dat'), 'x');
    await writeConfig({ plugins: ['./plugin.mjs'], rules: [] });

    const outcome = await handleToolCall(
      'organize_files',
      { source: testDir, config: configPath, dryRun: false },
      { historyDir }
    );

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;
    expect(outcome.result.pluginErrors ?? []).toEqual([]);
    expect(await fs.pathExists(path.join(testDir, 'plugged', 'thing.dat'))).toBe(true);
  });

  it('AC-7: honors locale from config for {monthName}', async () => {
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'x');
    await writeConfig({
      locale: 'es-ES',
      rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './{monthName}' }],
    });

    const outcome = await handleToolCall(
      'organize_files',
      { source: testDir, config: configPath },
      { historyDir }
    );

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;

    const stats = await fs.stat(path.join(testDir, 'photo.jpg'));
    const expected = stats.mtime.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
    expect(outcome.result.moved[0].to).toContain(expected);
  });

  it('AC-8: honors custom sizeBuckets from config', async () => {
    await fs.writeFile(path.join(testDir, 'blob.bin'), Buffer.alloc(2000));
    await writeConfig({
      sizeBuckets: { small: 1000, medium: 5000 },
      rules: [{ name: 'BySize', patterns: ['*.bin'], destination: './{sizeBucket}' }],
    });

    const outcome = await handleToolCall(
      'organize_files',
      { source: testDir, config: configPath },
      { historyDir }
    );

    expect(outcome.kind).toBe('result');
    if (outcome.kind !== 'result') return;
    // 2000 bytes is "small" by default but "medium" under these thresholds.
    expect(outcome.result.moved[0].to).toContain('medium');
  });

  it('AC-9: add_rule rejects an invalid rule and leaves the config untouched', async () => {
    await writeConfig({ rules: [] });
    const before = await fs.readFile(configPath, 'utf-8');

    const outcome = await handleToolCall('add_rule', {
      config: configPath,
      name: 'Bad',
      patterns: [],
      destination: './x',
    });

    expect(outcome.kind).toBe('error');
    expect(await fs.readFile(configPath, 'utf-8')).toBe(before);
  });

  it('AC-10: a valid add_rule is persisted and validates', async () => {
    await writeConfig({ rules: [] });

    const outcome = await handleToolCall('add_rule', {
      config: configPath,
      name: 'Docs',
      patterns: ['*.pdf'],
      destination: './docs',
    });

    expect(outcome.kind).toBe('text');
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(() => validateAndNormalizeConfig(saved)).not.toThrow();
  });
});
