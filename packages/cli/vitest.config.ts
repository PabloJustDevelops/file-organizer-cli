import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
      // Ratchet (Constitution Art. IV): set just under the current global
      // numbers so new uncovered code fails CI instead of silently lowering
      // the bar. Raise these as coverage improves — never lower them.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
