import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, runCommand, writeConfig } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-5: `src/cli/commands/config.ts` at 100%.
 * The four subcommands run in-process through `parseAsync`, against real temp
 * dirs; only the "unknown non-Error" branches need a stubbed loader.
 */
const ctx = cliTestContext('config-command');

async function loadConfigCommand() {
  vi.resetModules();
  return (await import('../../src/cli/commands/config.js')).configCommand;
}

describe('config init', () => {
  it('writes the starter config at the default path', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['init']);

    expect(process.exitCode).toBe(0);
    expect(await fs.pathExists(path.join(ctx.dir, '.file-organizer.yaml'))).toBe(true);
    expect(ctx.text()).toContain('Config created');
  });

  it('writes the example rules with --example', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['init', 'custom.yaml', '--example']);

    expect(process.exitCode).toBe(0);
    const written = await fs.readFile(path.join(ctx.dir, 'custom.yaml'), 'utf-8');
    expect(written).toContain('images');
  });

  it('reports a failure to write', async () => {
    const command = await loadConfigCommand();

    // A directory is not a writable config file.
    await runCommand(command, ['init', ctx.dir]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to create config');
  });
});

describe('config show', () => {
  it('prints the configuration found at an explicit path', async () => {
    const configPath = writeConfig(ctx.dir, {
      rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
    });
    const command = await loadConfigCommand();

    await runCommand(command, ['show', '-c', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Current Configuration:');
    expect(ctx.text()).toContain('Images');
  });

  it('emits JSON on stdout and nothing on the console with --json', async () => {
    const configPath = writeConfig(ctx.dir, {
      rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
    });
    const command = await loadConfigCommand();

    await runCommand(command, ['show', '-c', configPath, '--json']);

    expect(process.exitCode).toBe(0);
    expect(JSON.parse(ctx.stdout).rules[0].name).toBe('Images');
    expect(ctx.captured.log).toHaveLength(0);
  });

  it('discovers the config in the current directory when -c is omitted', async () => {
    writeConfig(ctx.dir, {
      rules: [{ name: 'Docs', patterns: ['*.pdf'], destination: './docs' }],
    });
    const command = await loadConfigCommand();

    await runCommand(command, ['show']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Docs');
  });

  it('fails when no config can be found', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['show']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found');
  });

  it('fails on an unreadable config', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['show', '-c', 'missing.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to show config');
  });
});

describe('config validate', () => {
  it('reports a valid config and warns about unknown template variables', async () => {
    const configPath = writeConfig(ctx.dir, {
      rules: [{ name: 'Typo', patterns: ['*.x'], destination: './{quartal}' }],
    });
    const command = await loadConfigCommand();

    await runCommand(command, ['validate', configPath]);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Configuration is valid');
    expect(ctx.text()).toContain('unknown template variable');
  });

  it('validates the config discovered in the current directory', async () => {
    writeConfig(ctx.dir, { rules: [] });
    const command = await loadConfigCommand();

    await runCommand(command, ['validate']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Configuration is valid');
  });

  it('fails when no config can be found', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['validate']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('No config file found.');
  });

  it('fails on an invalid config', async () => {
    const configPath = path.join(ctx.dir, 'broken.yaml');
    await fs.writeFile(configPath, 'rules: []\nlocale: 42\n', 'utf-8');
    const command = await loadConfigCommand();

    await runCommand(command, ['validate', configPath]);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Invalid configuration');
  });
});

describe('config example', () => {
  it('prints the example rules', async () => {
    const command = await loadConfigCommand();

    await runCommand(command, ['example']);

    expect(process.exitCode).toBe(0);
    expect(ctx.text()).toContain('Configured Rules:');
  });
});

describe('config with a stubbed loader', () => {
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
      initConfig: async () => {
        throw plainFailure;
      },
      findConfigPath: () => null,
    }));
    return (await import('../../src/cli/commands/config.js')).configCommand;
  }

  it('init reports a non-Error failure as an unknown error', async () => {
    const command = await loadCommandThrowing('plain failure');

    await runCommand(command, ['init']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to create config: Unknown error');
  });

  it('show reports a non-Error failure as an unknown error', async () => {
    const command = await loadCommandThrowing('plain failure');

    await runCommand(command, ['show', '-c', 'any.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Failed to show config: Unknown error');
  });

  it('validate reports a non-Error failure as an unknown error', async () => {
    const command = await loadCommandThrowing('plain failure');

    await runCommand(command, ['validate', 'any.yaml']);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('Invalid configuration: Unknown error');
  });
});
