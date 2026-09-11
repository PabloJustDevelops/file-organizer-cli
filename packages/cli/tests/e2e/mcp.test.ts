import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The MCP surface must be *reachable* (SPEC-mcp-surface AC-2, AC-3, AC-12,
 * AC-13). This drives the **built** entry over stdio with real JSON-RPC, exactly
 * as an MCP client would, and checks that stdout carries nothing but protocol.
 */
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mcpEntry = path.join(packageDir, 'dist', 'mcp', 'index.js');
const packageVersion = (
  JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf-8')) as {
    version: string;
  }
).version;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number;
  result?: {
    serverInfo?: { name?: string; version?: string };
    tools?: { name: string }[];
  };
}

function handshake(): Promise<{ lines: string[]; messages: JsonRpcMessage[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [mcpEntry], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buffer = '';
    const lines: string[] = [];

    const done = () => {
      child.kill();
      resolve({
        lines,
        messages: lines.map((line) => JSON.parse(line) as JsonRpcMessage),
      });
    };

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      let index = buffer.indexOf('\n');
      while (index !== -1) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line !== '') lines.push(line);
        index = buffer.indexOf('\n');
      }
      // initialize response + tools/list response
      if (lines.length >= 2) done();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (lines.length < 2) reject(new Error(`MCP server exited early (code ${code})`));
    });

    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'fo-e2e', version: '0' },
      },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

    setTimeout(() => reject(new Error('MCP handshake timed out')), 20_000);
  });
}

describe('MCP surface (e2e, built binary)', () => {
  it('AC-2/AC-3/AC-13: handshake works and stdout is pure JSON-RPC', async () => {
    const { lines, messages } = await handshake();

    // AC-3: every stdout line is a parseable JSON-RPC frame (no log leakage).
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
      expect(line.startsWith('{')).toBe(true);
    }

    const init = messages.find((m) => m.id === 1);
    const tools = messages.find((m) => m.id === 2);

    // AC-13: the server reports the package version, not a hardcoded one.
    expect(init?.result?.serverInfo?.name).toBe('file-organizer');
    expect(init?.result?.serverInfo?.version).toBe(packageVersion);

    // AC-2: the tool registry is exposed.
    const names = (tools?.result?.tools ?? []).map((t) => t.name).sort();
    expect(names).toEqual([
      'add_rule',
      'list_rules',
      'organize_files',
      'preview_organization',
      'undo_last',
    ]);
  });

  it('AC-12: importing the server module does not start it or touch stdout', () => {
    const entryUrl = pathToFileURL(mcpEntry).href;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import('${entryUrl}'); console.log('IMPORTED');`],
      { encoding: 'utf-8', timeout: 20_000 }
    );

    // Exactly one line: the marker. A top-level main() would have printed the
    // startup notice and/or hung waiting on stdio.
    expect(output.trim()).toBe('IMPORTED');
  });
});
