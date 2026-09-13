import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cliTestContext, runCommand } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-8: `src/cli/commands/tui.ts` at 100%.
 *
 * `canEnableRawMode` is platform- and terminal-dependent, so both are pinned per
 * test instead of depending on the runner's OS (ADR-0002: deterministic tests).
 * The TUI stack (ink/react/App) is mocked: nothing is rendered.
 */
const { renderMock, createElementMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
  createElementMock: vi.fn(() => ({ type: 'element' })),
}));

vi.mock('ink', () => ({ render: renderMock }));
vi.mock('react', () => ({ default: { createElement: createElementMock } }));
vi.mock('../../src/tui/App.js', () => ({
  App: function App() {
    return null;
  },
}));

const ctx = cliTestContext('tui-command');

const originalPlatform = process.platform;
const originalSetRawMode = process.stdin.setRawMode;
const TERMINAL_ENV_VARS = ['WT_SESSION', 'TERM_PROGRAM', 'TMUX'];

function setPlatform(value: string): void {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

function setRawMode(value: ((mode: boolean) => void) | undefined): void {
  Object.defineProperty(process.stdin, 'setRawMode', {
    value,
    configurable: true,
    writable: true,
  });
}

function clearTerminalEnv(): void {
  for (const name of TERMINAL_ENV_VARS) delete process.env[name];
}

beforeEach(() => {
  renderMock.mockReset();
  createElementMock.mockClear();
  clearTerminalEnv();
});

afterEach(() => {
  setPlatform(originalPlatform);
  setRawMode(originalSetRawMode);
  clearTerminalEnv();
});

async function loadTuiCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/tui.js')).tuiCommand;
}

async function expectRenders(): Promise<void> {
  const command = await loadTuiCommand();

  await runCommand(command, [ctx.dir]);

  expect(process.exitCode).toBe(0);
  expect(renderMock).toHaveBeenCalledOnce();
  expect(createElementMock).toHaveBeenCalledWith(expect.any(Function), {
    source: ctx.dir,
    configPath: undefined,
  });
}

async function expectRefusesToStart(): Promise<void> {
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
  const command = await loadTuiCommand();

  await expect(runCommand(command, [ctx.dir])).rejects.toThrow('process.exit called');

  expect(ctx.text()).toContain('TUI requires a terminal with raw mode support.');
  expect(renderMock).not.toHaveBeenCalled();
}

describe('fo tui', () => {
  it('starts on a platform where raw mode is always available', async () => {
    setPlatform('linux');

    await expectRenders();
  });

  it('passes an explicit config path through to the app', async () => {
    setPlatform('linux');
    const command = await loadTuiCommand();

    await runCommand(command, [ctx.dir, '-c', 'custom.yaml']);

    expect(createElementMock).toHaveBeenCalledWith(expect.any(Function), {
      source: ctx.dir,
      configPath: 'custom.yaml',
    });
  });

  it('refuses to start on a bare Windows console', async () => {
    setPlatform('win32');
    setRawMode(vi.fn());

    await expectRefusesToStart();
  });

  it('refuses to start when the terminal cannot do raw mode', async () => {
    setPlatform('win32');
    process.env.WT_SESSION = '1';
    setRawMode(undefined);

    await expectRefusesToStart();
  });

  it('refuses to start when enabling raw mode throws', async () => {
    setPlatform('win32');
    process.env.WT_SESSION = '1';
    setRawMode(() => {
      throw new Error('not a tty');
    });

    await expectRefusesToStart();
  });

  it.each([
    ['Windows Terminal', 'WT_SESSION'],
    ['WezTerm', 'TERM_PROGRAM'],
  ])('starts inside %s', async (_label, envName) => {
    setPlatform('win32');
    process.env[envName] = envName === 'TERM_PROGRAM' ? 'WezTerm' : '1';
    setRawMode(vi.fn());

    await expectRenders();
  });

  it.each(['vscode', 'Orca'])('starts inside %s', async (termProgram) => {
    setPlatform('win32');
    process.env.TERM_PROGRAM = termProgram;
    setRawMode(vi.fn());

    await expectRenders();
  });

  it('starts inside tmux', async () => {
    setPlatform('win32');
    process.env.TMUX = '/tmp/tmux-1000/default,123,0';
    setRawMode(vi.fn());

    await expectRenders();
  });
});
