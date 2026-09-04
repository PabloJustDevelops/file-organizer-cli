import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import yaml from 'yaml';
import { handleToolCall } from '../../src/mcp/server.js';

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
