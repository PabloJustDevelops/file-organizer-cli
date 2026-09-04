import { Command } from 'commander';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import { FileScanner } from '../../core/file-scanner.js';
import { logger } from '../../utils/logger.js';
import { formatFileSize } from '../../utils/file-utils.js';
import { confirmAction } from '../ui/prompts.js';
import chalk from 'chalk';

interface DuplicateGroup {
  hash: string;
  files: { path: string; size: number; mtime: Date }[];
}

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function findDuplicates(
  directory: string,
  recursive: boolean
): Promise<DuplicateGroup[]> {
  const scanner = new FileScanner();
  const files = await scanner.scan(directory, { recursive, includeHidden: false });

  // Cheap pass: group by size first, only hash files that share a size
  const bySize = new Map<number, typeof files>();
  for (const file of files) {
    const list = bySize.get(file.size) ?? [];
    list.push(file);
    bySize.set(file.size, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2 || size === 0) continue;
    const byHash = new Map<string, typeof candidates>();
    for (const file of candidates) {
      const hash = await hashFile(file.path);
      const list = byHash.get(hash) ?? [];
      list.push(file);
      byHash.set(hash, list);
    }
    for (const [hash, dupes] of byHash) {
      if (dupes.length >= 2) {
        groups.push({
          hash,
          files: dupes.map((f) => ({ path: f.path, size: f.size, mtime: f.modifiedAt })),
        });
      }
    }
  }

  return groups;
}

export const dedupCommand = new Command('dedup')
  .description('Find (and optionally delete) duplicate files by content hash')
  .argument('[source]', 'Source directory', '.')
  .option('-r, --recursive', 'Scan subdirectories', false)
  .option('--delete', 'Delete duplicates (keeps newest of each group)', false)
  .action(async (source: string, options) => {
    try {
      const sourceDir = path.resolve(source);
      logger.info(`Scanning for duplicates in: ${sourceDir}`);

      const groups = await findDuplicates(sourceDir, options.recursive);

      if (groups.length === 0) {
        logger.success('No duplicates found.');
        return;
      }

      let totalWasted = 0;
      let fileIndex = 1;
      for (const group of groups) {
        const newest = group.files.reduce((a, b) => (b.mtime > a.mtime ? b : a));
        logger.info(
          `\nDuplicate group (${group.files.length} copies, ${formatFileSize(group.files[0].size)} each):`
        );
        for (const file of group.files) {
          const keep = file.path === newest.path;
          const label = keep ? chalk.green(' [keep: newest]') : chalk.gray(` [${fileIndex}]`);
          console.log(`  ${chalk.gray(file.path)}${label}`);
          if (!keep) fileIndex++;
        }
        totalWasted += group.files[0].size * (group.files.length - 1);
      }

      logger.info(`\nTotal recoverable space: ${formatFileSize(totalWasted)}`);

      if (!options.delete) {
        logger.gray('\nRe-run with --delete to remove duplicates (newest copy kept).');
        return;
      }

      const toDelete: string[] = [];
      for (const group of groups) {
        const newest = group.files.reduce((a, b) => (b.mtime > a.mtime ? b : a));
        for (const file of group.files) {
          if (file.path !== newest.path) toDelete.push(file.path);
        }
      }

      const confirmed = await confirmAction(
        `Delete ${toDelete.length} duplicate file(s)? This cannot be undone.`
      );
      if (!confirmed) {
        logger.info('Aborted — nothing deleted.');
        return;
      }

      let deleted = 0;
      for (const file of toDelete) {
        try {
          await fs.remove(file);
          deleted++;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Could not delete ${file}: ${message}`);
        }
      }
      logger.success(`Deleted ${deleted} duplicate file(s).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`Dedup failed: ${message}`);
      process.exit(1);
    }
  });
