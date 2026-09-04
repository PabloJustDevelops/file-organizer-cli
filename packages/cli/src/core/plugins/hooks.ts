/**
 * Plugin lifecycle hooks: sequential, ordered, isolated execution of
 * `beforeOrganize` / `afterOrganize` around the organize pipeline.
 *
 * Isolation contract (SPEC-plugin-hooks.md §3): a hook that throws is
 * captured as a PluginHookError and the remaining plugins continue — a
 * failing plugin never aborts an organize run. Failures are reported, never
 * swallowed: callers log and surface them via `OrganizeResult.pluginErrors`.
 */
import type { OrganizerPlugin } from './contract.js';
import type { OrganizeContext } from '../../types/index.js';

export type PluginHookName =
  | 'beforeOrganize'
  | 'afterOrganize'
  | 'customRules'
  | 'transform';

/** A captured hook failure. Reported, never fatal. */
export interface PluginHookError {
  plugin: string;
  hook: PluginHookName;
  error: string;
}

function runSingleHook(
  plugin: OrganizerPlugin,
  hook: 'beforeOrganize' | 'afterOrganize',
  context: OrganizeContext
): Promise<void> {
  const fn = plugin[hook];
  if (!fn) return Promise.resolve();
  return fn.call(plugin, context);
}

function captureHookError(
  plugin: OrganizerPlugin,
  hook: PluginHookName,
  err: unknown
): PluginHookError {
  return {
    plugin: plugin.name,
    hook,
    error: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Run `beforeOrganize` on every plugin that has it, sequentially, in
 * registration order. Never throws — returns captured failures instead.
 */
export async function runBeforeOrganize(
  plugins: readonly OrganizerPlugin[],
  context: OrganizeContext
): Promise<PluginHookError[]> {
  const failures: PluginHookError[] = [];
  for (const plugin of plugins) {
    try {
      await runSingleHook(plugin, 'beforeOrganize', context);
    } catch (err) {
      failures.push(captureHookError(plugin, 'beforeOrganize', err));
    }
  }
  return failures;
}

/**
 * Run `afterOrganize` on every plugin that has it, sequentially, in
 * registration order. Never throws — returns captured failures instead.
 */
export async function runAfterOrganize(
  plugins: readonly OrganizerPlugin[],
  context: OrganizeContext
): Promise<PluginHookError[]> {
  const failures: PluginHookError[] = [];
  for (const plugin of plugins) {
    try {
      await runSingleHook(plugin, 'afterOrganize', context);
    } catch (err) {
      failures.push(captureHookError(plugin, 'afterOrganize', err));
    }
  }
  return failures;
}
