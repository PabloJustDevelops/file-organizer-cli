import path from 'path';
import type { FileInfo } from '../types/index.js';
import { getFileInfo, listFiles } from '../utils/file-utils.js';
import { RulesEngine } from './rules-engine.js';
import { logger } from '../utils/logger.js';

export interface ScanOptions {
  patterns?: string[];
  recursive?: boolean;
  includeHidden?: boolean;
  extensions?: string[];
}

export class FileScanner {
  async scan(
    directory: string,
    options: ScanOptions = {}
  ): Promise<FileInfo[]> {
    const {
      patterns = ['*'],
      recursive = false,
      includeHidden = false,
      extensions,
    } = options;

    logger.debug(`Scanning directory: ${directory}`);
    logger.debug(`Patterns: ${patterns.join(', ')}`);

    let filePaths: string[];

    if (recursive) {
      filePaths = await listFiles(directory, true, includeHidden);
    } else {
      filePaths = await listFiles(directory, false, includeHidden);
    }

    if (extensions && extensions.length > 0) {
      const extSet = new Set(extensions.map((e) => e.toLowerCase()));
      filePaths = filePaths.filter((f) => {
        const ext = path.extname(f).toLowerCase().slice(1);
        return extSet.has(ext);
      });
    }

    const files: FileInfo[] = [];
    for (const filePath of filePaths) {
      try {
        const info = await getFileInfo(filePath);
        files.push(info);
      } catch (err) {
        logger.warn(`Could not read file: ${filePath} (${(err as Error).message})`);
      }
    }

    logger.info(`Found ${files.length} files`);
    return files;
  }

  async scanWithPatterns(
    directory: string,
    patterns: string[]
  ): Promise<FileInfo[]> {
    const allFiles = await this.scan(directory, { recursive: true });
    // Delegate matching to the rules engine — one source of truth for glob
    // semantics (fast-path extension globs, wildcards, substring fallback).
    const engine = new RulesEngine([
      { name: 'pattern-filter', patterns, destination: './' },
    ]);
    return allFiles.filter((file) => engine.matchFile(file) !== null);
  }
}
