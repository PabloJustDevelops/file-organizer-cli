import { Command } from 'commander';
import path from 'path';
import { logger } from '../../utils/logger.js';

function isWindowsTerminal(): boolean {
  return !!(
    process.env.WT_SESSION ||
    process.env.TERM_PROGRAM === 'WezTerm' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM_PROGRAM === 'Orca' ||
    process.env.TMUX
  );
}

function canEnableRawMode(): boolean {
  if (process.platform !== 'win32') return true;
  if (!isWindowsTerminal()) return false;

  // Actually try to enable raw mode
  if (typeof process.stdin.setRawMode !== 'function') return false;
  try {
    process.stdin.setRawMode(true);
    process.stdin.setRawMode(false);
    return true;
  } catch {
    return false;
  }
}

export const tuiCommand = new Command('tui')
  .description('Open interactive TUI for file organization')
  .argument('[source]', 'Source directory', '.')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (source: string, options) => {
    const sourceDir = path.resolve(source);

    if (!canEnableRawMode()) {
      logger.warn('TUI requires a terminal with raw mode support.');
      logger.gray('On Windows, use Windows Terminal, Git Bash, or WSL.');
      logger.gray('Classic PowerShell and CMD are not supported.');
      logger.gray('As a fallback, use "fo organize" instead.');
      process.exit(1);
    }

    // Loaded lazily: the TUI stack (react + ink) must not be pulled in by the
    // CLI entry, so `fo <command>` works on installs without those deps.
    const [{ render }, reactModule, { App }] = await Promise.all([
      import('ink'),
      import('react'),
      import('../../tui/App.js'),
    ]);

    render(
      reactModule.default.createElement(App, {
        source: sourceDir,
        configPath: options.config,
      })
    );
  });
