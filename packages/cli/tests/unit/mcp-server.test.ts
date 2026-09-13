import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { OrganizeConfig } from '../../src/types/index.js';
import fs from 'fs-extra';
import path from 'path';
import { cliTestContext, writeConfig, writeFixture } from './cli-harness.js';

/**
 * SPEC-adapter-coverage AC-4: `src/mcp/server.ts` at 100%.
 *
 * `handleToolCall` is already covered by `tests/integration/mcp-handlers.test.ts`;
 * what was dark is the transport wiring around it — `createMcpServer`'s two
 * request handlers, `formatResult` in all three of its shapes, and the stdio
 * entry. Those are exercised here through a real in-memory MCP round trip (a
 * real `Client` over `InMemoryTransport`), not by poking at internals.
 *
 * History isolation comes from the harness: `HistoryStore` captures
 * `os.homedir()` at module load, so every module here is imported fresh *after*
 * `cliTestContext` pointed HOME at the temp dir.
 */
const { transportStart } = vi.hoisted(() => ({ transportStart: vi.fn() }));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {
    onmessage: ((message: string) => void) | undefined;
    onerror: ((error: Error) => void) | undefined;
    onclose: (() => void) | undefined;
    async start() {
      await transportStart();
    }
    async close() {}
    async send() {}
  },
}));

const ctx = cliTestContext('mcp-server');

let client: Client | undefined;
let projectDir = '';
let emptyDir = '';
let configPath = '';

beforeEach(() => {
  projectDir = path.join(ctx.dir, 'project');
  emptyDir = path.join(ctx.dir, 'empty');
  fs.ensureDirSync(projectDir);
  fs.ensureDirSync(emptyDir);
  configPath = writeConfig(projectDir, {
    rules: [{ name: 'Images', patterns: ['*.jpg'], destination: './images' }],
  });
  writeFixture(projectDir, 'photo.jpg', 'jpeg-bytes');
});

afterEach(async () => {
  if (client) {
    await client.close();
    client = undefined;
  }
});

async function connectServer(): Promise<Client> {
  vi.resetModules();
  const { createMcpServer } = await import('../../src/mcp/server.js');
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const connected = new Client({ name: 'fo-test-client', version: '0.0.0' });

  await server.connect(serverTransport);
  await connected.connect(clientTransport);

  client = connected;
  return connected;
}

function firstText(result: CallToolResult): string {
  for (const item of result.content) {
    if (item.type === 'text') return item.text;
  }
  return '';
}

describe('createMcpServer()', () => {
  it('advertises the five tools and defaults organize_files to a dry run', async () => {
    const connected = await connectServer();

    const { tools } = await connected.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'organize_files',
      'preview_organization',
      'list_rules',
      'add_rule',
      'undo_last',
    ]);
    const organize = tools.find((tool) => tool.name === 'organize_files');
    const properties = organize?.inputSchema.properties ?? {};
    expect(properties.dryRun).toMatchObject({ default: true });
  });

  it('lists rules through the text result shape', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'list_rules',
      arguments: { config: configPath },
    });

    expect(result.isError).toBeFalsy();
    expect(firstText(result)).toContain('Images');
    expect(firstText(result)).toContain('*.jpg');
  });

  it('previews by default and leaves the filesystem untouched', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'organize_files',
      arguments: { source: projectDir, config: configPath },
    });

    expect(firstText(result)).toContain('preview');
    expect(await fs.pathExists(path.join(projectDir, 'images', 'photo.jpg'))).toBe(false);
  });

  it('applies the organize when dryRun is false and can undo it', async () => {
    const connected = await connectServer();

    const applied = await connected.callTool({
      name: 'organize_files',
      arguments: { source: projectDir, config: configPath, dryRun: false },
    });
    expect(firstText(applied)).toContain('complete');
    expect(await fs.pathExists(path.join(projectDir, 'images', 'photo.jpg'))).toBe(true);

    const undone = await connected.callTool({ name: 'undo_last', arguments: {} });
    expect(firstText(undone)).toContain('complete');
    expect(await fs.pathExists(path.join(projectDir, 'photo.jpg'))).toBe(true);
  });

  it('persists a new rule', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'add_rule',
      arguments: {
        config: configPath,
        name: 'Docs',
        patterns: ['*.pdf'],
        destination: './docs',
      },
    });

    expect(firstText(result)).toContain('Docs');
    expect(await fs.readFile(configPath, 'utf-8')).toContain('Docs');
  });

  it('reports a missing config as an error result', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'organize_files',
      arguments: { source: emptyDir },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('No config file found');
  });

  it('reports a missing config for a preview too', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'preview_organization',
      arguments: { source: emptyDir },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('No config file found');
  });

  it('reports an unknown tool as an error result', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({ name: 'not_a_tool', arguments: {} });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('Unknown tool');
  });

  it('turns a thrown Error into an error result', async () => {
    const connected = await connectServer();

    const result = await connected.callTool({
      name: 'list_rules',
      arguments: { config: path.join(projectDir, 'absent.yaml') },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('Config file not found');
  });
});

describe('with a stubbed loader', () => {
  interface StubLoader {
    loadConfig: () => Promise<OrganizeConfig>;
    /** When given, replaces rule validation so a non-Error throw can be simulated. */
    validateRule?: () => never;
  }

  afterEach(() => {
    vi.doUnmock('../../src/config/loader.js');
    vi.doUnmock('../../src/core/rule-validation.js');
  });

  async function connectWithStub(stub: StubLoader): Promise<Client> {
    vi.resetModules();
    vi.doMock('../../src/config/loader.js', () => ({
      findConfigPath: () => null,
      loadConfig: stub.loadConfig,
      saveConfig: async () => {},
    }));
    if (stub.validateRule) {
      vi.doMock('../../src/core/rule-validation.js', () => ({
        validateRuleCore: stub.validateRule,
      }));
    } else {
      vi.doUnmock('../../src/core/rule-validation.js');
    }

    const { createMcpServer } = await import('../../src/mcp/server.js');
    const server = createMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const connected = new Client({ name: 'fo-stub-client', version: '0.0.0' });
    await server.connect(serverTransport);
    await connected.connect(clientTransport);
    client = connected;
    return connected;
  }

  it('list_rules reports that no config was found', async () => {
    const connected = await connectWithStub({
      loadConfig: async () => {
        throw new Error('loadConfig must not be reached without a config path');
      },
    });

    const result = await connected.callTool({ name: 'list_rules', arguments: {} });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('No config file found');
  });

  it('reports a non-Error throw as an unknown error', async () => {
    const plainFailure = 'plain failure';
    const connected = await connectWithStub({
      loadConfig: async () => {
        throw plainFailure;
      },
    });

    const result = await connected.callTool({
      name: 'list_rules',
      arguments: { config: 'anything.yaml' },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('Unknown error');
  });

  it('add_rule reports a non-Error validation failure as an invalid rule', async () => {
    const plainFailure = 'malformed rule';
    const connected = await connectWithStub({
      loadConfig: async () => ({ rules: [] }),
      validateRule: () => {
        throw plainFailure;
      },
    });

    const result = await connected.callTool({
      name: 'add_rule',
      arguments: {
        config: 'anything.yaml',
        name: 'Broken',
        patterns: ['*.broken'],
        destination: './broken',
      },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain('Invalid rule');
  });
});

describe('startMcpServer()', () => {
  it('connects the stdio transport and reports on stderr, never stdout', async () => {
    vi.resetModules();
    const { startMcpServer } = await import('../../src/mcp/server.js');

    await startMcpServer();

    expect(transportStart).toHaveBeenCalled();
    expect(ctx.captured.error.join('\n')).toContain('running on stdio');
    // stdout is the protocol channel; nothing may be written there.
    expect(ctx.stdout).toBe('');
  });
});
