import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, runCommand, writeConfig, writeFixture } from './cli-harness.js';
import type { Rule } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-6: `src/cli/commands/organize.ts` at 100%.
 * The confirmation and conflict prompts are replaced at the prompts boundary;
 * the organizer, scanner and config loader all run for real against temp dirs.
 */
const { promptForConflictResolutionMock, confirmActionMock } = vi.hoisted(() => ({
  promptForConflictResolutionMock: vi.fn(),
  confirmActionMock: vi.fn(),
}));

vi.mock('../../src/cli/ui/prompts.js', () => ({
  promptForRule: vi.fn(),
  selectRule: vi.fn(),
  promptForConflictResolution: promptForConflictResolutionMock,
  confirmAction: confirmActionMock,
}));

const ctx = cliTestContext('organize-command');

const images: Rule = { name: 'Images', patterns: ['*.jpg'], destination: './images' };

beforeEach(() => {
  promptForConflictResolutionMock.mockReset();
  confirmActionMock.mockReset();
});

async function loadOrganizeCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/organize.js')).organizeCommand;
}

function seedPhotos(count: number): void {
  for (let index = 0; index < count; index++) {
    writeFixture(ctx.dir, `photo-${index}.jpg`, 'x');
  }
}

describe('organize', () => {
  it('previews a dry run without moving anything', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(2);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '--dry-run']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('[DRY RUN]');
    expect(ctx.text()).toContain('Files to move: 2');
    expect(await fs.pathExists(path.join(ctx.dir, 'images', 'photo-0.jpg'))).toBe(false);
  });

  it('moves the files on a real run and points at undo', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(2);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '-y']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Successfully organized 2 files');
    expect(ctx.text()).toContain('fo undo');
    expect(await fs.pathExists(path.join(ctx.dir, 'images', 'photo-0.jpg'))).toBe(true);
  });

  it('emits JSON on stdout and stays non-interactive with --json', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(2);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '--json']);

    const payload = JSON.parse(ctx.stdout);
    expect(payload.dryRun).toBe(false);
    expect(payload.moved).toHaveLength(2);
    expect(ctx.captured.log).toHaveLength(0);
    expect(confirmActionMock).not.toHaveBeenCalled();
  });

  it('discovers the config by walking up from the source directory', async () => {
    writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(1);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '--dry-run']);

    expect(ctx.text()).toContain('Found config');
    expect(process.exitCode).toBe(0);
  });

  it('fails when no config can be found', async () => {
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('reports an empty result when nothing matches', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '-y']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('No files to organize.');
  });

  it('warns about unknown template variables before moving', async () => {
    const configPath = writeConfig(ctx.dir, {
      rules: [{ name: 'Typo', patterns: ['*.x'], destination: './{quartal}' }],
    });
    writeFixture(ctx.dir, 'a.x', 'x');
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '--dry-run']);

    expect(ctx.text()).toContain('unknown template variable');
  });

  it('honors --conflict by overwriting the existing file', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    writeFixture(ctx.dir, 'photo-0.jpg', 'fresh');
    writeFixture(ctx.dir, 'images/photo-0.jpg', 'stale');
    const command = await loadOrganizeCommand();

    await runCommand(command, [
      ctx.dir,
      '-c',
      configPath,
      '--conflict',
      'overwrite',
      '-y',
    ]);

    expect(process.exitCode).toBe(0);
    expect(await fs.readFile(path.join(ctx.dir, 'images', 'photo-0.jpg'), 'utf-8')).toBe('fresh');
  });

  it('asks for the conflict strategy with --interactive', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(1);
    promptForConflictResolutionMock.mockResolvedValue('skip');
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath, '--interactive', '-y']);

    expect(promptForConflictResolutionMock).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  it('applies a small real run without prompting (below the confirmation threshold)', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(2);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath]);

    expect(confirmActionMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
    expect(await fs.pathExists(path.join(ctx.dir, 'images', 'photo-0.jpg'))).toBe(true);
  });

  it('confirms a large run, then applies it', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(20);
    confirmActionMock.mockResolvedValue(true);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath]);

    expect(ctx.text()).toContain('This would move 20 files');
    expect(await fs.pathExists(path.join(ctx.dir, 'images', 'photo-0.jpg'))).toBe(true);
  });

  it('aborts a large run when the confirmation is declined', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    seedPhotos(20);
    confirmActionMock.mockResolvedValue(false);
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', configPath]);

    expect(ctx.text()).toContain('Aborted');
    expect(await fs.pathExists(path.join(ctx.dir, 'images', 'photo-0.jpg'))).toBe(false);
  });

  it('reports a failure to load the config', async () => {
    const command = await loadOrganizeCommand();

    await runCommand(command, [ctx.dir, '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Organization failed: Config file not found');
  });
});

describe('organize with a stubbed loader', () => {
  afterEach(() => {
    vi.doUnmock('../../src/config/loader.js');
  });

  it('reports a non-Error failure as an unknown error', async () => {
    const plainFailure = 'plain failure';
    vi.resetModules();
    vi.doMock('../../src/config/loader.js', () => ({
      loadConfig: async () => {
        throw plainFailure;
      },
      findConfigPath: () => null,
    }));
    const { organizeCommand } = await import('../../src/cli/commands/organize.js');

    await runCommand(organizeCommand, [ctx.dir, '-c', 'any.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Organization failed: Unknown error');
  });
});
