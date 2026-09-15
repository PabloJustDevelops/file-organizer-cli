import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
