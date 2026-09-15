import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext } from './cli-harness.js';
import type { Command } from 'commander';
import type { AppConfig } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-9: `src/cli/index.ts` at 100%.
 *
 * The module builds the commander program and calls `program.parse()` at import
 * time, so `parse` is stubbed before the import (and the stub's `this` is how
 * the program is captured — the module exports nothing). The two closures the
 * entry defines — the `preAction` hook and the `init` alias action — are
 * captured through `hook`/`action` and invoked directly, which is the only way
 * to execute them without running the whole CLI.
 */
interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
  logFile?: string;
}

const ctx = cliTestContext('cli-index');

/** Stub the persisted app config's `logLevel` for the preAction hook (SPEC-config C4). */
function stubAppConfigLogLevel(logLevel: AppConfig['logLevel']): void {
  vi.doMock('../../src/config/loader.js', () => ({
    loadAppConfig: async () => ({ logLevel }),
  }));
}

afterEach(() => {
  vi.doUnmock('../../src/config/loader.js');
});

async function loadCliEntry() {
  vi.resetModules();
  const { Command } = await import('commander');

  const parseSpy = vi
    .spyOn(Command.prototype, 'parse')
    .mockImplementation(function (this: Command) {
      return this;
    });
  const hookSpy = vi.spyOn(Command.prototype, 'hook');
  const actionSpy = vi.spyOn(Command.prototype, 'action');

  await import('../../src/cli/index.js');

  // The module exports nothing, so the program is recovered from the `this` the
  // stubbed `parse` was called with.
  const instances = parseSpy.mock.instances;
  const program = instances[instances.length - 1] as Command | undefined;

  return { program, parseSpy, hookSpy, actionSpy };
}

describe('the CLI entrypoint', () => {
  it('builds the program and registers every command under `fo`', async () => {
    const { program } = await loadCliEntry();

    expect(program?.name()).toBe('fo');
    expect(program?.commands.map((command) => command.name()).sort()).toEqual([
      'config',
      'dedup',
      'init',
      'mcp',
      'organize',
      'rules',
      'tui',
      'undo',
      'watch',
    ]);
    expect(program?.version()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does not run the real parser at import time', async () => {
    const { parseSpy } = await loadCliEntry();

    expect(parseSpy).toHaveBeenCalled();
  });

  it('applies --verbose, --quiet and --log-file through the preAction hook', async () => {
    stubAppConfigLogLevel('info');
    const { hookSpy } = await loadCliEntry();
    const logger = await import('../../src/utils/logger.js');

    const hookCall = hookSpy.mock.calls.find((call) => call[0] === 'preAction');
    expect(hookCall, 'no preAction hook was registered').toBeDefined();
    const hook = hookCall?.[1] as (command: { opts: () => GlobalOptions }) => Promise<void>;

    await hook({ opts: () => ({ verbose: true }) });
    expect(logger.getLogLevel()).toBe('debug');

    await hook({ opts: () => ({ quiet: true }) });
    expect(logger.getLogLevel()).toBe('error');

    const logFile = path.join(ctx.dir, 'cli.log');
    await hook({ opts: () => ({ logFile }) });
    // No explicit flag: falls back to the persisted app config, stubbed to 'info' above.
    expect(logger.getLogLevel()).toBe('info');
    logger.error('routed to the configured file');
    expect(await fs.readFile(logFile, 'utf-8')).toContain('routed to the configured file');
  });

  it('SPEC-config C4: --verbose/--quiet win over the persisted logLevel', async () => {
    stubAppConfigLogLevel('error');
    const { hookSpy } = await loadCliEntry();
    const logger = await import('../../src/utils/logger.js');

    const hook = hookSpy.mock.calls.find((call) => call[0] === 'preAction')?.[1] as (command: {
      opts: () => GlobalOptions;
    }) => Promise<void>;

    await hook({ opts: () => ({ verbose: true }) });
    expect(logger.getLogLevel()).toBe('debug');

    await hook({ opts: () => ({ quiet: true }) });
    expect(logger.getLogLevel()).toBe('error');
  });

  it('SPEC-config C4: no flag applies the persisted app config logLevel', async () => {
    stubAppConfigLogLevel('debug');
    const { hookSpy } = await loadCliEntry();
    const logger = await import('../../src/utils/logger.js');

    const hook = hookSpy.mock.calls.find((call) => call[0] === 'preAction')?.[1] as (command: {
      opts: () => GlobalOptions;
    }) => Promise<void>;

    await hook({ opts: () => ({}) });
    expect(logger.getLogLevel()).toBe('debug');
  });

  it('makes `fo init` delegate to `fo config init`', async () => {
    const { actionSpy, parseSpy } = await loadCliEntry();

    // The entry registers its `init` alias last, after every imported command.
    const registered = actionSpy.mock.calls;
    const initAction = registered[registered.length - 1][0] as () => void;
    initAction();

    expect(parseSpy).toHaveBeenLastCalledWith(['fo', 'config', 'init'], { from: 'user' });
  });
});
