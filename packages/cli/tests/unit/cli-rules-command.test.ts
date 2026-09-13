import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import yaml from 'yaml';
import { cliTestContext, runCommand, writeConfig, writeFixture } from './cli-harness.js';
import type { Rule } from '../../src/types/index.js';

/**
 * SPEC-adapter-coverage AC-5: `src/cli/commands/rules.ts` at 100%.
 * Interactive rule creation/selection is replaced at the prompts boundary;
 * everything else (config I/O, the rules engine) runs for real.
 */
const { promptForRuleMock, selectRuleMock } = vi.hoisted(() => ({
  promptForRuleMock: vi.fn(),
  selectRuleMock: vi.fn(),
}));

vi.mock('../../src/cli/ui/prompts.js', () => ({
  promptForRule: promptForRuleMock,
  selectRule: selectRuleMock,
  promptForConflictResolution: vi.fn(),
  confirmAction: vi.fn(),
}));

const ctx = cliTestContext('rules-command');

const images: Rule = { name: 'Images', patterns: ['*.jpg'], destination: './images' };
const docs: Rule = { name: 'Docs', patterns: ['*.pdf'], destination: './docs' };

beforeEach(() => {
  promptForRuleMock.mockReset();
  selectRuleMock.mockReset();
});

async function loadRulesCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/rules.js')).rulesCommand;
}

describe('rules list', () => {
  it('prints the configured rules', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images, docs] });
    const command = await loadRulesCommand();

    await runCommand(command, ['list', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Images');
    expect(ctx.text()).toContain('Docs');
  });

  it('emits JSON on stdout with --json', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    const command = await loadRulesCommand();

    await runCommand(command, ['list', '-c', configPath, '--json']);

    expect(JSON.parse(ctx.stdout)).toHaveLength(1);
    expect(ctx.captured.log).toHaveLength(0);
  });

  it('fails when no config can be found', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['list']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('fails on an unreadable config', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['list', '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to list rules');
  });
});

describe('rules add', () => {
  it('appends a new rule and persists it', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    promptForRuleMock.mockResolvedValue({ ...docs });
    const command = await loadRulesCommand();

    await runCommand(command, ['add', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('added successfully');
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules.map((r: Rule) => r.name)).toEqual(['Images', 'Docs']);
  });

  it('replaces a rule that already exists', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    const replacement: Rule = { name: 'Images', patterns: ['*.png'], destination: './png' };
    promptForRuleMock.mockResolvedValue(replacement);
    const command = await loadRulesCommand();

    await runCommand(command, ['add', '-c', configPath]);

    expect(ctx.text()).toContain('already exists. Replacing');
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules).toHaveLength(1);
    expect(saved.rules[0].patterns).toEqual(['*.png']);
  });

  it('fails when no config can be found', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['add']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('fails on an unreadable config', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['add', '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to add rule: Config file not found');
  });
});

describe('rules remove', () => {
  it('removes the selected rule and persists the result', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images, docs] });
    selectRuleMock.mockResolvedValue('Images');
    const command = await loadRulesCommand();

    await runCommand(command, ['remove', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Rule "Images" removed');
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules.map((r: Rule) => r.name)).toEqual(['Docs']);
  });

  it('warns when there is nothing to remove', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [] });
    const command = await loadRulesCommand();

    await runCommand(command, ['remove', '-c', configPath]);

    expect(ctx.text()).toContain('No rules to remove.');
    expect(selectRuleMock).not.toHaveBeenCalled();
  });

  it('does nothing when the selection is cancelled', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    selectRuleMock.mockResolvedValue(null);
    const command = await loadRulesCommand();

    await runCommand(command, ['remove', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules).toHaveLength(1);
  });

  it('does nothing when the selection names a rule that no longer exists', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    selectRuleMock.mockResolvedValue('Ghost');
    const command = await loadRulesCommand();

    await runCommand(command, ['remove', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).not.toContain('removed');
    const saved = yaml.parse(await fs.readFile(configPath, 'utf-8'));
    expect(saved.rules).toHaveLength(1);
  });

  it('fails when no config can be found', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['remove']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('fails on an unreadable config', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['remove', '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to remove rule: Config file not found');
  });
});

describe('rules test', () => {
  it('previews how the rules match the files', async () => {
    const configPath = writeConfig(ctx.dir, { rules: [images] });
    writeFixture(ctx.dir, 'photo.jpg', 'x');
    const command = await loadRulesCommand();

    await runCommand(command, ['test', ctx.dir, '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('[DRY RUN]');
    expect(ctx.text()).toContain('Files to move: 1');
  });

  it('fails when no config can be found', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['test', ctx.dir]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('fails on an unreadable config', async () => {
    const command = await loadRulesCommand();

    await runCommand(command, ['test', ctx.dir, '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Test failed: Config file not found');
  });
});

describe('rules with a stubbed loader', () => {
  afterEach(() => {
    vi.doUnmock('../../src/config/loader.js');
  });

  async function loadCommandThrowing(plainFailure: string) {
    vi.resetModules();
    vi.doMock('../../src/config/loader.js', () => ({
      loadConfig: async () => {
        throw plainFailure;
      },
      saveConfig: async () => {
        throw plainFailure;
      },
      findConfigPath: () => null,
    }));
    return (await import('../../src/cli/commands/rules.js')).rulesCommand;
  }

  it.each([
    ['list', ['list', '-c', 'any.yaml'], 'Failed to list rules'],
    ['add', ['add', '-c', 'any.yaml'], 'Failed to add rule'],
    ['remove', ['remove', '-c', 'any.yaml'], 'Failed to remove rule'],
    ['test', ['test', '.', '-c', 'any.yaml'], 'Test failed'],
  ])('%s reports a non-Error failure as an unknown error', async (_name, argv, prefix) => {
    const command = await loadCommandThrowing('plain failure');

    await runCommand(command, argv);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain(`${prefix}: Unknown error`);
  });
});
