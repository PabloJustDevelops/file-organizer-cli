import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the adoption docs (SPEC-adoption-docs AC-1, AC-3, AC-5, AC-6, AC-7,
 * AC-9). Only presence and heading shape are asserted — prose is checked by
 * review, not by a brittle string match.
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

describe('adoption docs', () => {
  it('AC-6: CHANGELOG.md and CONTRIBUTING.md exist at the repo root', () => {
    for (const file of ['CHANGELOG.md', 'CONTRIBUTING.md']) {
      expect(fs.existsSync(path.join(repoRoot, file)), `missing ${file}`).toBe(true);
    }
  });

  it('AC-7: CHANGELOG follows Keep a Changelog headings', () => {
    const changelog = read('CHANGELOG.md');
    expect(changelog).toMatch(/^# Changelog$/m);
    expect(changelog).toMatch(/^## \[/m);
    expect(changelog).toMatch(/^### Added$/m);
    expect(changelog).toMatch(/^### Fixed$/m);
  });

  it('AC-1/AC-3/AC-5: README documents requirements, scripting, and troubleshooting', () => {
    const readme = read('README.md');
    expect(readme).toContain('## Requirements');
    expect(readme).toContain('Node.js >= 22.13.0');
    expect(readme).toContain('### Machine-readable output');
    expect(readme).toContain('## Troubleshooting');
  });

  it('AC-9: CONTRIBUTING covers the spec-first workflow and the commands', () => {
    const contributing = read('CONTRIBUTING.md');
    expect(contributing).toContain('bun run test');
    expect(contributing).toContain('docs/specs/');
    expect(contributing).toContain('docs/decisions/');
  });

  it('SPEC-config-integrity AC-14: RULES.md documents the variables the engine resolves', () => {
    const rules = read('docs/RULES.md');
    // Tokens the engine implements; each was missing from the guide before.
    for (const token of ['{yearMonth}', '{parent}', '{sizeBucket}', '{now:', '{match}']) {
      expect(rules, `RULES.md is missing ${token}`).toContain(token);
    }
    // The default that used to diverge from the loader.
    expect(rules).toMatch(/recursive[\s\S]{0,80}default/i);
  });

  it('SPEC-mcp-surface AC-14: MCP.md documents client config and the tools', () => {
    const mcp = read('docs/MCP.md');
    expect(mcp).toContain('mcpServers');
    expect(mcp).toContain('file-organizer-mcp');
    for (const tool of [
      'organize_files',
      'preview_organization',
      'list_rules',
      'add_rule',
      'undo_last',
    ]) {
      expect(mcp, `MCP.md is missing ${tool}`).toContain(tool);
    }
    // The safety default an agent must know about.
    expect(mcp).toMatch(/dryRun\D{0,40}true/i);
  });
});

/** Recursively list `.md` files under a repo-relative directory. */
function markdownFiles(relativeDir: string): string[] {
  const root = path.join(repoRoot, relativeDir);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(path.relative(repoRoot, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return out;
}

const TEST_PATH = /tests\/[A-Za-z0-9_\-./]*\.test\.ts/g;

describe('governance docs (SPEC-governance)', () => {
  const retroactiveSpecs = [
    'docs/specs/SPEC-organize.md',
    'docs/specs/SPEC-watch.md',
    'docs/specs/SPEC-undo.md',
    'docs/specs/SPEC-dedup.md',
    'docs/specs/SPEC-config.md',
  ];

  it('AC-1: the five retroactive specs exist', () => {
    for (const file of retroactiveSpecs) {
      expect(fs.existsSync(path.join(repoRoot, file)), `missing ${file}`).toBe(true);
    }
  });

  it('AC-2/AC-6: each spec follows the template and cites existing tests', () => {
    for (const file of retroactiveSpecs) {
      const content = read(file);
      expect(content, `${file} has no Objective`).toContain('## 1. Objective');
      expect(content, `${file} has no Non-goals`).toContain('## 2. Non-goals');

      const cited = [...new Set(content.match(TEST_PATH) ?? [])];
      expect(cited.length, `${file} cites no test`).toBeGreaterThan(0);
      for (const testPath of cited) {
        expect(
          fs.existsSync(path.join(repoRoot, 'packages/cli', testPath)),
          `${file} cites a missing test: ${testPath}`
        ).toBe(true);
      }
    }
  });

  it('AC-3: the Constitution no longer names PLUGINS.md as unimplemented', () => {
    const constitution = read('docs/constitution.md');
    expect(constitution).not.toMatch(/Known offender/);
    // The rule itself survives.
    expect(constitution).toContain('*Planned — not implemented*');
  });

  it('AC-4: the orphan tasks are archived, not active', () => {
    for (const orphan of ['tasks/plan.md', 'tasks/todo.md']) {
      expect(fs.existsSync(path.join(repoRoot, orphan)), `${orphan} is still active`).toBe(false);
    }
    for (const archived of [
      'tasks/archive/plan-landing-editorial-revamp.md',
      'tasks/archive/todo-landing-editorial-revamp.md',
    ]) {
      const content = read(archived);
      expect(content, `${archived} lacks a Superseded header`).toContain('Superseded');
    }
  });

  it('AC-5: no active doc references the removed landing spec', () => {
    const active = [
      ...markdownFiles('docs/specs').filter((f) => f !== 'docs/specs/SPEC-governance.md'),
      ...markdownFiles('tasks').filter((f) => !f.startsWith('tasks/archive/')),
    ];
    expect(active.length).toBeGreaterThan(0);

    for (const file of active) {
      expect(
        read(file).includes('SPEC-landing-editorial-revamp'),
        `${file} still references the removed landing spec`
      ).toBe(false);
    }
  });
});
