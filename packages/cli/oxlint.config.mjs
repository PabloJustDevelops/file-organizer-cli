import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "**/.agent/**",
    "**/.agents/**",
    "**/.claude/**",
    "**/.codex/**",
    "**/.continue/**",
    "**/.cursor/**",
    "**/.gemini/**",
    "**/.opencode/**",
    "**/.pi/**",
    "**/.roo/**",
    "**/.windsurf/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/tools/oxlint/anti-slop/**",
  ],
  jsPlugins: [
    {
      name: "anti-slop",
      specifier: "./tools/oxlint/anti-slop/index.ts",
    },
  ],
  rules: {
    // ── Rules that make sense for a CLI tool ──
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",

    // ── Disabled: too restrictive for CLI context ──
    // "anti-slop/no-module-mocking": "error",        // CLI tests use memfs
    // "anti-slop/no-runtime-typeof": "error",        // typeof needed for arg parsing
    // "anti-slop/require-safety-comment-for-type-assertion": "error", // Too verbose
  },
});
