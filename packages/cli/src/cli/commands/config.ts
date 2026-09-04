import { Command } from 'commander';
import path from 'path';
import { loadConfig, saveConfig, initConfig, findConfigPath } from '../../config/loader.js';
import { getExampleConfig, getExampleRules } from '../../config/schema.js';
import { RulesEngine } from '../../core/rules-engine.js';
import { logger } from '../../utils/logger.js';
import { printRules, printConfig } from '../ui/output.js';

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
      logger.error(`Failed to create config: ${message}`);
    }
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(process.cwd());
      }

      if (!configPath) {
        logger.warn('No config file found. Use "fo config init" to create one.');
        return;
      }

      const config = await loadConfig(configPath);
      printConfig(config as unknown as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Failed to show config: ${message}`);
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
        logger.warn('No config file found.');
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
      logger.error(`Invalid configuration: ${message}`);
      process.exit(1);
    }
  });

configCommand
  .command('example')
  .description('Show example rules')
  .action(() => {
    const rules = getExampleRules();
    printRules(rules);
  });
