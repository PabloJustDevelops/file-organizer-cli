import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { FolderWatcher, buildDestinationIgnores } from '../../src/core/watcher.js';
import type { Organizer } from '../../src/core/organizer.js';
import type { Rule } from '../../src/types/index.js';

/**
 * A fake chokidar gives deterministic control over the events `FolderWatcher`
 * reacts to, covering the branches a real watcher can only hit by luck:
 * coalescing rapid events into one run, and `stop()` clearing a debounce timer
 * that has not fired yet.
 */
const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const close = vi.fn(async () => undefined);
  const organize = vi.fn(async () => ({ moved: [], skipped: [], errors: [] }));
  const state: { ignorePredicate?: (targetPath: string) => boolean } = {};
  const watcher = {
    on(event: string, cb: (...args: unknown[]) => void) {
      handlers.set(event, cb);
      return watcher;
    },
    close,
  };
  return { handlers, watcher, organize, close, state };
});

vi.mock('chokidar', () => ({
  default: {
    watch: (_path: string, options: { ignored?: unknown[] }) => {
      mocks.state.ignorePredicate = options?.ignored?.find(
        (entry) => typeof entry === 'function'
      ) as ((targetPath: string) => boolean) | undefined;
      return mocks.watcher;
    },
  },
}));

const emit = (event: string) => {
  const handler = mocks.handlers.get(event);
  if (!handler) throw new Error(`no handler registered for "${event}"`);
  handler();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('buildDestinationIgnores', () => {
  const rule = (destination: string): Rule => ({
    name: destination,
    patterns: ['*'],
    destination,
  });

  it('derives one glob per static destination root and skips the unusable ones', () => {
    expect(
      buildDestinationIgnores([
        rule(path.resolve('outside-the-tree')), // absolute → outside the watch
        rule('./'), // no usable segment
        rule('././x'), // resolves to "." before any name
        rule('./images/{year}'), // static root is "images"
      ])
    ).toEqual(['**/images/**']);
  });
});

describe('FolderWatcher lifecycle (mocked chokidar)', () => {
  const organizer = {
    getRulesEngine: () => ({ getRules: () => [] }),
    organize: mocks.organize,
  } as unknown as Organizer;

  beforeEach(() => {
    mocks.handlers.clear();
    mocks.organize.mockClear();
    mocks.close.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('coalesces rapid events into a single run and stop() clears a pending timer', async () => {
    const watcher = new FolderWatcher(organizer, '/source', {
      debounceMs: 50,
      organizeOnStart: false,
    });

    const started = watcher.start();
    emit('ready');
    await started;

    // Three events inside one debounce window → one coalesced run.
    emit('add');
    emit('change');
    emit('change');
    expect(mocks.organize).not.toHaveBeenCalled();

    await sleep(120);
    expect(mocks.organize).toHaveBeenCalledTimes(1);

    // A pending timer must be discarded by stop(), not fire afterwards.
    emit('change');
    await watcher.stop();
    await sleep(120);
    expect(mocks.organize).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalled();
  });

  it('runs the initial pass on ready when organizeOnStart is set', async () => {
    const watcher = new FolderWatcher(organizer, '/source', { organizeOnStart: true });

    const started = watcher.start();
    emit('ready');
    await started;
    await sleep(20);

    expect(mocks.organize).toHaveBeenCalledTimes(1);
    await watcher.stop();
  });

  it('ignores events under destination dirs learned from a pass', async () => {
    mocks.organize.mockResolvedValueOnce({
      moved: [
        { from: '/source/a.jpg', to: '/source/images/2024/a.jpg', rule: 'Images' },
      ],
      skipped: [],
      errors: [],
    });

    const watcher = new FolderWatcher(organizer, '/source', { organizeOnStart: true });
    const started = watcher.start();
    emit('ready');
    await started;
    await sleep(20);

    const isIgnored = mocks.state.ignorePredicate;
    expect(isIgnored, 'chokidar was not given an ignore predicate').toBeDefined();

    // Learned destinations (and their ancestors) are excluded…
    expect(isIgnored!('/source/images/2024/a.jpg')).toBe(true);
    // …but everything else in the watched tree is not.
    expect(isIgnored!('/source/other.txt')).toBe(false);

    await watcher.stop();
  });
});
