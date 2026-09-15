import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, runCommand, writeFixture } from './cli-harness.js';
import type { UndoEntry } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-6: `src/cli/commands/undo.ts` at 100%.
 * The undo history is seeded on disk in the isolated HOME, so the real
 * Organizer/HistoryStore restore path runs; only the prompt and the
 * failure-injection cases are stubbed.
 *
 * `undo` reports failures with `process.exit(1)` — a real one would kill the
 * runner, so the error tests stub it to throw.
 */
const { confirmActionMock } = vi.hoisted(() => ({ confirmActionMock: vi.fn() }));

vi.mock('../../src/cli/ui/prompts.js', () => ({
  promptForRule: vi.fn(),
  selectRule: vi.fn(),
  promptForConflictResolution: vi.fn(),
  confirmAction: confirmActionMock,
}));

const ctx = cliTestContext('undo-command');

beforeEach(() => {
  confirmActionMock.mockReset();
});

async function loadUndoCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/undo.js')).undoCommand;
}

function seedHistory(entries: UndoEntry[]): void {
  const historyFile = path.join(ctx.dir, '.file-organizer', 'history.json');
  fs.ensureDirSync(path.dirname(historyFile));
  fs.writeFileSync(
    historyFile,
    JSON.stringify({
      version: 1,
      entries: entries.map((entry) => ({
        id: entry.id,
        timestamp: entry.timestamp.toISOString(),
        operations: entry.operations,
      })),
    }),
    'utf-8'
  );
}

/** A recorded move whose destination still exists, so undo can restore it. */
function seedUndoableMove(): { from: string; to: string } {
  const from = path.join(ctx.dir, 'src', 'photo.jpg');
  const to = path.join(ctx.dir, 'dest', 'photo.jpg');
  writeFixture(ctx.dir, 'dest/photo.jpg', 'x');
  seedHistory([
    {
      id: 'op-1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      operations: [{ from, to, rule: 'Images' }],
    },
  ]);
  return { from, to };
}

describe('undo', () => {
  it('lists the recorded operations with --list', async () => {
    seedUndoableMove();
    const command = await loadUndoCommand();

    await runCommand(command, ['--list']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Operation History:');
    expect(ctx.text()).toContain('op-1'.slice(0, 8));
  });

  it('warns when there is nothing to undo', async () => {
    const command = await loadUndoCommand();

    await runCommand(command, ['-y']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('No operations to undo.');
  });

  it('restores the last operation when confirmed', async () => {
    const { from, to } = seedUndoableMove();
    confirmActionMock.mockResolvedValue(true);
    const command = await loadUndoCommand();

    await runCommand(command, ['--yes']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Undo complete: 1 files restored');
    expect(await fs.pathExists(from)).toBe(true);
    expect(await fs.pathExists(to)).toBe(false);
  });

  it('restores the last operation when the prompt is confirmed (no --yes)', async () => {
    const { from, to } = seedUndoableMove();
    confirmActionMock.mockResolvedValue(true);
    const command = await loadUndoCommand();

    await runCommand(command, []);

    expect(confirmActionMock).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Undo complete: 1 files restored');
    expect(await fs.pathExists(from)).toBe(true);
    expect(await fs.pathExists(to)).toBe(false);
  });

  it('does nothing when the confirmation is declined', async () => {
    const { from } = seedUndoableMove();
    confirmActionMock.mockResolvedValue(false);
    const command = await loadUndoCommand();

    await runCommand(command, []);

    expect(process.exitCode).toBe(0);
    expect(await fs.pathExists(from)).toBe(false);
  });
});

describe('undo with a stubbed organizer', () => {
  afterEach(() => {
    vi.doUnmock('../../src/core/organizer.js');
  });

  function stubOrganizer(behavior: {
    history: UndoEntry[];
    undo: () => Promise<never>;
  }): void {
    vi.resetModules();
    vi.doMock('../../src/core/organizer.js', () => ({
      Organizer: class {
        async getHistory() {
          return behavior.history;
        }
        undo = behavior.undo;
      },
    }));
  }

  const oneEntry: UndoEntry[] = [
    {
      id: 'op-1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      operations: [{ from: '/a/x', to: '/b/x', rule: 'Images' }],
    },
  ];

  it('does nothing when undo returns null', async () => {
    stubOrganizer({ history: oneEntry, undo: async () => null });
    const { undoCommand } = await import('../../src/cli/commands/undo.js');

    await runCommand(undoCommand, ['-y']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).not.toContain('Undo complete');
  });

  it('reports a thrown Error and exits with code 1', async () => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    stubOrganizer({
      history: oneEntry,
      undo: async () => {
        throw new Error('restore failed');
      },
    });
    const { undoCommand } = await import('../../src/cli/commands/undo.js');

    await expect(runCommand(undoCommand, ['-y'])).rejects.toThrow('process.exit called');

    expect(ctx.text()).toContain('Undo failed: restore failed');
  });

  it('reports a non-Error failure as an unknown error', async () => {
    const plainFailure = 'plain failure';
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    stubOrganizer({
      history: oneEntry,
      undo: async () => {
        throw plainFailure;
      },
    });
    const { undoCommand } = await import('../../src/cli/commands/undo.js');

    await expect(runCommand(undoCommand, ['-y'])).rejects.toThrow('process.exit called');

    expect(ctx.text()).toContain('Undo failed: Unknown error');
  });
});
