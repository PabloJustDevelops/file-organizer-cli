/**
 * Plugin loader: discovers and loads plugins from the three v1 sources —
 * programmatic objects, local files, and npm packages — validating every
 * candidate against the plugin contract before storing it.
 *
 * Sources (SPEC-plugin-loader.md §3):
 * - programmatic: `register(validPlugin)`
 * - local file:   `load('./my-plugin.js')` — resolved against `baseDir`
 * - npm package:  `load('file-organizer-compress-plugin')` — resolved with
 *   `createRequire` rooted at `baseDir` (the user's project, never the CLI's
 *   own install tree)
 *
 * Edge functions (`fileExists` / `resolvePackage` / `importModule`) are
 * injectable so unit tests stay pure; defaults use fs-extra, Node's
 * `createRequire`, and a `pathToFileURL`-based dynamic import (Windows-safe).
 */
import path from 'path';
import fs from 'fs-extra';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

import { PluginError, validatePlugin } from './contract.js';
import type { OrganizerPlugin } from './contract.js';

/** Local specs start with ./ or ../ or are absolute; anything else is an npm bare specifier. */
function isLocalSpec(spec: string): boolean {
  return path.isAbsolute(spec) || spec.startsWith('./') || spec.startsWith('../');
}

/** Single error-message mapping shared by every catch site below. */
function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Local path or npm package could not be resolved. */
export class PluginNotFoundError extends PluginError {
  constructor(message: string, pluginName?: string) {
    super(message, pluginName);
    this.name = 'PluginNotFoundError';
  }
}

/** The module itself failed to import (syntax error, bad build). */
export class PluginLoadError extends PluginError {
  constructor(message: string, pluginName: string | undefined, cause: unknown) {
    super(message, pluginName);
    this.name = 'PluginLoadError';
    this.cause = cause;
  }
}

/** The module exists but exposes no default export. */
export class PluginExportError extends PluginError {
  constructor(message: string, pluginName?: string) {
    super(message, pluginName);
    this.name = 'PluginExportError';
  }
}

/** A plugin with the same name is already registered. */
export class DuplicatePluginError extends PluginError {
  constructor(message: string, pluginName?: string) {
    super(message, pluginName);
    this.name = 'DuplicatePluginError';
  }
}

/**
 * Filesystem/system seams of the loader. All optional; real defaults keep
 * production behavior, tests inject fakes (no module mocking needed).
 */
export interface LoaderEdges {
  fileExists?(candidatePath: string): Promise<boolean>;
  resolvePackage?(name: string): string;
  importModule?(modulePath: string): Promise<unknown>;
}

export interface LoadOptions {
  /** Directory local specs resolve against; also roots npm resolution. Defaults to cwd. */
  baseDir?: string;
}

function extractDefaultCandidate(namespace: unknown, spec: string): unknown {
  if (typeof namespace !== 'object' || namespace === null) {
    throw new PluginExportError(
      `Plugin module "${spec}" has no default export; plugins must use \`export default { ... }\``,
      spec
    );
  }
  const holder = namespace as Record<string, unknown>;
  if (!('default' in holder) || holder['default'] === undefined) {
    throw new PluginExportError(
      `Plugin module "${spec}" has no default export; plugins must use \`export default { ... }\``,
      spec
    );
  }
  return holder['default'];
}

async function defaultFileExists(candidatePath: string): Promise<boolean> {
  return fs.pathExists(candidatePath);
}

function defaultResolvePackage(name: string, baseDir: string): string {
  const requireFromBase = createRequire(path.join(baseDir, 'package.json'));
  return requireFromBase.resolve(name);
}

async function defaultImportModule(modulePath: string): Promise<unknown> {
  // Escape any test-runner module graph (vite-node intercepts dynamic import
  // and fails to resolve temp-dir file URLs on Windows CI). `new Function`
  // compiles the import outside the module scope, forcing the REAL Node ESM
  // loader — which is exactly the production contract for plugin loading.
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<unknown>;
  return dynamicImport(pathToFileURL(modulePath).href);
}

/**
 * Holds validated, uniquely-named plugins. Validation and dedup happen in a
 * single point (`add`), whichever source the plugin came from.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, OrganizerPlugin>();
  private readonly edges: LoaderEdges;

  constructor(edges: LoaderEdges = {}) {
    this.edges = edges;
  }

  /** Register a programmatic plugin; validates and enforces name uniqueness. */
  register(plugin: OrganizerPlugin): OrganizerPlugin {
    return this.add(plugin, 'register()');
  }

  /** Snapshot of registered plugins, in registration order. */
  list(): readonly OrganizerPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Load a plugin from a local file spec ('./x.js', '../y.js', absolute) or
   * an npm bare specifier, validate it against the contract, and register it.
   */
  async load(spec: string, options: LoadOptions = {}): Promise<OrganizerPlugin> {
    const baseDir = options.baseDir ?? process.cwd();
    const modulePath = await this.resolveSpec(spec, baseDir);
    const namespace = await this.importNamespace(modulePath, spec);
    const candidate = extractDefaultCandidate(namespace, spec);
    return this.add(candidate, spec);
  }

  private add(candidate: unknown, source: string): OrganizerPlugin {
    const validated = validatePlugin(candidate);
    if (this.plugins.has(validated.name)) {
      throw new DuplicatePluginError(
        `A plugin named "${validated.name}" is already registered (source: ${source})`,
        validated.name
      );
    }
    this.plugins.set(validated.name, validated);
    return validated;
  }

  private async resolveSpec(spec: string, baseDir: string): Promise<string> {
    if (isLocalSpec(spec)) {
      const resolved = path.resolve(baseDir, spec);
      const fileExists = this.edges.fileExists ?? defaultFileExists;
      if (!(await fileExists(resolved))) {
        throw new PluginNotFoundError(`Plugin file not found: ${resolved}`, spec);
      }
      return resolved;
    }
    const resolvePackage =
      this.edges.resolvePackage ??
      ((name: string) => defaultResolvePackage(name, baseDir));
    try {
      return resolvePackage(spec);
    } catch (err) {
      throw new PluginNotFoundError(
        `Plugin package "${spec}" could not be resolved from "${baseDir}": ${errorText(err)}`,
        spec
      );
    }
  }

  private async importNamespace(modulePath: string, spec: string): Promise<unknown> {
    const importModule = this.edges.importModule ?? defaultImportModule;
    try {
      return await importModule(modulePath);
    } catch (err) {
      throw new PluginLoadError(
        `Failed to load plugin module "${modulePath}": ${errorText(err)}`,
        spec,
        err
      );
    }
  }
}
