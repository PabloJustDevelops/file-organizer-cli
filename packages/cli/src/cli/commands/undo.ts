import { Command } from 'commander';
import { Organizer } from '../../core/organizer.js';
import { logger } from '../../utils/logger.js';
import { printOrganizeResult, printHistory } from '../ui/output.js';
import { confirmAction } from '../ui/prompts.js';

export const undoCommand = new Command('undo')
  .description('Undo the last organization operation')
  .option('-l, --list', 'Show operation history')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (options) => {
    try {
      const organizer = new Organizer();

      if (options.list) {
        const history = await organizer.getHistory();
        printHistory(history);
        return;
      }

      const history = await organizer.getHistory();
      if (history.length === 0) {
        logger.warn('No operations to undo.');
        return;
      }

      const lastOp = history[history.length - 1];
      logger.info(`Last operation: ${lastOp.operations.length} files moved at ${lastOp.timestamp.toLocaleString()}`);

      if (!options.yes) {
        const confirmed = await confirmAction('Undo this operation?');
        if (!confirmed) {
          return;
        }
      }

      const result = await organizer.undo();

      if (result) {
        logger.success(`Undo complete: ${result.moved.length} files restored`);
        printOrganizeResult(result, false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Undo failed: ${message}`);
      process.exit(1);
    }
  });
