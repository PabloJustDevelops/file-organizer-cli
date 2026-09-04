import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { RulesEngine } from '../../src/core/rules-engine.js';
import { FileScanner } from '../../src/core/file-scanner.js';
import type { FileInfo, Rule } from '../../src/types/index.js';

describe('Custom sizeBuckets', () => {
  const makeFile = (size: number): FileInfo => ({
    path: '/test/f.bin',
    name: 'f',
    extension: 'bin',
    size,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isDirectory: false,
  });

  const rule: Rule[] = [
    { name: 'X', patterns: ['*'], destination: './{sizeBucket}' },
  ];

  it('uses default thresholds when none given', () => {
    const engine = new RulesEngine(rule);
    expect(engine.matchFile(makeFile(500 * 1024))?.destination).toBe('./medium');
  });

  it('honors custom thresholds (KB instead of 100KB for small)', () => {
    const engine = new RulesEngine(rule);
    engine.setSizeBuckets({ small: 2 * 1024, medium: 10 * 1024, large: 50 * 1024 });

    expect(engine.matchFile(makeFile(1500))?.destination).toBe('./small'); // < 2KB
    expect(engine.matchFile(makeFile(5000))?.destination).toBe('./medium'); // < 10KB
    expect(engine.matchFile(makeFile(20 * 1024))?.destination).toBe('./large'); // < 50KB
    expect(engine.matchFile(makeFile(60 * 1024))?.destination).toBe('./huge');
  });
});

describe('scanWithPatterns (DRY delegation)', () => {
  let testDir: string;
  const scanner = new FileScanner();

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-swp-'));
    await fs.writeFile(path.join(testDir, 'report.pdf'), 'a');
    await fs.writeFile(path.join(testDir, 'photo.jpg'), 'b');
    await fs.writeFile(path.join(testDir, 'archive.tar.gz'), 'c');
    await fs.ensureDir(path.join(testDir, 'sub'));
    await fs.writeFile(path.join(testDir, 'sub', 'deep.pdf'), 'd');
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it('matches extension globs', async () => {
    const files = await scanner.scanWithPatterns(testDir, ['*.pdf']);
    const names = files.map((f) => path.basename(f.path)).sort();
    expect(names).toEqual(['deep.pdf', 'report.pdf']);
  });

  it('matches composite globs via the engine (same semantics as rules)', async () => {
    const files = await scanner.scanWithPatterns(testDir, ['*.tar.gz']);
    expect(files).toHaveLength(1);
    expect(path.basename(files[0].path)).toBe('archive.tar.gz');
  });

  it('scans recursively', async () => {
    const files = await scanner.scanWithPatterns(testDir, ['*.pdf']);
    expect(files.some((f) => f.path.includes('sub'))).toBe(true);
  });
});
