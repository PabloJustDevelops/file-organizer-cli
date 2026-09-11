import { Command } from 'commander';
import path from 'path';
import { loadConfig, saveConfig, initConfig, findConfigPath } from '../../config/loader.js';
import { getExampleConfig, getExampleRules } from '../../config/schema.js';
import { RulesEngine } from '../../core/rules-engine.js';
import { logger, setLogLevel } from '../../utils/logger.js';
import { fail, printJson, printRules, printConfig } from '../ui/output.js';

export const configCommand = new Command('config')
  .description('Manage configuration');

configCommand
  .command('init')
  .alias('create')
  .description('Create a new configuration file')
  .argument('[path]', 'Config file path', '.file-organizer.yaml')
  .option('--example', 'Include example rules')
  .action(async (configPath: string, options) => {
    try {
      const fullPath = path.resolve(configPath);

      if (options.example) {
        const config = getExampleConfig();
        await saveConfig(fullPath, config);
      } else {
        await initConfig(fullPath);
      }

      logger.success(`Config created: ${fullPath}`);
      logger.gray('Edit this file to customize your rules');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fail(`Failed to create config: ${message}`);
    }
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Path to config file')
  .option('--json', 'Output machine-readable JSON', false)
  .action(async (options) => {
    const json = options.json === true;
    if (json) setLogLevel('error');
    try {
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(process.cwd());
      }

      if (!configPath) {
        fail('No config file found. Use "fo config init" to create one.', json);
        return;
      }

      const config = await loadConfig(configPath);
      if (json) {
        printJson(config);
      } else {
        printConfig(config as unknown as Record<string, unknown>);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fail(`Failed to show config: ${message}`, json);
    }
  });

configCommand
  .command('validate')
  .description('Validate configuration file')
  .argument('[path]', 'Config file path')
  .action(async (configPath: string | undefined) => {
    try {
      let fullPath: string | undefined = configPath;

      if (!fullPath) {
        fullPath = findConfigPath(process.cwd()) ?? undefined;
      }

      if (!fullPath) {
        fail('No config file found.');
        return;
      }

      const config = await loadConfig(fullPath);
      logger.success('Configuration is valid');
      logger.info(`Rules: ${config.rules.length}`);

      // Surface template typos at validation time
      const engine = new RulesEngine();
      let templateWarnings = 0;
      for (const rule of config.rules) {
        for (const token of engine.getTemplateWarnings(rule.destination)) {
          logger.warn(`Rule "${rule.name}": unknown template variable ${token} in destination "${rule.destination}"`);
          templateWarnings++;
        }
      }

      printRules(config.rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fail(`Invalid configuration: ${message}`);
    }
  });

configCommand
  .command('example')
  .description('Show example rules')
  .action(() => {
    const rules = getExampleRules();
    printRules(rules);
  });
