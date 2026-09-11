import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTempDir, removeDir, runCli, writeFileAt } from './helpers.js';

/**
 * Config content is validated before anything runs (SPEC-config-integrity
 * AC-12/AC-13): a bad regex must fail `fo config validate` — naming the rule —
 * instead of surfacing mid-organize.
 */
const BAD_REGEX = `rules:
  - name: Broken
    patterns: ["*.jpg"]
    destination: ./images
    condition:
      type: regex
      pattern: "(["
`;

const GOOD = `rules:
  - name: Images
    patterns: ["*.jpg"]
    destination: ./images
`;

describe('config integrity (e2e)', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir('config-integrity');
  });

  afterEach(() => {
    removeDir(dir);
  });

  it('AC-12: an invalid regex fails validate and names the rule', () => {
    writeFileAt(dir, '.file-organizer.yaml', BAD_REGEX);

    const result = runCli(['config', 'validate'], dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Broken');
    expect(result.stderr).toContain('not a valid regex');
  });

  it('AC-13: a valid config validates with exit 0', () => {
    writeFileAt(dir, '.file-organizer.yaml', GOOD);

    expect(runCli(['config', 'validate'], dir).status).toBe(0);
  });

  it('AC-16: the shipped advanced example validates as-is', () => {
    const advanced = fs.readFileSync(
      new URL('../../../../config-examples/advanced.yaml', import.meta.url),
      'utf-8'
    );
    writeFileAt(dir, '.file-organizer.yaml', advanced);

    expect(runCli(['config', 'validate'], dir).status).toBe(0);
  });
});
