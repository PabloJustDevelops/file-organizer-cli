import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  loadConfig,
  saveConfig,
  findConfigPath,
  initConfig,
  loadAppConfig,
  saveAppConfig,
  validateAndNormalizeConfig,
  DEFAULT_CONFIG,
} from '../../src/config/loader.js';
import type { AppConfig, OrganizeConfig } from '../../src/types/index.js';

/**
 * In-process coverage of the config I/O surface. The E2E suite drives these
 * through the built binary, which runs in a child process — so it never
 * contributes coverage here; these tests exercise the same paths in-process.
 */
describe('config I/O', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-config-io-'));
  });

  afterEach(async () => {
    await fs.remove(dir);
  });

  it('saveConfig writes a file loadConfig reads back identically', async () => {
    const config: OrganizeConfig = {
      rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
      conflictResolution: 'skip',
      recursive: true,
    };
    const configPath = path.join(dir, 'nested', '.file-organizer.yaml');

    await saveConfig(configPath, config);
    const loaded = await loadConfig(configPath);

    expect(loaded.rules).toHaveLength(1);
    expect(loaded.rules[0].name).toBe('Images');
    expect(loaded.conflictResolution).toBe('skip');
    expect(loaded.recursive).toBe(true);
  });

  it('loadConfig throws for a missing file', async () => {
    await expect(loadConfig(path.join(dir, 'nope.yaml'))).rejects.toThrow(
      'Config file not found'
    );
  });

  it('loadConfig surfaces a validation error from a malformed file', async () => {
    const configPath = path.join(dir, '.file-organizer.yaml');
    await fs.writeFile(configPath, 'rules: "not-an-array"\nlocale: 42');

    await expect(loadConfig(configPath)).rejects.toThrow('locale must be a non-empty string');
  });

  it('initConfig writes a starter config that validates', async () => {
    const configPath = path.join(dir, '.file-organizer.yaml');

    await initConfig(configPath);

    expect(await fs.pathExists(configPath)).toBe(true);
    const loaded = await loadConfig(configPath);
    expect(() => validateAndNormalizeConfig(loaded)).not.toThrow();
    expect(loaded.rules.length).toBeGreaterThan(0);
  });

  it('findConfigPath walks up from a nested directory', async () => {
    const configPath = path.join(dir, '.file-organizer.yaml');
    await saveConfig(configPath, { rules: [] });
    const nested = path.join(dir, 'a', 'b', 'c');
    await fs.ensureDir(nested);

    expect(findConfigPath(nested)).toBe(configPath);
  });

  it('findConfigPath recognizes every supported filename', async () => {
    for (const name of [
      '.file-organizer.yml',
      'file-organizer.yaml',
      'file-organizer.yml',
    ]) {
      const base = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-config-name-'));
      try {
        await fs.writeFile(path.join(base, name), 'rules: []\n');
        expect(findConfigPath(base)).toBe(path.join(base, name));
      } finally {
        await fs.remove(base);
      }
    }
  });

  it('findConfigPath returns null when nothing is found up the tree', async () => {
    // A fresh temp dir has no config in it or its ancestors (on CI, at least).
    expect(findConfigPath(dir)).toBeNull();
  });

  it('app config round-trips through an isolated cwd', async () => {
    const fresh = await loadAppConfig(dir);
    expect(fresh).toEqual(DEFAULT_CONFIG);

    const custom: AppConfig = {
      ...DEFAULT_CONFIG,
      historySize: 7,
      logLevel: 'debug',
    };
    await saveAppConfig(custom, dir);

    expect(await loadAppConfig(dir)).toEqual(custom);
  });
});
