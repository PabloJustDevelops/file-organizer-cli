/**
 * Plugin file transforms: pure mapping of the scanned working set before
 * rule matching (SPEC-plugin-transform.md D1–D5).
 *
 * Isolation contract: a transform that throws (or returns garbage) for one
 * file is captured and that file keeps its pre-plugin state — the rest of
 * the plugin's files and all later plugins still apply. Failures are
 * reported, never fatal, through the single plugin-contribution channel
 * (`result.pluginErrors`, hook: 'transform').
 *
 * v1 semantics (D3): decision-layer only — transformed metadata drives rule
 * matching and destination paths; the on-disk file is never touched here.
 */
import type { FileInfo } from '../../types/index.js';
import type { OrganizerPlugin } from './contract.js';
import type { PluginHookError } from './hooks.js';

/** Result of applying transforms to the scanned working set. */
export interface TransformedFiles {
  files: FileInfo[];
  failures: PluginHookError[];
}

function failure(plugin: string, error: string): PluginHookError {
  return { plugin, hook: 'transform', error };
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isFileInfoLike(value: unknown): value is FileInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FileInfo).path === 'string' &&
    typeof (value as FileInfo).name === 'string'
  );
}

/**
 * Apply `transform(file)` on every plugin that has it, sequentially in
 * registration order, per file. Never throws. Plugins compose: the next
 * transforming plugin receives the previous plugin's output.
 */
export async function applyTransforms(
  plugins: readonly OrganizerPlugin[],
  files: readonly FileInfo[]
): Promise<TransformedFiles> {
  let working: FileInfo[] = [...files];
  const failures: PluginHookError[] = [];

  for (const plugin of plugins) {
    if (!plugin.transform) continue;

    const next: FileInfo[] = [];
    for (const [index, file] of working.entries()) {
      try {
        const transformed: unknown = await plugin.transform(file);
        if (!isFileInfoLike(transformed)) {
          // Untrusted return (D5): null/garbage would poison matchFiles —
          // per-file failure, original kept.
          const what =
            transformed === null
              ? 'null'
              : typeof transformed === 'object'
                ? 'an object without a string path/name'
                : `a value of type ${typeof transformed}`;
          failures.push(
            failure(
              plugin.name,
              `transform(file[${index}]) must return a FileInfo, received ${what}`
            )
          );
          next.push(file);
          continue;
        }
        next.push(transformed);
      } catch (err) {
        // Per-file isolation (D4): this file stays as-is; the rest continue.
        failures.push(failure(plugin.name, `transform(file[${index}]) threw: ${toMessage(err)}`));
        next.push(file);
      }
    }
    working = next;
  }

  return { files: working, failures };
}
