/**
 * Plugin contract: the vocabulary shared by every plugin module
 * (loader, config, hooks, rules, transform). Pure logic — no I/O, no logger.
 *
 * Validation rules (SPEC-plugin-contract.md §3):
 * V1 candidate must be a non-null object
 * V2 `name` must be a non-empty kebab-case string
 * V3 `version` must be a valid semver string
 * V4 optional members, when present, must be functions
 * V5 a valid candidate is returned as-is (same reference, not mutated)
 *
 * Note: V4 checks that members are functions; Promise-returning behavior is
 * enforced by the interface types, not at runtime (invoking a plugin hook
 * during validation would be a side effect).
 */
import type { FileInfo, OrganizeContext, Rule } from '../../types/index.js';

/** Single definition of the plugin contract; re-exported from `types` for compatibility. */
export interface OrganizerPlugin {
  /** Kebab-case, unique among loaded plugins. */
  name: string;
  /** Valid semver (MAJOR.MINOR.PATCH, prerelease/build allowed). */
  version: string;
  beforeOrganize?(context: OrganizeContext): Promise<void>;
  afterOrganize?(context: OrganizeContext): Promise<void>;
  customRules?(): Rule[];
  transform?(file: FileInfo): Promise<FileInfo>;
}

/** Base class for every plugin-related error; consumers may catch this. */
export class PluginError extends Error {
  readonly pluginName?: string;

  constructor(message: string, pluginName?: string) {
    super(message);
    this.name = 'PluginError';
    if (pluginName !== undefined) {
      this.pluginName = pluginName;
    }
  }
}

/** The candidate was not even an object (V1). */
export class PluginTypeError extends PluginError {
  constructor(message: string) {
    super(message);
    this.name = 'PluginTypeError';
  }
}

/** A named field failed its validation rule (V2–V4). */
export class PluginFieldError extends PluginError {
  readonly field: string;

  constructor(field: string, message: string, pluginName?: string) {
    super(message, pluginName);
    this.name = 'PluginFieldError';
    this.field = field;
  }
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Full semver: MAJOR.MINOR.PATCH with optional prerelease and build metadata. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Optional members that must be functions when present (V4). */
const FUNCTION_MEMBERS: readonly string[] = [
  'beforeOrganize',
  'afterOrganize',
  'customRules',
  'transform',
];

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object' || typeof value === 'function') {
    return `a value of type ${typeof value}`;
  }
  if (typeof value === 'string') return `the string "${value}"`;
  return `a value of type ${typeof value}`;
}

function asRecord(candidate: object): Record<string, unknown> {
  return candidate as Record<string, unknown>;
}

/**
 * Validate an untrusted candidate against the plugin contract.
 * Returns the same object typed as `OrganizerPlugin` — never a clone.
 * Throws `PluginTypeError` (V1) or `PluginFieldError` (V2–V4) with
 * expected-vs-received detail.
 */
export function validatePlugin(candidate: unknown): OrganizerPlugin {
  if (typeof candidate !== 'object' || candidate === null) {
    throw new PluginTypeError(
      `Plugin must be an object, received ${describeValue(candidate)}`
    );
  }

  const record = asRecord(candidate);

  const name = record['name'];
  if (typeof name !== 'string' || !KEBAB_CASE.test(name)) {
    throw new PluginFieldError(
      'name',
      `Plugin "name" must be a non-empty kebab-case string (e.g. "my-plugin"), received ${describeValue(name)}`
    );
  }

  const version = record['version'];
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new PluginFieldError(
      'version',
      `Plugin "${name}" "version" must be valid semver (e.g. "1.0.0"), received ${describeValue(version)}`,
      name
    );
  }

  for (const member of FUNCTION_MEMBERS) {
    const value = record[member];
    if (value !== undefined && typeof value !== 'function') {
      throw new PluginFieldError(
        member,
        `Plugin "${name}" "${member}" must be a function when present, received ${describeValue(value)}`,
        name
      );
    }
  }

  return candidate as OrganizerPlugin;
}
