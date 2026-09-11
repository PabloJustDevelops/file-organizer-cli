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
    expect(readme).toContain('Node.js >= 18');
    expect(readme).toContain('### Machine-readable output');
    expect(readme).toContain('## Troubleshooting');
  });

  it('AC-9: CONTRIBUTING covers the spec-first workflow and the commands', () => {
    const contributing = read('CONTRIBUTING.md');
    expect(contributing).toContain('bun run test');
    expect(contributing).toContain('docs/specs/');
    expect(contributing).toContain('docs/decisions/');
  });
});
