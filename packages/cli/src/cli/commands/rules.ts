import { Command } from 'commander';
import path from 'path';
import { Organizer } from '../../core/organizer.js';
import { loadConfig, saveConfig, findConfigPath } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import { printRules } from '../ui/output.js';
import { promptForRule, selectRule } from '../ui/prompts.js';

export const rulesCommand = new Command('rules')
  .description('Manage organization rules');

rulesCommand
  .command('list')
  .alias('ls')
  .description('List all rules')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(process.cwd());
      }

      if (!configPath) {
        logger.warn('No config file found. Use "fo init" to create one.');
        return;
      }

      const config = await loadConfig(configPath);
      printRules(config.rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Failed to list rules: ${message}`);
    }
  });

rulesCommand
  .command('add')
  .alias('a')
  .description('Add a new rule interactively')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(process.cwd());
      }

      if (!configPath) {
        logger.warn('No config file found. Use "fo init" to create one.');
        return;
      }

      const config = await loadConfig(configPath);
      const newRule = await promptForRule();

      const existingIndex = config.rules.findIndex((r) => r.name === newRule.name);
      if (existingIndex !== -1) {
        logger.warn(`Rule "${newRule.name}" already exists. Replacing...`);
        config.rules[existingIndex] = newRule;
      } else {
        config.rules.push(newRule);
      }

      await saveConfig(configPath, config);
      logger.success(`Rule "${newRule.name}" added successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Failed to add rule: ${message}`);
    }
  });

rulesCommand
  .command('remove')
  .alias('rm')
  .description('Remove a rule')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(process.cwd());
      }

      if (!configPath) {
        logger.warn('No config file found. Use "fo init" to create one.');
        return;
      }

      const config = await loadConfig(configPath);

      if (config.rules.length === 0) {
        logger.warn('No rules to remove.');
        return;
      }

      const ruleName = await selectRule(config.rules);
      if (!ruleName) {
        return;
      }

      const organizer = new Organizer();
      organizer.setRules(config.rules);

      if (organizer.getRulesEngine().removeRule(ruleName)) {
        const updatedRules = organizer.getRulesEngine().getRules();
        config.rules = updatedRules;
        await saveConfig(configPath, config);
        logger.success(`Rule "${ruleName}" removed`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Failed to remove rule: ${message}`);
    }
  });

rulesCommand
  .command('test')
  .description('Test rules against files (dry run)')
  .argument('[source]', 'Source directory', '.')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (source: string, options) => {
    try {
      const sourceDir = path.resolve(source);
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(sourceDir);
      }

      if (!configPath) {
        logger.warn('No config file found. Use "fo init" to create one.');
        return;
      }

      const config = await loadConfig(configPath);
      const organizer = new Organizer();
      organizer.setRules(config.rules);

      const result = await organizer.preview(sourceDir, {
        recursive: true,
        includeHidden: false,
      });

      const { printOrganizeResult } = await import('../ui/output.js');
      printOrganizeResult(result, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Test failed: ${message}`);
    }
  });
