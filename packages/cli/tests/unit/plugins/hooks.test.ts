import { describe, it, expect, vi } from 'vitest';
import {
  runBeforeOrganize,
  runAfterOrganize,
} from '../../../src/core/plugins/hooks.js';
import type { OrganizerPlugin, OrganizeContext } from '../../../src/core/plugins/contract.js';

function makeContext(overrides: Partial<OrganizeContext> = {}): OrganizeContext {
  return {
    source: '/source',
    config: { rules: [] },
    files: [
      {
        path: '/source/photo.jpg',
        name: 'photo',
        extension: 'jpg',
        size: 10,
        createdAt: new Date(),
        modifiedAt: new Date(),
        isDirectory: false,
      },
    ],
    results: { moved: [], skipped: [], errors: [] },
    ...overrides,
  };
}

describe('plugin hook runners', () => {
  it('AC-1: runs beforeOrganize on every plugin, in registration order, with populated context', async () => {
    const calls: string[] = [];
    const seenFiles: number[] = [];
    const plugins: OrganizerPlugin[] = [
      {
        name: 'first',
        version: '1.0.0',
        async beforeOrganize(ctx) {
          calls.push('first');
          seenFiles.push(ctx.files.length);
        },
      },
      {
        name: 'second',
        version: '1.0.0',
        async beforeOrganize(ctx) {
          calls.push('second');
          seenFiles.push(ctx.files.length);
        },
      },
    ];

    const failures = await runBeforeOrganize(plugins, makeContext());

    expect(failures).toEqual([]);
    expect(calls).toEqual(['first', 'second']);
    expect(seenFiles).toEqual([1, 1]);
  });

  it('AC-2: afterOrganize receives the filled results', async () => {
    const context = makeContext();
    context.results.moved.push({ from: '/a.jpg', to: '/dest/a.jpg', rule: 'Images' });

    let seenMoved = -1;
    const plugins: OrganizerPlugin[] = [
      {
        name: 'reporter',
        version: '1.0.0',
        async afterOrganize(ctx) {
          seenMoved = ctx.results.moved.length;
        },
      },
    ];

    await runAfterOrganize(plugins, context);
    expect(seenMoved).toBe(1);
  });

  it('AC-6: context carries dryRun flag from config', async () => {
    const contexts: boolean[] = [];
    const plugins: OrganizerPlugin[] = [
      {
        name: 'dry-aware',
        version: '1.0.0',
        async beforeOrganize(ctx) {
          contexts.push(Boolean(ctx.config.dryRun));
        },
        async afterOrganize(ctx) {
          contexts.push(Boolean(ctx.config.dryRun));
        },
      },
    ];

    await runBeforeOrganize(plugins, makeContext({ config: { rules: [], dryRun: true } }));
    await runAfterOrganize(plugins, makeContext({ config: { rules: [], dryRun: true } }));
    expect(contexts).toEqual([true, true]);
  });

  it('AC-7: sequential execution proven by shared log order', async () => {
    const log: string[] = [];
    const plugins: OrganizerPlugin[] = [
      {
        name: 'a',
        version: '1.0.0',
        async beforeOrganize() {
          await new Promise((r) => setTimeout(r, 5));
          log.push('a-before');
        },
        async afterOrganize() {
          log.push('a-after');
        },
      },
      {
        name: 'b',
        version: '1.0.0',
        async beforeOrganize() {
          log.push('b-before');
        },
        async afterOrganize() {
          log.push('b-after');
        },
      },
    ];

    await runBeforeOrganize(plugins, makeContext());
    await runAfterOrganize(plugins, makeContext());
    expect(log).toEqual(['a-before', 'b-before', 'a-after', 'b-after']);
  });

  it('AC-9: all failing hooks are captured; other plugins continue', async () => {
    const boom = async (): Promise<void> => {
      throw new Error('hook exploded');
    };
    const healthy = vi.fn(async (): Promise<void> => undefined);
    const plugins: OrganizerPlugin[] = [
      { name: 'broken-1', version: '1.0.0', beforeOrganize: boom, afterOrganize: boom },
      { name: 'healthy', version: '1.0.0', beforeOrganize: healthy, afterOrganize: healthy },
      { name: 'broken-2', version: '1.0.0', beforeOrganize: boom, afterOrganize: boom },
    ];
    const context = makeContext();

    const before = await runBeforeOrganize(plugins, context);
    const after = await runAfterOrganize(plugins, context);

    expect(before).toHaveLength(2);
    expect(after).toHaveLength(2);
    expect(before[0]).toEqual({ plugin: 'broken-1', hook: 'beforeOrganize', error: 'hook exploded' });
    expect(before[1]).toEqual({ plugin: 'broken-2', hook: 'beforeOrganize', error: 'hook exploded' });
    expect(after.map((e) => e.plugin)).toEqual(['broken-1', 'broken-2']);
    expect(healthy).toHaveBeenCalledTimes(2);
  });

  it('AC-10: plugins without hooks are skipped silently', async () => {
    const plugins: OrganizerPlugin[] = [
      { name: 'no-hooks', version: '1.0.0' },
      { name: 'with-hooks', version: '1.0.0', async beforeOrganize() {} },
    ];

    const failures = await runBeforeOrganize(plugins, makeContext());
    expect(failures).toEqual([]);
  });

  it('AC-3: non-Error rejections are stringified into the failure entry', async () => {
    const plugins: OrganizerPlugin[] = [
      {
        name: 'string-thrower',
        version: '1.0.0',
        async beforeOrganize() {
          throw 'plain string failure'; // eslint-disable-line no-throw-literal
        },
      },
    ];

    const failures = await runBeforeOrganize(plugins, makeContext());
    expect(failures).toEqual([
      { plugin: 'string-thrower', hook: 'beforeOrganize', error: 'plain string failure' },
    ]);
  });
});
