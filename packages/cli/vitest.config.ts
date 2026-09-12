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
      // 2026-09-11: actuals 98.55 / 95.54 / 100 / 98.55 after the cycle-2
      // branch-coverage pass; raised from 90 across the board.
      thresholds: {
        statements: 96,
        branches: 93,
        functions: 98,
        lines: 96,
      },
    },
  },
});
