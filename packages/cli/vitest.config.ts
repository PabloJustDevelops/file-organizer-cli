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
      // Core logic files only — command/UI wrappers are exercised via E2E,
      // not unit tests, so counting them would dilute the signal.
      include: [
        'src/core/**/*.ts',
        'src/utils/**/*.ts',
        'src/config/loader.ts',
      ],
      exclude: ['src/**/*.d.ts'],
      // Ratchet (ADR-0006, Constitution Art. IV): set just under the current
      // global numbers so new uncovered code fails CI instead of silently
      // lowering the bar. Raise these as coverage improves — never lower them.
      // 2026-09-12: all four metrics at 100% on the included surface
      // (core/**, utils/**, config/loader.ts) after the branch-coverage pass.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
