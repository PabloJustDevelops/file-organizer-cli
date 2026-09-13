import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cliTestContext, runCommand } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-8: `src/cli/commands/mcp.ts` at 100%.
 * `fo mcp` is stdio wiring, so the server module is mocked — importing the real
 * one would open the protocol channel on the test runner's own stdin/stdout.
 */
const { startMcpServerMock } = vi.hoisted(() => ({ startMcpServerMock: vi.fn() }));

vi.mock('../../src/mcp/server.js', () => ({
  startMcpServer: startMcpServerMock,
  createMcpServer: vi.fn(),
  handleToolCall: vi.fn(),
}));

const ctx = cliTestContext('mcp-command');

beforeEach(() => {
  startMcpServerMock.mockReset();
});

async function loadMcpCommandWithLogger() {
  vi.resetModules();
  const [{ mcpCommand }, logger] = await Promise.all([
    import('../../src/cli/commands/mcp.js'),
    import('../../src/utils/logger.js'),
  ]);
  return { mcpCommand, logger };
}

describe('fo mcp', () => {
  it('starts the server, silences stdout and succeeds', async () => {
    startMcpServerMock.mockResolvedValue(undefined);
    const { mcpCommand, logger } = await loadMcpCommandWithLogger();

    await runCommand(mcpCommand, []);

    expect(process.exitCode).toBe(0);
    expect(startMcpServerMock).toHaveBeenCalled();
    // stdout is the MCP protocol channel: info/debug logging must be off.
    expect(logger.getLogLevel()).toBe('error');
    expect(ctx.captured.log).toHaveLength(0);
  });

  it('reports a startup failure', async () => {
    startMcpServerMock.mockRejectedValue(new Error('stdio unavailable'));
    const { mcpCommand } = await loadMcpCommandWithLogger();

    await runCommand(mcpCommand, []);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('stdio unavailable');
  });

  it('reports a non-Error startup failure', async () => {
    startMcpServerMock.mockRejectedValue('plain failure');
    const { mcpCommand } = await loadMcpCommandWithLogger();

    await runCommand(mcpCommand, []);

    expect(process.exitCode).toBe(1);
    expect(ctx.text()).toContain('MCP server failed');
  });
});
