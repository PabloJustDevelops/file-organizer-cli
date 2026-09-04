import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { UndoEntry, MovedFile, ReplacedFile } from '../types/index.js';
import { logger } from './logger.js';

interface SerializedEntry {
  id: string;
  timestamp: string;
  operations: MovedFile[];
  replaced?: ReplacedFile[];
}

interface HistoryFile {
  version: number;
  entries: SerializedEntry[];
}

const HISTORY_VERSION = 1;
const DEFAULT_HISTORY_DIR = path.join(os.homedir(), '.file-organizer');

function serializeEntry(entry: UndoEntry): SerializedEntry {
  return {
    id: entry.id,
    timestamp: entry.timestamp.toISOString(),
    operations: entry.operations,
    ...(entry.replaced && entry.replaced.length > 0
      ? { replaced: entry.replaced }
      : {}),
  };
}

function deserializeEntry(raw: any): UndoEntry {
  return {
    id: raw.id,
    timestamp: new Date(raw.timestamp),
    operations: raw.operations,
    replaced: Array.isArray(raw.replaced) ? raw.replaced : undefined,
  };
}

export interface HistoryStoreOptions {
  historyDir?: string;
}

export class HistoryStore {
  private cache: UndoEntry[] = [];
  private loaded = false;
  private historyFile: string;

  constructor(options: HistoryStoreOptions = {}) {
    const dir = options.historyDir ?? DEFAULT_HISTORY_DIR;
    this.historyFile = path.join(dir, 'history.json');
  }

  async load(): Promise<UndoEntry[]> {
    if (this.loaded) return [...this.cache];

    try {
      if (await fs.pathExists(this.historyFile)) {
        const data = await fs.readJson(this.historyFile) as HistoryFile;
        if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
          throw new Error('malformed history file: missing entries array');
        }
        this.cache = data.entries
          .filter((e) => e && typeof e === 'object' && Array.isArray(e.operations))
          .map(deserializeEntry);
      }
    } catch (err) {
      // Corrupt history must not silently vanish — quarantine it, warn, start clean.
      const message = err instanceof Error ? err.message : 'Unknown error';
      const corruptFile = this.historyFile + '.corrupt-' + Date.now();
      try {
        await fs.move(this.historyFile, corruptFile, { overwrite: true });
        logger.warn(
          `History file was unreadable (${message}). It has been moved aside to ${corruptFile}; starting with a clean history.`
        );
      } catch {
        logger.warn(`History file was unreadable (${message}) and could not be moved aside.`);
      }
      this.cache = [];
    }

    this.loaded = true;
    return [...this.cache];
  }

  /** Back up a file that is about to be overwritten. Returns backup path. */
  async backupReplacedFile(originalPath: string): Promise<string> {
    const dir = path.join(path.dirname(this.historyFile), 'replaced');
    await fs.ensureDir(dir);
    const id = crypto.randomUUID();
    const ext = path.extname(originalPath);
    const backupPath = path.join(dir, `${id}${ext}`);
    await fs.copy(originalPath, backupPath, { overwrite: false });
    return backupPath;
  }

  /** Remove the backup for a replaced file that was successfully restored. */
  async removeBackup(backupPath: string): Promise<void> {
    await fs.remove(backupPath);
  }

  async save(entries: UndoEntry[]): Promise<void> {
    this.cache = [...entries];
    this.loaded = true;

    const dir = path.dirname(this.historyFile);
    await fs.ensureDir(dir);
    const data: HistoryFile = {
      version: HISTORY_VERSION,
      entries: entries.map(serializeEntry),
    };
    await fs.writeJson(this.historyFile, data, { spaces: 2 });
  }

  async clear(): Promise<void> {
    this.cache = [];
    this.loaded = true;
    await fs.remove(this.historyFile);
  }

  getFilePath(): string {
    return this.historyFile;
  }
}
