import { Command } from 'commander';
import { setLogLevel } from '../../utils/logger.js';
import { fail } from '../ui/output.js';

export const mcpCommand = new Command('mcp')
  .description('Run the MCP server over stdio (for MCP clients)')
  .action(async () => {
    // stdout is the MCP protocol channel — logs must never land there.
    setLogLevel('error');
    try {
      // Loaded lazily: `fo <command>` must not pull the MCP SDK into the CLI
      // entry for users who never run the server.
      const { startMcpServer } = await import('../../mcp/server.js');
      await startMcpServer();
    } catch (err) {
      fail(err instanceof Error ? err.message : 'MCP server failed');
    }
  });
