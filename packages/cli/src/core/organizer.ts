import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';
import type {
  OrganizeConfig,
  OrganizeContext,
  OrganizeResult,
  MovedFile,
  ReplacedFile,
  UndoEntry,
} from '../types/index.js';
import { FileScanner, ScanOptions } from './file-scanner.js';
import { RulesEngine } from './rules-engine.js';
import {
  PluginRegistry,
  runBeforeOrganize,
  runAfterOrganize,
  collectPluginRules,
  applyTransforms,
} from './plugins/index.js';
import type { OrganizerPlugin } from '../core/plugins/contract.js';
import type { LoaderEdges } from './plugins/loader.js';
import { getUniqueFilePath, moveFile } from '../utils/file-utils.js';
import { HistoryStore } from '../utils/history-store.js';
import { logger } from '../utils/logger.js';

export interface OrganizeOptions extends ScanOptions {
  dryRun?: boolean;
  conflictResolution?: OrganizeConfig['conflictResolution'];
  /** Rules may be passed flat (preferred) or via `config` (equivalent). */
  rules?: OrganizeConfig['rules'];
  /** Locale for template variables like {monthName} (BCP-47, e.g. es-ES). */
  locale?: string;
  /** Plugin specs to load before organizing (flat form; `config.plugins` is equivalent). */
  plugins?: string[];
  /** Directory local plugin specs resolve against; also roots npm resolution. Defaults to cwd. */
  pluginBaseDir?: string;
  config?: OrganizeConfig;
}

export class Organizer {
  private scanner: FileScanner;
  private rulesEngine: RulesEngine;
  private plugins: PluginRegistry;
  private historyStore: HistoryStore;
  private history: UndoEntry[] = [];
  private historySize: number = 50;
  private initialized = false;
  /** Specs already loaded by this instance (preview + organize must not double-load). */
  private readonly loadedSpecs = new Set<string>();
  /** Rule names contributed by plugins on this instance (idempotent re-injection). */
  private readonly pluginRuleNames = new Set<string>();

  constructor(options: { historyDir?: string; pluginEdges?: LoaderEdges } = {}) {
    this.scanner = new FileScanner();
    this.rulesEngine = new RulesEngine();
    this.plugins = new PluginRegistry(options.pluginEdges ?? {});
    this.historyStore = new HistoryStore({ historyDir: options.historyDir });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.history = await this.historyStore.load();
    this.initialized = true;
  }

  setRules(rules: OrganizeConfig['rules']): void {
    this.rulesEngine.setRules(rules);
  }

  /** Register a programmatic plugin (PLUGINS.md API); validates and dedups by name. */
  loadPlugin(plugin: OrganizerPlugin): OrganizerPlugin {
    return this.plugins.register(plugin);
  }

  /** Load a plugin from a local spec or npm package into this organizer. */
  async loadSpec(
    spec: string,
    options: { baseDir?: string } = {}
  ): Promise<OrganizerPlugin> {
    const loaded = await this.plugins.load(spec, options);
    this.loadedSpecs.add(spec); // same key as config specs: pre-loaded specs are not re-loaded
    return loaded;
  }

  /** Snapshot of registered plugins, in registration order. */
  listPlugins(): readonly OrganizerPlugin[] {
    return this.plugins.list();
  }

  setHistorySize(size: number): void {
    this.historySize = size;
    this.trimHistory();
  }

  async organize(
    sourceDir: string,
    options: OrganizeOptions = {}
  ): Promise<OrganizeResult> {
    await this.ensureInitialized();
    const {
      dryRun = false,
      conflictResolution = 'rename',
      config,
      rules,
      locale,
      plugins,
      pluginBaseDir,
      ...scanOptions
    } = options;

    // Flat `rules` and `config.rules` are equivalent; explicit options win.
    if (rules || config) {
      this.rulesEngine.setRules(rules ?? config!.rules);
    }
    this.rulesEngine.setLocale(locale ?? config?.locale);
    if (config?.sizeBuckets) {
      this.rulesEngine.setSizeBuckets(config.sizeBuckets);
    }

    // Plugins load BEFORE any scan or move: a broken spec aborts the run
    // without touching a single file. Specs already loaded on this instance
    // (e.g. preview() ran before organize()) are skipped, not re-loaded.
    const pluginSpecs = plugins ?? config?.plugins;
    if (pluginSpecs && pluginSpecs.length > 0) {
      const baseDir = pluginBaseDir ?? process.cwd();
      for (const spec of pluginSpecs) {
        if (this.loadedSpecs.has(spec)) continue;
        const loaded = await this.plugins.load(spec, { baseDir });
        this.loadedSpecs.add(spec);
        logger.debug(`[plugins] Loaded "${loaded.name}" v${loaded.version} from "${spec}"`);
      }
    }

    const scanned = await this.scanner.scan(sourceDir, scanOptions);

    const result: OrganizeResult = {
      moved: [],
      skipped: [],
      errors: [],
    };

    // Transforms (before matching/organizing, per capability map): the
    // working set here drives rule matching, destination paths, and what
    // beforeOrganize sees in context.files. Failures are per-file and
    // reported, never fatal.
    let files = scanned;
    if (this.plugins.list().length > 0) {
      const { files: transformed, failures: transformFailures } =
        await applyTransforms(this.plugins.list(), files);
      files = transformed;
      if (transformFailures.length > 0) {
        result.pluginErrors = [...(result.pluginErrors ?? []), ...transformFailures];
        for (const f of transformFailures) {
          logger.error(`[plugins] ${f.plugin} transform: ${f.error}`);
        }
      }
    }

    // Plugin-contributed rules: validated like YAML rules, injected with
    // priority respected; conflicts with config rule names favor the config.
    // Already-injected names skip silently (preview→organize double pass).
    if (this.plugins.list().length > 0) {
      const { rules: pluginRules, failures: ruleFailures } = await collectPluginRules(
        this.plugins.list()
      );
      if (ruleFailures.length > 0) {
        result.pluginErrors = [...(result.pluginErrors ?? []), ...ruleFailures];
        for (const f of ruleFailures) {
          logger.error(`[plugins] ${f.plugin} customRules: ${f.error}`);
        }
      }
      for (const pr of pluginRules) {
        if (this.rulesEngine.hasRule(pr.name)) {
          if (this.pluginRuleNames.has(pr.name)) continue; // ours, still injected (no reset)
          result.pluginErrors = [
            ...(result.pluginErrors ?? []),
            { plugin: 'customRules', hook: 'customRules', error: `rule "${pr.name}" conflicts with an existing config rule; config wins` },
          ];
          logger.warn(`[plugins] rule "${pr.name}" conflicts with a config rule; config rule wins`);
          continue;
        }
        // Engine lacks the name: inject (also re-injects after a setRules reset).
        this.rulesEngine.addRule(pr);
        this.pluginRuleNames.add(pr.name);
      }
    }

    // Hook context: files scanned, results empty — filled by afterOrganize.
    const pluginContext: OrganizeContext = {
      source: sourceDir,
      config: { ...(config ?? { rules: rules ?? [] }), dryRun },
      files,
      results: result,
    };

    // Error isolation: a failing hook is logged and reported, never fatal.
    if (this.plugins.list().length > 0) {
      const hookErrors = await runBeforeOrganize(this.plugins.list(), pluginContext);
      if (hookErrors.length > 0) {
        result.pluginErrors = hookErrors;
        for (const hookError of hookErrors) {
          logger.error(`[plugins] ${hookError.plugin} ${hookError.hook} failed: ${hookError.error}`);
        }
      }
    }

    const matches = this.rulesEngine.matchFiles(files);

    const undoEntry: UndoEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      operations: [],
    };
    let replaced: ReplacedFile[] = [];

    for (const [file, match] of matches) {
      const fileName = file.extension
        ? `${file.name}.${file.extension}`
        : file.name;
      const destPath = path.isAbsolute(match.destination)
        ? path.join(match.destination, fileName)
        : path.join(sourceDir, match.destination, fileName);

      if (file.path === destPath) {
        result.skipped.push({
          file: file.path,
          reason: 'Source and destination are the same',
        });
        continue;
      }

      try {
        const finalDest = await getUniqueFilePath(destPath, conflictResolution, file.path);

        if (finalDest === null) {
          result.skipped.push({
            file: file.path,
            reason: 'File already exists (skip resolution)',
          });
          continue;
        }

        const overwrite = finalDest === destPath && (conflictResolution === 'overwrite' || conflictResolution === 'newest');

        if (!dryRun) {
          if (overwrite) {
            // The file being clobbered must survive undo — back it up first.
            const backupPath = await this.historyStore.backupReplacedFile(finalDest);
            replaced.push({ path: finalDest, backupPath });
          }
          await moveFile(file.path, finalDest, { overwrite });
        }

        const movedFile: MovedFile = {
          from: file.path,
          to: finalDest,
          rule: match.rule.name,
        };

        result.moved.push(movedFile);
        if (!dryRun) {
          undoEntry.operations.push(movedFile);
        }

        logger.debug(`${dryRun ? '[DRY RUN] Would move' : 'Moved'}: ${file.path} -> ${finalDest}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push({
          file: file.path,
          error: errorMessage,
        });
        logger.error(`Error moving ${file.path}: ${errorMessage}`);
      }
    }

    if (!dryRun) {
      if (replaced.length > 0) undoEntry.replaced = replaced;
      if (undoEntry.operations.length > 0 || replaced.length > 0) {
        this.addToHistory(undoEntry);
        await this.historyStore.save(this.history);
      }
    }

    if (this.plugins.list().length > 0) {
      const hookErrors = await runAfterOrganize(this.plugins.list(), pluginContext);
      if (hookErrors.length > 0) {
        result.pluginErrors = [...(result.pluginErrors ?? []), ...hookErrors];
        for (const hookError of hookErrors) {
          logger.error(`[plugins] ${hookError.plugin} ${hookError.hook} failed: ${hookError.error}`);
        }
      }
    }

    return result;
  }

  async preview(
    sourceDir: string,
    options: OrganizeOptions = {}
  ): Promise<OrganizeResult> {
    await this.ensureInitialized();
    return this.organize(sourceDir, { ...options, dryRun: true });
  }

  async undo(): Promise<OrganizeResult | null> {
    await this.ensureInitialized();
    const lastEntry = this.history.pop();
    if (!lastEntry) {
      logger.warn('No operations to undo');
      return null;
    }

    const result: OrganizeResult = {
      moved: [],
      skipped: [],
      errors: [],
    };

    // Backups of clobbered files, grouped by the destination that replaced them.
    const replacedByDest = new Map<string, ReplacedFile[]>();
    for (const r of lastEntry.replaced ?? []) {
      const list = replacedByDest.get(r.path) ?? [];
      list.push(r);
      replacedByDest.set(r.path, list);
    }

    for (const op of [...lastEntry.operations].reverse()) {
      try {
        if (await fs.pathExists(op.to)) {
          const replacedForOp = replacedByDest.get(op.to) ?? [];
          if (replacedForOp.length > 0) {
            // OVERWRITE case: op.to currently holds the incoming file, and
            // op.from (its original spot) is free. So the incoming file can go
            // straight home; then the backup of the clobbered file takes back
            // its place at op.to. Order matters — do NOT restore the backup
            // first, or the 'undo' move below would displace it again.
            for (const r of replacedForOp) {
              await moveFile(op.to, op.from); // incoming file back home
              result.moved.push({ from: op.to, to: op.from, rule: 'undo' });
              logger.debug(`Undid: ${op.to} -> ${op.from}`);
              if (await fs.pathExists(r.backupPath)) {
                await moveFile(r.backupPath, r.path); // clobbered file restored
                await this.historyStore.removeBackup(r.backupPath);
                result.moved.push({ from: r.backupPath, to: r.path, rule: 'undo-replaced' });
                logger.debug(`Restored overwritten file: ${r.path}`);
              }
            }
          } else {
            // Plain move: the original location may have been taken meanwhile —
            // never fail mid-revert, fall back to a unique name next to it.
            const restoreTarget = await getUniqueFilePath(op.from, 'rename', op.to);
            if (restoreTarget === null) {
              result.skipped.push({ file: op.to, reason: 'Could not determine restore target' });
              continue;
            }
            await moveFile(op.to, restoreTarget);
            result.moved.push({ from: op.to, to: restoreTarget, rule: 'undo' });
            logger.debug(`Undid: ${op.to} -> ${restoreTarget}`);
          }
        } else {
          result.skipped.push({
            file: op.to,
            reason: 'File no longer exists',
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push({
          file: op.to,
          error: errorMessage,
        });
      }
    }

    // Edge case: an overwrite whose destination no longer exists (user deleted
    // it meanwhile). The clobbered file still deserves restoration.
    for (const [dest, replacedList] of replacedByDest) {
      if (!(await fs.pathExists(dest))) {
        for (const r of replacedList) {
          try {
            if (await fs.pathExists(r.backupPath)) {
              await moveFile(r.backupPath, r.path);
              await this.historyStore.removeBackup(r.backupPath);
              result.moved.push({ from: r.backupPath, to: r.path, rule: 'undo-replaced' });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            result.errors.push({ file: r.path, error: message });
          }
        }
      }
    }

    await this.historyStore.save(this.history);
    return result;
  }

  async getHistory(): Promise<UndoEntry[]> {
    await this.ensureInitialized();
    return [...this.history];
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await this.historyStore.clear();
  }

  getHistoryFilePath(): string {
    return this.historyStore.getFilePath();
  }

  private addToHistory(entry: UndoEntry): void {
    this.history.push(entry);
    this.trimHistory();
  }

  private trimHistory(): void {
    while (this.history.length > this.historySize) {
      this.history.shift();
    }
  }

  getRulesEngine(): RulesEngine {
    return this.rulesEngine;
  }

  getScanner(): FileScanner {
    return this.scanner;
  }
}
