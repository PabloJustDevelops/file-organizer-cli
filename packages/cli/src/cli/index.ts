#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'module';
import { organizeCommand } from './commands/organize.js';
import { watchCommand } from './commands/watch.js';
import { rulesCommand } from './commands/rules.js';
import { undoCommand } from './commands/undo.js';
import { configCommand } from './commands/config.js';
import { dedupCommand } from './commands/dedup.js';
import { tuiCommand } from './commands/tui.js';
import { setLogLevel, setLogFilePath } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

const program = new Command();

program
  .name('fo')
  .description('File Organizer CLI - Automatically organize your files')
  .version(version)
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Only show errors')
  .option('--log-file <path>', 'Write logs to file')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      setLogLevel('debug');
    } else if (opts.quiet) {
      setLogLevel('error');
    }
    if (opts.logFile) {
      setLogFilePath(opts.logFile);
    }
  });

program.addCommand(organizeCommand);
program.addCommand(watchCommand);
program.addCommand(rulesCommand);
program.addCommand(undoCommand);
program.addCommand(configCommand);
program.addCommand(dedupCommand);
program.addCommand(tuiCommand);
program.commands.find((c) => c.name() === 'tui')?.description('Open interactive TUI (experimental)');

// `fo init` — most discoverable alias for creating a config
const initCommand = new Command('init')
  .description('Create a configuration file in the current directory')
  .action(() => {
    program.parse(['fo', 'config', 'init'], { from: 'user' });
  });
program.addCommand(initCommand);

program.parse();
