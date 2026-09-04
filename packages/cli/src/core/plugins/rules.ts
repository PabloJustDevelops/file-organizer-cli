/**
 * Plugin-contributed rules: pure collection + validation + isolation.
 *
 * A plugin's `customRules()` output is validated with the same validator as
 * YAML rules (core/rule-validation.ts). One invalid rule never sinks the
 * plugin's other rules; conflicts with config rule names are captured and
 * the config rule wins. Failures flow through `pluginErrors`
 * (`hook: 'customRules'`) — the single plugin-contribution error channel.
 */
import type { Rule } from '../../types/index.js';
import type { OrganizerPlugin } from './contract.js';
import { validateRuleCore } from '../rule-validation.js';
import type { PluginHookError } from './hooks.js';

/** Per-rule injection failure, reported through `result.pluginErrors`. */
export type PluginRuleFailure = PluginHookError; // { plugin, hook: 'customRules', error }

/** Result of collecting rules from every plugin. */
export interface CollectedRules {
  rules: Rule[];
  failures: PluginRuleFailure[];
}

function failure(plugin: string, error: string): PluginRuleFailure {
  return { plugin, hook: 'customRules', error };
}

/** Single error-message mapping shared by both catch sites. */
function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Call `customRules()` on every plugin that has it and validate the output.
 * Never throws. Per-plugin isolation (throwing/non-array customRules) and
 * per-rule isolation (one bad rule doesn't sink the plugin's other rules).
 *
 * NOTE: does NOT deduplicate against the engine — name conflict detection
 * lives at the injection site (Organizer), which knows the engine state.
 */
export async function collectPluginRules(
  plugins: readonly OrganizerPlugin[]
): Promise<CollectedRules> {
  const rules: Rule[] = [];
  const failures: PluginRuleFailure[] = [];

  for (const plugin of plugins) {
    if (!plugin.customRules) continue;

    try {
      const output: unknown = plugin.customRules();
      if (!Array.isArray(output)) {
        failures.push(failure(plugin.name, 'customRules() must return an array of rules'));
        continue;
      }

      for (const [index, candidate] of output.entries()) {
        try {
          rules.push(validateRuleCore(candidate));
        } catch (err) {
          failures.push(failure(plugin.name, `rule[${index}]: ${toMessage(err)}`));
          // Isolation: other rules from this same plugin still get injected.
        }
      }
    } catch (err) {
      failures.push(failure(plugin.name, `customRules() threw: ${toMessage(err)}`));
    }
  }

  return { rules, failures };
}
