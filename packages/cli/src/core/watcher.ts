import chokidar, { type FSWatcher } from 'chokidar';
import type { Organizer } from './organizer.js';
import type { OrganizeResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface WatcherOptions {
  ignorePatterns?: string[];
  debounceMs?: number;
  organizeRecursive?: boolean;
  conflictResolution?: 'rename' | 'overwrite' | 'skip' | 'newest';
  /** Plugin specs loaded before each organize pass (deduped by the organizer). */
  plugins?: string[];
  /** Directory local plugin specs resolve against. */
  pluginBaseDir?: string;
}

const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  // Ignore the organized output itself — otherwise watch mode would
  // react to its own moves and fight itself forever.
  '**/images/**',
  '**/documents/**',
  '**/videos/**',
  '**/audio/**',
  '**/archives/**',
  '**/code/**',
  '**/projects/**',
  '**/screenshots/**',
  '**/other/**',
  '*.tmp',
];

export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private isOrganizing = false;
  private pending = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly ignores: string[];
  private readonly debounceMs: number;
  private readonly recursive: boolean;
  private readonly conflictResolution: 'rename' | 'overwrite' | 'skip' | 'newest';
  private readonly plugins?: string[];
  private readonly pluginBaseDir?: string;

  constructor(
    private readonly organizer: Organizer,
    private readonly sourceDir: string,
    options: WatcherOptions = {}
  ) {
    this.ignores = [...DEFAULT_IGNORES, ...(options.ignorePatterns ?? [])];
    this.debounceMs = options.debounceMs ?? 500;
    this.recursive = options.organizeRecursive ?? true;
    this.conflictResolution = options.conflictResolution ?? 'rename';
    this.plugins = options.plugins;
    this.pluginBaseDir = options.pluginBaseDir;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.watcher = chokidar.watch(this.sourceDir, {
        ignored: this.ignores,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: this.debounceMs,
          pollInterval: 100,
        },
      });

      this.watcher
        .on('add', () => this.scheduleOrganize())
        .on('change', () => this.scheduleOrganize())
        .on('unlink', () => this.scheduleOrganize())
        .on('error', (err) => logger.error(`[watch] Watcher error: ${err.message}`))
        .on('ready', () => {
          logger.success(`[watch] Watching: ${this.sourceDir}`);
          resolve();
        });
    });
  }

  /** Wait until any in-flight or queued organize run settles. Test/exit helper. */
  async idle(): Promise<void> {
    while (this.isOrganizing || this.pending) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private scheduleOrganize(): void {
    // Coalesce bursts of events (multi-file drops, editors writing tmp+rename)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.runOrganize();
    }, 50);
  }

  private async runOrganize(): Promise<void> {
    if (this.isOrganizing) {
      // Don't drop the event — queue one follow-up run instead.
      this.pending = true;
      return;
    }
    this.isOrganizing = true;

    try {
      const result: OrganizeResult = await this.organizer.organize(this.sourceDir, {
        conflictResolution: this.conflictResolution,
        recursive: this.recursive,
        includeHidden: false,
        plugins: this.plugins,
        pluginBaseDir: this.pluginBaseDir,
      });

      if (result.moved.length > 0) {
        logger.info(`[watch] Organized ${result.moved.length} files`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[watch] Organization error: ${message}`);
    } finally {
      this.isOrganizing = false;
      if (this.pending) {
        this.pending = false;
        void this.runOrganize();
      }
    }
  }
}
