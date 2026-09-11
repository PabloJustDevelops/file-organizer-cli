#!/usr/bin/env node

import { startMcpServer } from './server.js';

// Dedicated MCP entry (`file-organizer-mcp`). Kept separate from server.ts so
// the server module stays importable without starting anything.
startMcpServer().catch((err) => {
  console.error('MCP server error:', err);
  process.exitCode = 1;
});
