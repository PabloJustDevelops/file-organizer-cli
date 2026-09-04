export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isDirectory: boolean;
}

export interface RuleCondition {
  type: 'regex' | 'extension' | 'size' | 'date';
  match?: string;
  pattern?: string;
  extensions?: string[];
  minSize?: number;
  maxSize?: number;
  after?: string;
  before?: string;
}

export interface Rule {
  name: string;
  patterns: string[];
  destination: string;
  condition?: RuleCondition;
  priority?: number;
  enabled?: boolean;
}

export interface OrganizeConfig {
  rules: Rule[];
  conflictResolution?: ConflictResolution;
  dryRun?: boolean;
  recursive?: boolean;
  includeHidden?: boolean;
  /** BCP-47 locale for {monthName} and {now:*} template variables (default: en-US) */
  locale?: string;
  /** Size thresholds (bytes) for the {sizeBucket} template variable. */
  sizeBuckets?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  /** Plugin specs (local paths relative to this config file, or npm package names). */
  plugins?: string[];
}

export type ConflictResolution = 'rename' | 'overwrite' | 'skip' | 'newest';

export interface OrganizeResult {
  moved: MovedFile[];
  skipped: SkippedFile[];
  errors: OrganizeError[];
  /** Captured plugin hook failures; absent when empty (error isolation: never fatal). */
  pluginErrors?: PluginHookError[];
}

export type { PluginHookError } from '../core/plugins/hooks.js';
import type { PluginHookError } from '../core/plugins/hooks.js';

export interface MovedFile {
  from: string;
  to: string;
  rule: string;
}

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface OrganizeError {
  file: string;
  error: string;
}

export interface UndoEntry {
  id: string;
  timestamp: Date;
  operations: MovedFile[];
  /** Files clobbered by overwrite/newest resolutions, backed up for undo. */
  replaced?: ReplacedFile[];
}

export interface ReplacedFile {
  /** Where the overwritten file used to live. */
  path: string;
  /** Where its backup now lives (inside history dir). */
  backupPath: string;
}

export interface AppConfig {
  defaultRules: Rule[];
  historySize: number;
  conflictResolution: ConflictResolution;
  watchIgnorePatterns: string[];
  plugins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface OrganizeContext {
  source: string;
  config: OrganizeConfig;
  files: FileInfo[];
  results: OrganizeResult;
}

// Single definition lives in core/plugins/contract.ts; re-exported for
// backward compatibility with existing imports of `types`.
export type { OrganizerPlugin } from '../core/plugins/contract.js';
