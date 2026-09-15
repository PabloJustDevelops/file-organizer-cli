import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // vitest 5's per-worker startup (fresh Vite server per isolated test
    // file) adds real time on top of the e2e tests that spawn a subprocess
    // (built binary, `npm pack`/`npm install`). Measured on this machine
    // (vitest 5.0.1 + vite 8.3.0, default fileParallelism): the slowest cases
    // are tests/e2e/safe-mutations.test.ts's dedup/undo round-trip at ~16.1s,
    // tests/e2e/install.test.ts's tarball install smoke at ~11.4s, and
    // tests/integration/packaging.test.ts's `npm pack` at ~8.7s — all above
    // the 5s default but nowhere near this ceiling, so raising it is not
    // masking a hang. `fileParallelism: false` was tried and made the whole
    // suite ~2.5x slower (114s vs 47s) without shortening the slow tests
    // (each still runs alone), so a single serialized run buys nothing.
    testTimeout: 20000,
    // E2E drives the built binary, so build it once before the suite runs.
    globalSetup: ['./tests/e2e/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // The whole shipped source except the TUI internals (ADR-0010). The E2E
      // suite drives the built binary in a child process, so it earns no v8
      // coverage — the adapter layer is covered in-process instead
      // (SPEC-adapter-coverage). `src/tui/**` stays out: Ink rendering
      // internals are not an adapter contract. `fo tui`'s CLI wrapper does
      // count (src/cli/commands/tui.ts).
      include: [
        'src/core/**/*.ts',
        'src/utils/**/*.ts',
        'src/config/loader.ts',
        'src/cli/**/*.ts',
        'src/mcp/**/*.ts',
      ],
      exclude: ['src/**/*.d.ts'],
      // Ratchet (ADR-0006, Constitution Art. IV): set just under the current
      // global numbers so new uncovered code fails CI instead of silently
      // lowering the bar. Raise these as coverage improves — never lower them.
      // 2026-09-12: all four metrics at 100% across the widened surface after
      // the adapter-coverage pass (ADR-0010); the adapter layer was driven to
      // 100% in the same change, so no numeric threshold was lowered.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
