import { Command } from 'commander';
import path from 'path';
import { Organizer } from '../../core/organizer.js';
import { FolderWatcher } from '../../core/watcher.js';
import { loadConfig, findConfigPath, loadAppConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';

export const watchCommand = new Command('watch')
  .description('Watch a directory and organize files automatically')
  .argument('[source]', 'Source directory', '.')
  .option('-c, --config <path>', 'Path to config file')
  .option('--conflict <resolution>', 'Conflict resolution (rename|overwrite|skip|newest)')
  .option('--no-initial', 'Skip initial organization on start')
  .option('--debounce <ms>', 'Debounce time in ms', '1000')
  .action(async (source: string, options) => {
    try {
      const sourceDir = path.resolve(source);
      let configPath = options.config;

      if (!configPath) {
        configPath = findConfigPath(sourceDir);
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

      // Defaults live in FolderWatcher; AppConfig.watchIgnorePatterns extends them.
      const appConfig = await loadAppConfig();

      const watcher = new FolderWatcher(organizer, sourceDir, {
        ignorePatterns: appConfig.watchIgnorePatterns,
        debounceMs: 500,
        conflictResolution: options.conflict || config.conflictResolution || 'rename',
        plugins: config.plugins,
        pluginBaseDir: configPath ? path.dirname(path.resolve(configPath)) : undefined,
      });

      await watcher.start();

      const shutdown = async () => {
        logger.info('[watch] Stopping watcher...');
        await watcher.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Watch failed: ${message}`);
      process.exit(1);
    }
  });
