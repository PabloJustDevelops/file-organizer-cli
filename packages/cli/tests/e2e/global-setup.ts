import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

/**
 * The E2E suite drives the packaged artifact, so build it once before the run.
 * This always rebuilds: a stale `dist/` would silently test old code, which is a
 * worse failure than the ~7 s it costs (SPEC-verification OQ-1).
 */
export function setup(): void {
  execSync('bun run build', { cwd: packageDir, stdio: 'pipe' });
}
