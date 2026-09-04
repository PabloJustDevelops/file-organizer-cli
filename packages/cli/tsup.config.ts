import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'cli/index': 'src/cli/index.ts',
    'mcp/server': 'src/mcp/server.ts',
    'tui/index': 'src/tui/index.tsx',
    'index': 'src/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  clean: true,    splitting: false,
    sourcemap: true,
    dts: true,
    shims: false,
  external: ['react', 'ink'],
});
