import { Command } from 'commander';
import path from 'path';
import { Organizer } from '../../core/organizer.js';
import { loadConfig, findConfigPath } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import { printOrganizeResult } from '../ui/output.js';
import { promptForConflictResolution, confirmAction } from '../ui/prompts.js';

export const organizeCommand = new Command('organize')
  .alias('org')
  .description('Organize files in a directory')
  .argument('[source]', 'Source directory', '.')
  .option('-c, --config <path>', 'Path to config file')
  .option('-n, --dry-run', 'Preview changes without moving files')
  .option('-r, --recursive', 'Scan subdirectories')
  .option('--hidden', 'Include hidden files')
  .option('--conflict <resolution>', 'Conflict resolution (rename|overwrite|skip|newest)')
  .option('-i, --interactive', 'Interactive mode (prompt for conflicts)', false)
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (source: string, options) => {
    try {
      const sourceDir = path.resolve(source);
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(sourceDir);
        if (configPath) {
          logger.info(`Found config: ${configPath}`);
        }
      }

      let config;
      if (configPath) {
        config = await loadConfig(configPath);
      } else {
        logger.warn('No config file found. Use "fo config init" to create one.');
        return;
      }

      const organizer = new Organizer();
      organizer.setRules(config.rules);

      // Warn about template typos before files land in folders named "{quartal}"
      for (const rule of config.rules) {
        const unknown = organizer.getRulesEngine().getTemplateWarnings(rule.destination);
        for (const token of unknown) {
          logger.warn(`Rule "${rule.name}": unknown template variable ${token} in destination`);
        }
      }

      if (options.conflict) {
        config.conflictResolution = options.conflict as typeof config.conflictResolution;
      }

      if (options.interactive) {
        config.conflictResolution = await promptForConflictResolution();
      }

      // CLI flags win only when explicitly provided; otherwise fall back to
      // config values so YAML settings are not silently overridden.
      const organizeOptions = {
        dryRun: options.dryRun ?? config.dryRun ?? false,
        conflictResolution: config.conflictResolution || 'rename',
        recursive: options.recursive ?? config.recursive ?? false,
        includeHidden: options.hidden ?? config.includeHidden ?? false,
        plugins: config.plugins,
        // Local plugin specs (./x.js) resolve relative to the YAML file.
        pluginBaseDir: path.dirname(path.resolve(configPath)),
      };

      if (organizeOptions.dryRun) {
        logger.info('Running in dry-run mode (no files will be moved)');
      }

      // Safety net for first-time users: a real run touching many files
      // asks for confirmation unless -y/--yes was given.
      if (!organizeOptions.dryRun && !options.yes) {
        const preview = await organizer.preview(sourceDir, organizeOptions);
        if (preview.moved.length >= 20) {
          logger.warn(
            `This would move ${preview.moved.length} files. Review the list above or re-run with -y to skip this prompt.`
          );
          printOrganizeResult(preview, true);
          const confirmed = await confirmAction(`Continue and move ${preview.moved.length} files?`);
          if (!confirmed) {
            logger.info('Aborted — no files were moved.');
            return;
          }
        }
      }

      const result = await organizer.organize(sourceDir, organizeOptions);

      if (result.moved.length === 0 && result.skipped.length === 0 && result.errors.length === 0) {
        logger.info('No files to organize.');
        return;
      }

      printOrganizeResult(result, organizeOptions.dryRun);

      if (!organizeOptions.dryRun && result.moved.length > 0) {
        logger.success(`Successfully organized ${result.moved.length} files`);
        logger.info('Run "fo undo" to revert this operation');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Organization failed: ${message}`);
      process.exit(1);
    }
  });
