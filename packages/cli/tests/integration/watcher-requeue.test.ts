import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FolderWatcher } from '../../src/core/watcher.js';
import type { Organizer } from '../../src/core/organizer.js';

/**
 * A pass that is already running must not cause the next event to be dropped:
 * the watcher has to queue exactly one follow-up run and execute it when the
 * current pass settles (`runOrganize` pending branch).
 */
describe('FolderWatcher — re-queue during an in-flight pass', () => {
  let dir: string;
  let watcher: FolderWatcher | undefined;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fo-watch-requeue-'));
  });

  afterEach(async () => {
    await watcher?.stop();
    await fs.remove(dir);
  });

  it('queues a follow-up run instead of dropping the event', async () => {
    let releaseFirst!: () => void;
    const firstPass = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const organize = vi
      .fn()
      .mockImplementationOnce(async () => {
        await firstPass;
        return { moved: [], errors: [] };
      })
      .mockResolvedValue({ moved: [], errors: [] });

    const organizer = {
      getRulesEngine: () => ({ getRules: () => [] }),
      organize,
    } as unknown as Organizer;

    watcher = new FolderWatcher(organizer, dir, {
      debounceMs: 10,
      organizeOnStart: true,
    });

    await watcher.start();

    // The initial pass starts on `ready` and stays in flight until released.
    await vi.waitFor(() => expect(organize).toHaveBeenCalledTimes(1));

    // A file lands while that pass is still running.
    await fs.writeFile(path.join(dir, 'photo.jpg'), 'x');
    // Give chokidar's awaitWriteFinish + debounce window time to fire the event.
    await new Promise((r) => setTimeout(r, 500));

    // The event must NOT have started a second concurrent pass.
    expect(organize).toHaveBeenCalledTimes(1);

    releaseFirst();

    // Once the first pass settles, the queued run executes.
    await vi.waitFor(() => expect(organize.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
