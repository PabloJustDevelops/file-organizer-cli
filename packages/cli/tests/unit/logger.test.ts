import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

import type { LogLevel } from '../../src/utils/logger.js';

/**
 * The logger keeps module-level state (level, file path). Each test gets a
 * fresh module instance so state never leaks between tests — no mocking of
 * the module itself, only of the console sinks.
 */
async function freshLogger() {
  vi.resetModules();
  return import('../../src/utils/logger.js');
}

describe('logger', () => {
  let tempDir: string;
  let logFile: string;
  let spies: Record<'log' | 'warn' | 'error', ReturnType<typeof vi.spyOn>>;

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fo-logger-')));
    logFile = path.join(tempDir, 'fo.log');
    spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    for (const spy of Object.values(spies)) spy.mockRestore();
    fs.removeSync(tempDir);
  });

  const callsOn = (key: 'log' | 'warn' | 'error'): number => spies[key].mock.calls.length;

  const firstArgOf = (key: 'log' | 'warn' | 'error'): string | undefined => {
    const first = spies[key].mock.calls[0]?.[0];
    return typeof first === 'string' ? first : undefined;
  };

  describe('level filtering', () => {
    it('suppresses debug/gray at the default info level', async () => {
      const logger = await freshLogger();
      expect(logger.getLogLevel()).toBe('info');

      logger.debug('hidden debug');
      logger.gray('hidden gray');

      expect(callsOn('log')).toBe(0);
    });

    it('emits debug/gray once the level drops to debug', async () => {
      const logger = await freshLogger();
      logger.setLogLevel('debug');

      logger.gray('visible gray');
      logger.debug('visible debug');

      expect(callsOn('log')).toBe(2);
      // First call is gray (plain message); the debug call carries the tag.
      expect(firstArgOf('log')).toContain('visible gray');
      const debugLine = spies.log.mock.calls.map((c) => c[0]).find(
        (a): a is string => typeof a === 'string' && a.includes('[DEBUG]')
      );
      expect(debugLine).toContain('[DEBUG] visible debug');
    });

    it('routes severity to the right console sink (info/success→log, warn→warn, error→error)', async () => {
      const logger = await freshLogger();

      logger.info('an info');
      logger.success('a success');
      logger.warn('a warning');
      logger.error('an error');

      expect(callsOn('log')).toBe(2);
      expect(firstArgOf('log')).toContain('[INFO] an info');
      expect(callsOn('warn')).toBe(1);
      expect(firstArgOf('warn')).toContain('[WARN] a warning');
      expect(callsOn('error')).toBe(1);
      expect(firstArgOf('error')).toContain('[ERROR] an error');
    });

    it.each([
      ['error', ['debug', 'info', 'warn'] as LogLevel[], ['error'] as LogLevel[]],
      ['warn', ['debug', 'info'] as LogLevel[], ['warn', 'error'] as LogLevel[]],
    ])(
      'at level %s, suppressed: %j, emitted: %j',
      async (level, suppressed, emitted) => {
        const logger = await freshLogger();
        logger.setLogLevel(level);

        const emit = {
          debug: () => logger.debug('m'),
          info: () => logger.info('m'),
          warn: () => logger.warn('m'),
          error: () => logger.error('m'),
        } as const;

        for (const fn of suppressed) emit[fn]();
        const before = callsOn('error') + callsOn('warn') + callsOn('log');
        for (const fn of emitted) emit[fn]();
        const after = callsOn('error') + callsOn('warn') + callsOn('log');

        expect(after - before).toBe(emitted.length);
      }
    );
  });

  describe('console formatting', () => {
    it('forwards extra arguments to the console', async () => {
      const logger = await freshLogger();
      const extra = { code: 42 };
      logger.info('with extras', extra);

      expect(spies.log.mock.calls[0]?.[1]).toBe(extra);
    });

    it('writes the file line without the console color codes (plain message)', async () => {
      const logger = await freshLogger();
      logger.setLogFilePath(logFile);
      logger.info('plain payload');

      const content = await fs.readFile(logFile, 'utf-8');
      // Exact whole-file match: chalk-colored console output would inject ANSI
      // escape codes and break this match — the file gets the plain message.
      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] \[INFO\] plain payload\n$/);
    });
  });

  describe('file output', () => {
    it('appends timestamped, level-tagged lines to the configured file', async () => {
      const logger = await freshLogger();
      logger.setLogFilePath(logFile);

      logger.info('file line one');
      logger.error('file line two');

      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] \[INFO\] file line one$/);
      expect(lines[1]).toMatch(/^\[.+\] \[ERROR\] file line two$/);
    });

    it('writes suppressed levels nowhere but still respects the level filter', async () => {
      const logger = await freshLogger();
      logger.setLogFilePath(logFile);
      logger.setLogLevel('error');

      logger.info('not logged');
      logger.error('logged');

      const content = await fs.readFile(logFile, 'utf-8');
      expect(content).not.toContain('not logged');
      expect(content).toContain('logged');
    });

    it('does not write to the file when no path is configured', async () => {
      const logger = await freshLogger();

      expect(() => logger.info('console only')).not.toThrow();
      expect(callsOn('log')).toBe(1);
      expect(fs.existsSync(logFile)).toBe(false);
    });

    it('swallows write errors instead of crashing the run', async () => {
      const logger = await freshLogger();
      // A directory path makes fs.appendFileSync throw (EISDIR) — the logger
      // must absorb it: file logging must never take down an organize run.
      logger.setLogFilePath(tempDir);

      expect(() => logger.info('crash?')).not.toThrow();
      expect(callsOn('log')).toBe(1); // console still emitted
    });
  });
});
