import { describe, it, expect } from 'vitest';
import type { FileInfo } from '../../../src/types/index.js';
import type { OrganizerPlugin } from '../../../src/core/plugins/contract.js';
import { applyTransforms } from '../../../src/core/plugins/transform.js';

function fileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/dir/a.jpg',
    name: 'a',
    extension: 'jpg',
    size: 100,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-02'),
    isDirectory: false,
    ...overrides,
  };
}

function pluginWithTransform(
  fn: (file: FileInfo) => Promise<FileInfo>
): OrganizerPlugin {
  return { name: 'tx', version: '1.0.0', transform: fn };
}

describe('applyTransforms', () => {
  it('AC-1: no plugins → files pass through unchanged', async () => {
    const files = [fileInfo(), fileInfo({ name: 'b', path: '/dir/b.jpg' })];
    const { files: out, failures } = await applyTransforms([], files);

    expect(out).toEqual(files);
    expect(failures).toEqual([]);
  });

  it('AC-2: plugin without transform → passthrough', async () => {
    const files = [fileInfo()];
    const plugin: OrganizerPlugin = { name: 'no-tx', version: '1.0.0' };
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out).toEqual(files);
    expect(failures).toEqual([]);
  });

  it('AC-3: plugin with transform → every file mapped, order preserved', async () => {
    const files = [
      fileInfo({ name: 'A', path: '/dir/A.JPG', extension: 'JPG' }),
      fileInfo({ name: 'B', path: '/dir/B.JPG', extension: 'JPG' }),
    ];
    const plugin = pluginWithTransform(async (f) => ({
      ...f,
      extension: f.extension.toLowerCase(),
    }));
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out.map((f) => f.extension)).toEqual(['jpg', 'jpg']);
    expect(out.map((f) => f.name)).toEqual(['A', 'B']);
    expect(failures).toEqual([]);
  });

  it('AC-4: throw on file A → failure recorded, A kept, B transformed, later plugins unaffected', async () => {
    const fileA = fileInfo({ name: 'A', path: '/dir/A.JPG', extension: 'JPG' });
    const fileB = fileInfo({ name: 'B', path: '/dir/B.JPG', extension: 'JPG' });
    const flaky = pluginWithTransform(async (f) => {
      if (f.name === 'A') throw new Error('boom');
      return { ...f, extension: 'ok' };
    });
    const later = pluginWithTransform(async (f) => ({ ...f, size: 42 }));
    const { files: out, failures } = await applyTransforms([flaky, later], [
      fileA,
      fileB,
    ]);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({
      plugin: 'tx',
      hook: 'transform',
      error: 'transform(file[0]) threw: boom',
    });
    // A missed only the failing plugin's transform…
    expect(out[0].extension).toBe('JPG');
    // …but still got the later plugin's transform (isolation is per plugin).
    expect(out[0].size).toBe(42);
    // B transformed by the flaky plugin…
    expect(out[1].extension).toBe('ok');
    // …and by the later plugin too.
    expect(out[1].size).toBe(42);
  });

  it('AC-5: transform returning null → failure recorded, original kept', async () => {
    const files = [fileInfo()];
    const plugin = pluginWithTransform(
      async () => null as unknown as FileInfo
    );
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out).toEqual(files);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toContain('must return a FileInfo, received null');
  });

  it('AC-5b: transform returning a shape with non-string name → failure, original kept', async () => {
    const files = [fileInfo()];
    const plugin = pluginWithTransform(
      async () => ({ path: '/dir/a.jpg', name: 42 }) as unknown as FileInfo
    );
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out).toEqual(files);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toContain('received an object without a string path/name');
  });

  it('AC-5c: transform returning a primitive → failure, original kept', async () => {
    const files = [fileInfo()];
    const plugin = pluginWithTransform(
      async () => 'not-a-file' as unknown as FileInfo
    );
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out).toEqual(files);
    expect(failures).toHaveLength(1);
    expect(failures[0].error).toContain('received a value of type string');
  });

  it('AC-6: two transforming plugins compose (second sees first output)', async () => {
    const files = [fileInfo({ extension: 'JPG' })];
    const lower = pluginWithTransform(async (f) => ({
      ...f,
      extension: f.extension.toLowerCase(),
    }));
    const prefix = pluginWithTransform(async (f) => ({
      ...f,
      name: `tx-${f.name}`,
    }));
    const { files: out, failures } = await applyTransforms([lower, prefix], files);

    expect(out[0].extension).toBe('jpg');
    expect(out[0].name).toBe('tx-a');
    expect(failures).toEqual([]);
  });

  it('AC-7: non-Error throw (string) captured via String(err)', async () => {
    const files = [fileInfo()];
    const plugin = pluginWithTransform(async () => {
      throw 'plain string failure';
    });
    const { files: out, failures } = await applyTransforms([plugin], files);

    expect(out).toEqual(files);
    expect(failures[0].error).toBe('transform(file[0]) threw: plain string failure');
  });
});
