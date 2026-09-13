import { describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext } from './cli-harness.js';
import type { Command } from 'commander';

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
    const { hookSpy } = await loadCliEntry();
    const logger = await import('../../src/utils/logger.js');

    const hookCall = hookSpy.mock.calls.find((call) => call[0] === 'preAction');
    expect(hookCall, 'no preAction hook was registered').toBeDefined();
    const hook = hookCall?.[1] as (command: { opts: () => GlobalOptions }) => void;

    hook({ opts: () => ({ verbose: true }) });
    expect(logger.getLogLevel()).toBe('debug');

    hook({ opts: () => ({ quiet: true }) });
    expect(logger.getLogLevel()).toBe('error');

    hook({ opts: () => ({}) });
    expect(logger.getLogLevel()).toBe('error');

    const logFile = path.join(ctx.dir, 'cli.log');
    hook({ opts: () => ({ logFile }) });
    // The level is still 'error' from the --quiet case, so log at that level.
    logger.error('routed to the configured file');
    expect(await fs.readFile(logFile, 'utf-8')).toContain('routed to the configured file');
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
