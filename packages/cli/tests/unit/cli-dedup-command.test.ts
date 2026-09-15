import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, runCommand, writeFixture } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-7: `src/cli/commands/dedup.ts` at 100%.
 * Duplicate detection runs against real temp files (the size-grouping and
 * hashing are real); only the confirmation prompt and the failure-injection
 * cases are stubbed.
 */
const { confirmActionMock } = vi.hoisted(() => ({ confirmActionMock: vi.fn() }));

vi.mock('../../src/cli/ui/prompts.js', () => ({
  promptForRule: vi.fn(),
  selectRule: vi.fn(),
  promptForConflictResolution: vi.fn(),
  confirmAction: confirmActionMock,
}));

const ctx = cliTestContext('dedup-command');

beforeEach(() => {
  confirmActionMock.mockReset();
});

async function loadDedupCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/dedup.js')).dedupCommand;
}

function seedDuplicates(): void {
  writeFixture(ctx.dir, 'a.txt', 'duplicate-content');
  writeFixture(ctx.dir, 'b.txt', 'duplicate-content');
}

/**
 * Pin both duplicates' mtimes so "keep the newest" is a deterministic pick.
 * The two callers below pass opposite orders, which exercises both sides of the
 * `b.mtime > a.mtime` comparison whichever order the scanner returns.
 */
function seedDuplicatesWithMtimes(aTime: string, bTime: string): void {
  seedDuplicates();
  for (const [name, iso] of [
    ['a.txt', aTime],
    ['b.txt', bTime],
  ] as const) {
    const when = new Date(iso);
    fs.utimesSync(path.join(ctx.dir, name), when, when);
  }
}

describe('dedup', () => {
  it('reports when there are no duplicates', async () => {
    writeFixture(ctx.dir, 'only.txt', 'nothing to compare');
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('No duplicates found.');
  });

  it('lists the duplicate groups without deleting anything', async () => {
    seedDuplicates();
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Duplicate group (2 copies');
    expect(ctx.text()).toContain('[keep: newest]');
    expect(ctx.text()).toContain('Total recoverable space');
    expect(await fs.pathExists(`${ctx.dir}/a.txt`)).toBe(true);
    expect(await fs.pathExists(`${ctx.dir}/b.txt`)).toBe(true);
  });

  it('finds duplicates in subdirectories with --recursive', async () => {
    writeFixture(ctx.dir, 'nested/a.txt', 'duplicate-content');
    writeFixture(ctx.dir, 'nested/b.txt', 'duplicate-content');
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir, '-r']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Duplicate group (2 copies');
  });

  it('moves duplicates to the restorable backup with --delete and -y', async () => {
    seedDuplicatesWithMtimes('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir, '--delete', '-y']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Moved 1 duplicate file(s) to backup');
    // b.txt is the newer copy, so it is the one kept.
    expect(await fs.pathExists(path.join(ctx.dir, 'b.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(ctx.dir, 'a.txt'))).toBe(false);
  });

  it('deletes the older copy even when the newest is scanned first', async () => {
    seedDuplicatesWithMtimes('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z');
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir, '--delete', '-y']);

    expect(process.exitCode).toBe(0);
    expect(await fs.pathExists(path.join(ctx.dir, 'a.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(ctx.dir, 'b.txt'))).toBe(false);
  });

  it('asks before deleting when -y is omitted, and proceeds when confirmed', async () => {
    seedDuplicates();
    confirmActionMock.mockResolvedValue(true);
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir, '--delete']);

    expect(confirmActionMock).toHaveBeenCalled();
    expect(ctx.text()).toContain('Moved 1 duplicate file(s) to backup');
  });

  it('aborts when the confirmation is declined', async () => {
    seedDuplicates();
    confirmActionMock.mockResolvedValue(false);
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir, '--delete']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Aborted — nothing moved.');
    expect(await fs.pathExists(`${ctx.dir}/a.txt`)).toBe(true);
  });

  it('reports a failure to scan the directory', async () => {
    const command = await loadDedupCommand();

    await runCommand(command, [`${ctx.dir}/missing`, '-r']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Dedup failed:');
  });

  it('does not report same-size files as duplicates when their content differs', async () => {
    // Same byte length, different bytes: groups by size first, but the
    // per-hash bucket for each file ends up with only one entry — the
    // "dupes.length >= 2" branch that pushes a group must stay false here.
    writeFixture(ctx.dir, 'a.txt', 'aaaa');
    writeFixture(ctx.dir, 'b.txt', 'bbbb');
    const command = await loadDedupCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('No duplicates found.');
  });
});

describe('dedup with a failing backup store', () => {
  afterEach(() => {
    vi.doUnmock('../../src/core/organizer.js');
  });

  function stubOrganizer(failure: string | Error): void {
    vi.resetModules();
    vi.doMock('../../src/core/organizer.js', () => ({
      Organizer: class {
        async backupForRemoval(): Promise<string> {
          throw failure;
        }
        async recordRemovals(): Promise<void> {}
      },
    }));
  }

  it('reports the removal failure and fails the run', async () => {
    seedDuplicates();
    stubOrganizer(new Error('locked by another process'));
    const { dedupCommand } = await import('../../src/cli/commands/dedup.js');

    await runCommand(dedupCommand, [ctx.dir, '--delete', '-y']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('locked by another process');
    expect(ctx.text()).toContain('could not be removed');
  });

  it('reports a non-Error removal failure as an unknown error', async () => {
    seedDuplicates();
    stubOrganizer('plain failure');
    const { dedupCommand } = await import('../../src/cli/commands/dedup.js');

    await runCommand(dedupCommand, [ctx.dir, '--delete', '-y']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Unknown error');
  });
});

describe('dedup with a failing scanner', () => {
  afterEach(() => {
    vi.doUnmock('../../src/core/file-scanner.js');
  });

  it('reports a non-Error scan failure as an unknown error', async () => {
    const plainFailure = 'scan exploded';
    vi.resetModules();
    vi.doMock('../../src/core/file-scanner.js', () => ({
      FileScanner: class {
        async scan(): Promise<never> {
          throw plainFailure;
        }
      },
    }));
    const { dedupCommand } = await import('../../src/cli/commands/dedup.js');

    await runCommand(dedupCommand, [ctx.dir]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Dedup failed: Unknown error');
  });
});
