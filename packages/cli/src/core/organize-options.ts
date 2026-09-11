/**
 * Shared resolution of config + adapter overrides into `OrganizeOptions`.
 *
 * Both adapters (CLI and MCP) build their organize call here, so a default is
 * decided once — Constitution Art. II/VII: adapters must not reimplement core
 * behavior, and a parity bug is fixed in the core, then re-surfaced.
 *
 * Precedence: explicit override → config value → built-in default.
 */
import type { OrganizeConfig } from '../types/index.js';
import type { OrganizeOptions } from './organizer.js';

export interface OrganizeOverrides {
  dryRun?: boolean;
  recursive?: boolean;
  includeHidden?: boolean;
  conflictResolution?: OrganizeConfig['conflictResolution'];
  /** Directory that local plugin specs resolve against (usually the config's dir). */
  pluginBaseDir?: string;
}

export function buildOrganizeOptions(
  config: OrganizeConfig,
  overrides: OrganizeOverrides = {}
): OrganizeOptions {
  const options: OrganizeOptions = {
    // Carrying the whole config means `organize()` reads `rules`, `locale`,
    // `sizeBuckets` and `plugins` from the same source of truth — no field list
    // to keep in sync between adapters.
    config,
    dryRun: overrides.dryRun ?? config.dryRun ?? false,
    recursive: overrides.recursive ?? config.recursive ?? false,
    includeHidden: overrides.includeHidden ?? config.includeHidden ?? false,
    conflictResolution:
      overrides.conflictResolution ?? config.conflictResolution ?? 'rename',
  };

  if (overrides.pluginBaseDir !== undefined) {
    options.pluginBaseDir = overrides.pluginBaseDir;
  }

  return options;
}
