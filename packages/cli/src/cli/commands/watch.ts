import { Command } from 'commander';
import path from 'path';
import { Organizer } from '../../core/organizer.js';
import { FolderWatcher } from '../../core/watcher.js';
import { loadConfig, findConfigPath, loadAppConfig } from '../../config/loader.js';
import { logger } from '../../utils/logger.js';
import { errorMessage } from '../../utils/errors.js';
import { fail } from '../ui/output.js';

/**
 * Parse and validate the `--debounce` flag. Returns a positive integer of
 * milliseconds, or throws — the watcher must never silently ignore the value.
 */
export function parseDebounce(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid --debounce value "${value}": expected a positive integer of milliseconds`
    );
  }
  return parsed;
}

export const watchCommand = new Command('watch')
  .description('Watch a directory and organize files automatically')
  .argument('[source]', 'Source directory', '.')
  .option('-c, --config <path>', 'Path to config file')
  .option('--conflict <resolution>', 'Conflict resolution (rename|overwrite|skip|newest)')
  .option('--no-initial', 'Skip initial organization on start')
  .option('--debounce <ms>', 'Debounce time in ms', '1000')
  .action(async (source: string, options) => {
    let debounceMs: number;
    try {
      debounceMs = parseDebounce(options.debounce);
    } catch (err) {
      // `parseDebounce` is local and only ever throws an Error, so the shared
      // helper's non-Error fallback is not reachable from here — one covered
      // fallback (utils/errors) instead of an untestable copy per file.
      fail(errorMessage(err));
      return;
    }

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
        fail('No config file found. Use "fo config init" to create one.');
        return;
      }

      const organizer = new Organizer();
      organizer.setRules(config.rules);

      // Defaults live in FolderWatcher; AppConfig.watchIgnorePatterns extends them.
      const appConfig = await loadAppConfig();

      const watcher = new FolderWatcher(organizer, sourceDir, {
        ignorePatterns: appConfig.watchIgnorePatterns,
        debounceMs,
        organizeOnStart: options.initial !== false,
        conflictResolution: options.conflict || config.conflictResolution || 'rename',
        plugins: config.plugins,
        // `configPath` is guaranteed truthy here: the no-config branch returned above.
        pluginBaseDir: path.dirname(path.resolve(configPath)),
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
      fail(`Watch failed: ${message}`);
    }
  });
