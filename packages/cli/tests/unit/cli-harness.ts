import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import yaml from 'yaml';
import { afterEach, beforeEach, vi } from 'vitest';
import type { Command } from 'commander';
import type { OrganizeConfig } from '../../src/types/index.js';

/**
 * Shared harness for in-process adapter tests (SPEC-adapter-coverage §3).
 *
 * The E2E suite drives the built binary in a child process, so it earns no v8
 * coverage. These helpers exercise the adapters *in this process* instead:
 * real temp dirs for anything the adapters hand to `fs-extra`, and stdio
 * captured the same way `tests/unit/logger.test.ts` captures the console.
 */

// Built from a char code so the source carries no literal control character
// (eslint/no-control-regex).
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export interface CapturedOutput {
  log: string[];
  warn: string[];
  error: string[];
  stdout: string;
  stderr: string;
}

export interface CliTestContext {
  /** Per-test temp directory, removed after the test. */
  readonly dir: string;
  readonly captured: CapturedOutput;
  /** Everything written to the real stdout (`process.stdout.write`) — the JSON channel. */
  readonly stdout: string;
  /** All captured console output, ANSI-stripped and joined. */
  text(): string;
  file(relativePath: string): string;
}

function emptyCapture(): CapturedOutput {
  return { log: [], warn: [], error: [], stdout: '', stderr: '' };
}

/**
 * Register `beforeEach`/`afterEach` for an adapter test: fresh temp dir, fresh
 * stdio capture, and `process.exitCode` reset to 0 both ways.
 *
 * The reset matters: the commands signal failure with `process.exitCode = 1`
 * (SPEC-cli-contract), so a leaked value would fail the whole vitest process.
 */
export function cliTestContext(label: string): CliTestContext {
  let dir = '';
  let captured = emptyCapture();
  let previousHome: string | undefined;
  let previousUserProfile: string | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), `fo-cli-${label}-`));
    captured = emptyCapture();

    // The adapters resolve defaults from `process.cwd()` (`findConfigPath`,
    // default `[source]`); pinning it to the temp dir makes those deterministic.
    // A spy, not `process.chdir` — vitest runs tests in workers, which reject
    // `chdir`.
    vi.spyOn(process, 'cwd').mockReturnValue(dir);

    // HistoryStore reads `os.homedir()` at *module load*, so the isolation has
    // to be in place before the adapter module is imported. Tests therefore
    // import through `resetModules()` + dynamic import.
    //
    // `os.homedir()` is mocked rather than only relocating HOME: Node caches
    // the first result for the life of the process, so moving the env vars
    // after any earlier call would silently keep writing to the real
    // `~/.file-organizer`. The env vars still move `conf`'s OS config dir.
    previousHome = process.env.HOME;
    previousUserProfile = process.env.USERPROFILE;
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
    vi.spyOn(os, 'homedir').mockReturnValue(dir);

    vi.spyOn(console, 'log').mockImplementation((...args: Parameters<typeof console.log>) => {
      captured.log.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: Parameters<typeof console.warn>) => {
      captured.warn.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'error').mockImplementation((...args: Parameters<typeof console.error>) => {
      captured.error.push(args.map(String).join(' '));
    });
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      captured.stdout += chunk.toString();
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      captured.stderr += chunk.toString();
      return true;
    });

    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    if (dir) fs.removeSync(dir);
  });

  return {
    get dir() {
      return dir;
    },
    get captured() {
      return captured;
    },
    get stdout() {
      return captured.stdout;
    },
    text() {
      return stripAnsi(
        [...captured.log, ...captured.warn, ...captured.error].join('\n')
      );
    },
    file(relativePath: string) {
      return path.join(dir, relativePath);
    },
  };
}

/**
 * Run a commander command's action in-process.
 *
 * `argv` is what follows the command's own name. For a command group
 * (`rulesCommand`, `configCommand`) start with the subcommand — `['list', …]`.
 * For a leaf command (`organizeCommand`, `undoCommand`) start with its first
 * own argument — `['.', '-y']`, never `['organize', …]`: `from: 'user'` makes
 * commander read the array as arguments, so a leading command name would be
 * swallowed as a positional.
 */
export async function runCommand(command: Command, argv: string[]): Promise<void> {
  await command.parseAsync(argv, { from: 'user' });
}

/** Write a config file the adapters can load, returning its path. */
export function writeConfig(dir: string, config: OrganizeConfig): string {
  const configPath = path.join(dir, '.file-organizer.yaml');
  fs.writeFileSync(configPath, yaml.stringify(config), 'utf-8');
  return configPath;
}

/** Write a plain file fixture, creating parent directories. */
export function writeFixture(dir: string, relativePath: string, content: string): string {
  const full = path.join(dir, relativePath);
  fs.ensureDirSync(path.dirname(full));
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}
