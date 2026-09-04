/**
 * Library entry point — the programmatic API of file-organizer-cli.
 *
 * This is what `import { Organizer } from 'file-organizer-cli'` resolves to
 * (see package.json `exports['.']`). The CLI binary lives at
 * `exports['./bin']` and is untouched by this file: zero side effects here,
 * because library consumers must be able to import types and constants
 * without starting any process.
 *
 * Constitution Art. II: this surface re-exports from core; it adds no logic.
 */
export { Organizer } from './core/organizer.js';
export type {
  OrganizeOptions,
} from './core/organizer.js';
export { FileScanner } from './core/file-scanner.js';
export type { ScanOptions } from './core/file-scanner.js';
export { RulesEngine } from './core/rules-engine.js';

// Plugin system
export {
  PluginRegistry,
  PluginNotFoundError,
  PluginLoadError,
  PluginExportError,
  DuplicatePluginError,
} from './core/plugins/loader.js';
export {
  validatePlugin,
  PluginError,
  PluginTypeError,
  PluginFieldError,
} from './core/plugins/contract.js';
export type { OrganizerPlugin } from './core/plugins/contract.js';
export { runBeforeOrganize, runAfterOrganize } from './core/plugins/hooks.js';
export type { PluginHookError, PluginHookName } from './core/plugins/hooks.js';
export { collectPluginRules } from './core/plugins/rules.js';
export type { PluginRuleFailure, CollectedRules } from './core/plugins/rules.js';
export { applyTransforms } from './core/plugins/transform.js';
export type { TransformedFiles } from './core/plugins/transform.js';

// Config + history
export { loadConfig, saveConfig, findConfigPath } from './config/loader.js';
export { HistoryStore } from './utils/history-store.js';
export { logger, setLogLevel, setLogFilePath } from './utils/logger.js';
export type { LogLevel } from './utils/logger.js';

// Shared vocabulary (the types plugins and consumers speak)
export type {
  FileInfo,
  Rule,
  OrganizeConfig,
  OrganizeContext,
  OrganizeResult,
  MovedFile,
} from './types/index.js';
