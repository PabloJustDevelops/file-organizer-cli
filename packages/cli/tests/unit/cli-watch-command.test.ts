import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, runCommand, writeConfig } from './cli-harness.js';
import type { Organizer } from '../../src/core/organizer.js';
import type { Rule } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-7: `src/cli/commands/watch.ts` at 100%.
 *
 * The watcher is replaced at its module boundary — a real `chokidar` watcher
 * would keep the process alive and make the suite timing-dependent (ADR-0002).
 * Everything the command does *around* the watcher (debounce validation, config
 * resolution, signal wiring) runs for real.
 */
interface WatcherOptionsSeen {
  debounceMs?: number;
  organizeOnStart?: boolean;
  conflictResolution?: string;
  ignorePatterns?: string[];
  plugins?: string[];
  pluginBaseDir?: string;
}

const { watcherSeen } = vi.hoisted(() => ({
  watcherSeen: [] as Array<{ source: string; options: WatcherOptionsSeen }>,
}));

vi.mock('../../src/core/watcher.js', () => ({
  FolderWatcher: class {
    constructor(_organizer: Organizer, source: string, options: WatcherOptionsSeen) {
      watcherSeen.push({ source, options });
    }
    async start(): Promise<void> {}
    async stop(): Promise<void> {}
  },
}));

const ctx = cliTestContext('watch-command');

const images: Rule = { name: 'Images', patterns: ['*.jpg'], destination: './images' };

beforeEach(() => {
  watcherSeen.length = 0;
});

async function loadWatchCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/watch.js')).watchCommand;
}

describe('watch', () => {
  it.each([
    ['a non-numeric value', 'abc'],
    ['a non-positive value', '0'],
    ['a fractional value', '1.5'],
  ])('rejects %s for --debounce', async (_label, value) => {
    const command = await loadWatchCommand();

    await runCommand(command, [ctx.dir, '--debounce', value]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Invalid --debounce value');
    expect(watcherSeen).toHaveLength(0);
  });

  it('fails when no config can be found', async () => {
    const command = await loadWatchCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('starts the watcher with the resolved options and stops on SIGINT', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    const command = await loadWatchCommand();
    const before = new Set(process.listeners('SIGINT'));

    await runCommand(command, [ctx.dir, '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(watcherSeen).toHaveLength(1);
    expect(watcherSeen[0].source).toBe(ctx.dir);
    expect(watcherSeen[0].options.debounceMs).toBe(1000);
    expect(watcherSeen[0].options.organizeOnStart).toBe(true);
    expect(watcherSeen[0].options.conflictResolution).toBe('rename');
    expect(watcherSeen[0].options.pluginBaseDir).toBe(path.dirname(configPath));

    // Identify the handler by identity diff: counting listeners would also
    // pick up the ones vitest registers on its own process. The watcher's
    // handler is the named one.
    const added = process.listeners('SIGINT').filter((handler) => !before.has(handler));
    const shutdown = added.find((handler) => handler.name === 'shutdown');
    expect(
      shutdown,
      `SIGINT handlers added: ${added.map((handler) => handler.name || '(anonymous)').join(', ')}`
    ).toBeTypeOf('function');

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    await expect((shutdown as () => Promise<void>)()).rejects.toThrow('process.exit called');

    expect(ctx.text()).toContain('[watch] Stopping watcher...');
  });

  it('honors --debounce, --conflict and --no-initial', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    const command = await loadWatchCommand();

    await runCommand(command, [
      ctx.dir,
      '-c',
      configPath,
      '--debounce',
      '250',
      '--conflict',
      'skip',
      '--no-initial',
    ]);

    expect(watcherSeen[0].options.debounceMs).toBe(250);
    expect(watcherSeen[0].options.conflictResolution).toBe('skip');
    expect(watcherSeen[0].options.organizeOnStart).toBe(false);
  });

  it('discovers the config next to the watched directory', async () => {
    writeConfig(ctx.dir, { rules: [images] });
    const command = await loadWatchCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(0);
    expect(watcherSeen).toHaveLength(1);
  });

  it('reports an invalid config', async () => {
    const configPath = path.join(ctx.dir, 'broken.yaml');
    fs.writeFileSync(configPath, 'locale: 42\n', 'utf-8');
    const command = await loadWatchCommand();

    await runCommand(command, [ctx.dir, '-c', configPath]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Watch failed:');
  });
});

describe('watch with a stubbed loader', () => {
  afterEach(() => {
    vi.doUnmock('../../src/config/loader.js');
  });

  function stubLoader(loadConfig: () => Promise<{ rules: Rule[] }>): void {
    vi.resetModules();
    vi.doMock('../../src/config/loader.js', () => ({
      findConfigPath: () => null,
      loadConfig,
      loadAppConfig: async () => ({ watchIgnorePatterns: [] }),
    }));
  }

  it('reports a non-Error failure as an unknown error', async () => {
    const plainFailure = 'plain failure';
    stubLoader(async () => {
      throw plainFailure;
    });
    const { watchCommand } = await import('../../src/cli/commands/watch.js');

    await runCommand(watchCommand, [ctx.dir, '-c', 'any.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Watch failed: Unknown error');
  });

  it('falls back to the rename strategy when the config omits one', async () => {
    stubLoader(async () => ({ rules: [images] }));
    const { watchCommand } = await import('../../src/cli/commands/watch.js');

    await runCommand(watchCommand, [ctx.dir, '-c', 'any.yaml']);

    expect(watcherSeen).toHaveLength(1);
    expect(watcherSeen[0].options.conflictResolution).toBe('rename');
  });
});
