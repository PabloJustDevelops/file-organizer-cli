import chokidar, { type FSWatcher } from 'chokidar';
import path from 'path';
import type { Organizer } from './organizer.js';
import type { MovedFile, OrganizeResult, Rule } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { errorMessage } from '../utils/errors.js';

export interface WatcherOptions {
  ignorePatterns?: string[];
  debounceMs?: number;
  organizeRecursive?: boolean;
  /** Run one organize pass when the watcher becomes ready (default true). */
  organizeOnStart?: boolean;
  conflictResolution?: 'rename' | 'overwrite' | 'skip' | 'newest';
  /** Plugin specs loaded before each organize pass (deduped by the organizer). */
  plugins?: string[];
  /** Directory local plugin specs resolve against. */
  pluginBaseDir?: string;
}

// Destination-independent only. The folders this watcher writes into are derived
// from the config (see buildDestinationIgnores/buildDestinationDirs), never
// hardcoded — otherwise a custom destination would make watch fight itself.
const DEFAULT_IGNORES = ['node_modules', '.git', 'dist', '.cache', '*.tmp'];

/** Strip a leading `./` and any leading separators from a destination template. */
function relativeDestination(destination: string): string {
  return destination.replace(/^\.\//, '').replace(/^[/\\]+/, '');
}

/**
 * Derive chokidar ignore globs from rule destinations. Destinations are templates
 * (`./images/{year}/{month}`), so only the first static segment is usable as a
 * glob; templated roots (e.g. `./{year}`) are learned at runtime from the
 * directories an organize pass actually writes to. Absolute destinations are
 * skipped — they are outside the watched tree.
 */
export function buildDestinationIgnores(rules: Rule[]): string[] {
  const segments = new Set<string>();

  for (const rule of rules) {
    if (path.isAbsolute(rule.destination)) continue;
    // split() always yields at least one element, so `[0]` is never nullish —
    // only the resulting segment can be empty (or ".").
    const segment = relativeDestination(rule.destination).split(/[/\\]/)[0].split('{')[0];
    if (segment && segment !== '.') segments.add(segment);
  }

  return [...segments].map((segment) => `**/${segment}/**`);
}

/**
 * Absolute directories a rule destination statically resolves into, for scan
 * exclusion. Ignoring chokidar events is not enough: the periodic scan would
 * still see (and re-match) files already sitting in a destination. Only the
 * segments before the first template placeholder are knowable statically
 * (`./photos/{year}` → `<source>/photos`); templated roots are learned at runtime.
 */
export function buildDestinationDirs(rules: Rule[], sourceDir: string): string[] {
  const dirs = new Set<string>();

  for (const rule of rules) {
    if (path.isAbsolute(rule.destination)) continue;
    const staticSegments: string[] = [];
    for (const segment of relativeDestination(rule.destination).split(/[/\\]/)) {
      if (!segment || segment.includes('{')) break;
      staticSegments.push(segment);
    }
    if (staticSegments.length > 0) {
      dirs.add(path.resolve(sourceDir, ...staticSegments));
    }
  }

  return [...dirs];
}

export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private isOrganizing = false;
  private pending = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly ignores: string[];
  private readonly staticDestinationDirs: string[];
  /** Destination directories observed at runtime (see learnDestinationDirs). */
  private readonly learnedDirs = new Set<string>();
  private readonly debounceMs: number;
  private readonly recursive: boolean;
  private readonly organizeOnStart: boolean;
  private readonly conflictResolution: 'rename' | 'overwrite' | 'skip' | 'newest';
  private readonly plugins?: string[];
  private readonly pluginBaseDir?: string;

  constructor(
    private readonly organizer: Organizer,
    private readonly sourceDir: string,
    options: WatcherOptions = {}
  ) {
    const rules = organizer.getRulesEngine().getRules();
    this.ignores = [
      ...DEFAULT_IGNORES,
      ...buildDestinationIgnores(rules),
      ...(options.ignorePatterns ?? []),
    ];
    this.staticDestinationDirs = buildDestinationDirs(rules, sourceDir);
    this.debounceMs = options.debounceMs ?? 500;
    this.recursive = options.organizeRecursive ?? true;
    this.organizeOnStart = options.organizeOnStart ?? true;
    this.conflictResolution = options.conflictResolution ?? 'rename';
    this.plugins = options.plugins;
    this.pluginBaseDir = options.pluginBaseDir;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.watcher = chokidar.watch(this.sourceDir, {
        // Globs plus a predicate over the dynamically learned destination
        // directories — chokidar (anymatch) evaluates every entry.
        ignored: [
          ...this.ignores,
          (targetPath: string) => this.isLearnedDestination(targetPath),
        ],
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
          // Realize the initial pass that `--no-initial` disables.
          if (this.organizeOnStart) {
            void this.runOrganize();
          }
          resolve();
        });
    });
  }

  /** True when a path lives inside a directory an organize pass wrote to. */
  private isLearnedDestination(targetPath: string): boolean {
    if (this.learnedDirs.size === 0) return false;
    const resolved = path.resolve(targetPath);
    for (const dir of this.learnedDirs) {
      if (resolved === dir || resolved.startsWith(dir + path.sep)) return true;
    }
    return false;
  }

  /** Remember the destination directories used by a pass (and their ancestors). */
  private learnDestinationDirs(moved: MovedFile[]): void {
    const root = path.resolve(this.sourceDir);
    for (const file of moved) {
      let dir = path.resolve(path.dirname(file.to));
      // Terminates: every dir satisfying the test has at least one character
      // after `root + sep`, so dirname strictly shortens it.
      while (dir !== root && dir.startsWith(root + path.sep)) {
        this.learnedDirs.add(dir);
        dir = path.dirname(dir);
      }
    }
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
    // and honor the configured debounce window.
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.runOrganize();
    }, this.debounceMs);
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
        // Keep destination folders out of the scan, not just out of events.
        excludeDirs: [...this.staticDestinationDirs, ...this.learnedDirs],
        plugins: this.plugins,
        pluginBaseDir: this.pluginBaseDir,
      });

      if (result.moved.length > 0) {
        this.learnDestinationDirs(result.moved);
        logger.info(`[watch] Organized ${result.moved.length} files`);
      }
    } catch (err) {
      const message = errorMessage(err);
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
