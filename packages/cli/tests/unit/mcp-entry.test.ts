import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cliTestContext } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-4: `src/mcp/index.ts` at 100% (the `file-organizer-mcp`
 * bin). The module is import-and-run wiring, so `startMcpServer` is mocked and
 * the import itself is the unit under test — no stdio is ever opened.
 */
const { startServerMock } = vi.hoisted(() => ({ startServerMock: vi.fn() }));

vi.mock('../../src/mcp/server.js', () => ({
  startMcpServer: startServerMock,
  createMcpServer: vi.fn(),
  handleToolCall: vi.fn(),
}));

const ctx = cliTestContext('mcp-entry');

beforeEach(() => {
  startServerMock.mockReset();
  vi.resetModules();
});

describe('mcp entrypoint', () => {
  it('starts the stdio server without reporting a failure', async () => {
    startServerMock.mockResolvedValue(undefined);

    await import('../../src/mcp/index.js');
    await vi.waitFor(() => expect(startServerMock).toHaveBeenCalled());

    expect(process.exitCode).toBe(0);
    expect(ctx.captured.error).toHaveLength(0);
  });

  it('reports a startup failure on stderr and sets exitCode 1', async () => {
    startServerMock.mockRejectedValue(new Error('stdio unavailable'));

    await import('../../src/mcp/index.js');
    await vi.waitFor(() => expect(process.exitCode).toBe(1));

    expect(ctx.captured.error.join('\n')).toContain('MCP server error');
    expect(ctx.captured.error.join('\n')).toContain('stdio unavailable');
  });
});
