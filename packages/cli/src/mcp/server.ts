#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import { Organizer } from '../core/organizer.js';
import { loadConfig, saveConfig, findConfigPath } from '../config/loader.js';
import type { Rule, OrganizeResult } from '../types/index.js';

/**
 * Pure tool-dispatch logic, no transport — so the tool behaviors can be
 * tested without stdio or MCP SDK plumbing. `options.historyDir` isolates
 * the organizer's history store (tests pass a temp dir; production uses the
 * default `~/.file-organizer`). It is NOT part of the MCP tool args schema.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown> = {},
  options: { historyDir?: string } = {}
): Promise<
  | { kind: 'text'; text: string }
  | { kind: 'result'; result: OrganizeResult; dryRun: boolean }
  | { kind: 'error'; text: string }
> {
  switch (name) {
    case 'organize_files': {
      const source = path.resolve(args.source as string);
      const configPath = (args.config as string) || findConfigPath(source);
      const dryRun = args.dryRun !== false;
      const recursive = (args.recursive as boolean) || false;

      if (!configPath) {
        return { kind: 'error', text: 'No config file found. Use "fo config init" to create one.' };
      }

      const config = await loadConfig(configPath);
      const organizer = new Organizer({ historyDir: options.historyDir });
      organizer.setRules(config.rules);

      const result = await organizer.organize(source, {
        dryRun,
        recursive,
        conflictResolution: config.conflictResolution || 'rename',
      });

      return { kind: 'result', result, dryRun };
    }

    case 'preview_organization': {
      const source = path.resolve(args.source as string);
      const configPath = (args.config as string) || findConfigPath(source);

      if (!configPath) {
        return { kind: 'error', text: 'No config file found.' };
      }

      const config = await loadConfig(configPath);
      const organizer = new Organizer({ historyDir: options.historyDir });
      organizer.setRules(config.rules);

      const result = await organizer.preview(source, { recursive: true });
      return { kind: 'result', result, dryRun: true };
    }

    case 'list_rules': {
      const configPath = (args.config as string) || findConfigPath(process.cwd());

      if (!configPath) {
        return { kind: 'error', text: 'No config file found.' };
      }

      const config = await loadConfig(configPath);
      const rulesList = config.rules
        .map((r: Rule, i: number) => `${i + 1}. ${r.name}: ${r.patterns.join(', ')} → ${r.destination}`)
        .join('\n');
      return { kind: 'text', text: `Rules (${config.rules.length}):\n${rulesList}` };
    }

    case 'add_rule': {
      const configPath = args.config as string;
      const config = await loadConfig(configPath);

      const newRule: Rule = {
        name: args.name as string,
        patterns: args.patterns as string[],
        destination: args.destination as string,
        priority: (args.priority as number) || 0,
      };

      config.rules.push(newRule);
      await saveConfig(configPath, config);
      return { kind: 'text', text: `Rule "${newRule.name}" added successfully.` };
    }

    case 'undo_last': {
      const organizer = new Organizer({ historyDir: options.historyDir });
      const result = await organizer.undo();

      if (!result) {
        return { kind: 'text', text: 'No operations to undo.' };
      }
      return { kind: 'result', result, dryRun: false };
    }

    default:
      return { kind: 'error', text: `Unknown tool: ${name}` };
  }
}

function formatResult(
  outcome: Awaited<ReturnType<typeof handleToolCall>>
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  if (outcome.kind === 'error') {
    return { content: [{ type: 'text', text: `Error: ${outcome.text}` }], isError: true };
  }

  if (outcome.kind === 'text') {
    return { content: [{ type: 'text', text: outcome.text }] };
  }

  const { result, dryRun } = outcome;
  const summary = `Organization ${dryRun ? 'preview' : 'complete'}:\n` +
    `- Files ${dryRun ? 'to move' : 'moved'}: ${result.moved.length}\n` +
    `- Skipped: ${result.skipped.length}\n` +
    `- Errors: ${result.errors.length}`;
  return { content: [{ type: 'text', text: summary }] };
}

const server = new Server(
  {
    name: 'file-organizer',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'organize_files',
        description: 'Organize files in a directory based on configured rules',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source directory to organize',
            },
            config: {
              type: 'string',
              description: 'Path to config YAML file (optional)',
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview changes without moving files',
              default: true,
            },
            recursive: {
              type: 'boolean',
              description: 'Scan subdirectories',
              default: false,
            },
          },
          required: ['source'],
        },
      },
      {
        name: 'preview_organization',
        description: 'Preview how files would be organized without moving them',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source directory to scan',
            },
            config: {
              type: 'string',
              description: 'Path to config YAML file (optional)',
            },
          },
          required: ['source'],
        },
      },
      {
        name: 'list_rules',
        description: 'List all configured organization rules',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'string',
              description: 'Path to config YAML file (optional)',
            },
          },
        },
      },
      {
        name: 'add_rule',
        description: 'Add a new organization rule to config',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'string',
              description: 'Path to config YAML file',
            },
            name: {
              type: 'string',
              description: 'Rule name',
            },
            patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns (e.g., *.jpg, *.png)',
            },
            destination: {
              type: 'string',
              description: 'Destination path (e.g., ./images/{year}/{month})',
            },
            priority: {
              type: 'number',
              description: 'Rule priority (higher = applied first)',
              default: 0,
            },
          },
          required: ['config', 'name', 'patterns', 'destination'],
        },
      },
      {
        name: 'undo_last',
        description: 'Undo the last organization operation',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    return formatResult(await handleToolCall(name, args as Record<string, unknown>));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('File Organizer MCP server running on stdio');
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
