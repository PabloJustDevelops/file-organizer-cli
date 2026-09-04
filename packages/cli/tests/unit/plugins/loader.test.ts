import { describe, it, expect } from 'vitest';
import path from 'path';
import {
  PluginRegistry,
  PluginNotFoundError,
  PluginLoadError,
  PluginExportError,
  DuplicatePluginError,
} from '../../../src/core/plugins/loader.js';
import {
  PluginError,
  PluginFieldError,
  PluginTypeError,
} from '../../../src/core/plugins/contract.js';
import type { OrganizerPlugin } from '../../../src/core/plugins/contract.js';
import { Organizer } from '../../../src/core/organizer.js';

/** In-memory edge fakes: no real fs, no dynamic imports, no module mocking. */
function makeEdges(options: {
  files?: Map<string, unknown>;   // resolved path -> module namespace
  packages?: Map<string, string>; // bare specifier -> resolved path
}) {
  const imports: string[] = [];
  const failImports = new Map<string, Error>();
  return {
    imports,
    failImports,
    edges: {
      fileExists: async (candidatePath: string) => options.files?.has(candidatePath) ?? false,
      resolvePackage: (name: string) => {
        const resolved = options.packages?.get(name);
        if (resolved === undefined) {
          throw new Error(`Cannot find module '${name}'`);
        }
        return resolved;
      },
      importModule: async (modulePath: string) => {
        imports.push(modulePath);
        const failure = failImports.get(modulePath);
        if (failure) throw failure;
        const namespace = options.files?.get(modulePath);
        if (namespace === undefined) {
          throw new Error(`Cannot find module '${modulePath}'`);
        }
        return namespace;
      },
    },
  };
}

function validPlugin(overrides: Partial<OrganizerPlugin> = {}): OrganizerPlugin {
  return { name: 'my-plugin', version: '1.0.0', ...overrides };
}

describe('PluginRegistry', () => {
  describe('register / list (programmatic source)', () => {
    it('AC-1: stores a valid plugin and returns the same reference', () => {
      const registry = new PluginRegistry();
      const plugin = validPlugin();
      const result = registry.register(plugin);
      expect(result).toBe(plugin);
      expect(registry.list()).toEqual([plugin]);
    });

    it('AC-2: rejects invalid candidates with contract errors; list unchanged', () => {
      const registry = new PluginRegistry();
      expect(() => registry.register(42 as unknown as OrganizerPlugin)).toThrow(PluginTypeError);
      expect(() =>
        registry.register({ name: 'Bad Name', version: '1.0.0' } as OrganizerPlugin)
      ).toThrow(PluginFieldError);
      expect(registry.list()).toEqual([]);
    });

    it('AC-3: rejects duplicate names with DuplicatePluginError; list unchanged', () => {
      const registry = new PluginRegistry();
      registry.register(validPlugin());
      expect(() => registry.register(validPlugin({ version: '2.0.0' }))).toThrow(
        DuplicatePluginError
      );
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('load — local files', () => {
    it('AC-4: resolves local spec against baseDir, imports, validates, stores', async () => {
      const baseDir = path.resolve('/project/config-dir');
      // Key the fake fs with the same path the loader computes — platform-neutral.
      const resolved = path.resolve(baseDir, './fixture.js');
      const plugin = validPlugin();
      const { edges, imports } = makeEdges({
        files: new Map([[resolved, { default: plugin }]]),
      });
      const registry = new PluginRegistry(edges);

      const result = await registry.load('./fixture.js', { baseDir });

      expect(result).toBe(plugin);
      expect(imports).toEqual([resolved]);
      expect(registry.list()).toEqual([plugin]);
    });

    it('AC-5: missing local file throws PluginNotFoundError without importing', async () => {
      const { edges, imports } = makeEdges({ files: new Map() });
      const registry = new PluginRegistry(edges);

      await expect(
        registry.load('./missing.js', { baseDir: '/project' })
      ).rejects.toThrow(PluginNotFoundError);
      expect(imports).toEqual([]);
    });

    it('AC-4: accepts absolute local specs unchanged', async () => {
      // path.resolve makes the key platform-appropriate; the loader's own
      // resolve is idempotent on absolute paths on every OS.
      const absolute = path.resolve('/abs/path/plugin.js');
      const { edges, imports } = makeEdges({
        files: new Map([[absolute, { default: validPlugin() }]]),
      });
      const registry = new PluginRegistry(edges);

      await registry.load(absolute, { baseDir: path.resolve('/elsewhere') });
      expect(imports).toEqual([absolute]);
    });
  });

  describe('load — npm packages', () => {
    it('AC-6: resolves bare specifier via resolvePackage and stores the plugin', async () => {
      const resolved = '/project/node_modules/pkg/index.js';
      const plugin = validPlugin({ name: 'npm-plugin' });
      const { edges, imports } = makeEdges({
        packages: new Map([['file-organizer-npm', resolved]]),
        files: new Map([[resolved, { default: plugin }]]),
      });
      const registry = new PluginRegistry(edges);

      const result = await registry.load('file-organizer-npm', { baseDir: '/project' });

      expect(result).toBe(plugin);
      expect(imports).toEqual([resolved]);
    });

    it('non-Error rejection from resolvePackage is stringified into the error message', async () => {
      const { edges } = makeEdges({ packages: new Map() });
      edges.resolvePackage = () => {
        throw 'plain string failure'; // non-Error throw exercises String(err) branch
      };
      const registry = new PluginRegistry(edges);

      await expect(
        registry.load('any-package', { baseDir: '/project' })
      ).rejects.toThrow(/plain string failure/);
    });

    it('AC-7: unresolvable package throws PluginNotFoundError naming the package', async () => {
      const { edges } = makeEdges({ packages: new Map() });
      const registry = new PluginRegistry(edges);

      await expect(
        registry.load('not-installed-pkg', { baseDir: '/project' })
      ).rejects.toThrow(/not-installed-pkg/);
      await expect(
        registry.load('not-installed-pkg', { baseDir: '/project' })
      ).rejects.toThrow(PluginNotFoundError);
    });
  });

  describe('load — module extraction and failure mapping', () => {
    const moduleAt = path.resolve('/somewhere', './plugin.js');

    function registryFor(namespace: unknown): PluginRegistry {
      const { edges } = makeEdges({
        files: new Map([[moduleAt, namespace]]),
      });
      return new PluginRegistry(edges);
    }

    it('AC-8: import failure maps to PluginLoadError carrying the original cause', async () => {
      const original = new Error('syntax error in plugin build');
      const { edges } = makeEdges({ files: new Map() });
      edges.fileExists = async () => true;
      edges.importModule = async () => {
        throw original;
      };
      const registry = new PluginRegistry(edges);

      const err = await registry
        .load('./plugin.js', { baseDir: '/somewhere' })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(PluginLoadError);
      expect((err as PluginLoadError).cause).toBe(original);
    });

    it('AC-9: namespace without default export throws PluginExportError', async () => {
      const registry = registryFor({ named: 'only' });
      await expect(
        registry.load('./plugin.js', { baseDir: '/somewhere' })
      ).rejects.toThrow(PluginExportError);
    });

    it('AC-9: non-object module namespace (null) throws PluginExportError', async () => {
      const registry = registryFor(null);
      await expect(
        registry.load('./plugin.js', { baseDir: '/somewhere' })
      ).rejects.toThrow(PluginExportError);
    });

    it('AC-9: non-object module namespace (string) throws PluginExportError', async () => {
      const registry = registryFor('just a string module');
      await expect(
        registry.load('./plugin.js', { baseDir: '/somewhere' })
      ).rejects.toThrow(PluginExportError);
    });

    it('AC-10: default export failing contract validation propagates the field error', async () => {
      const registry = registryFor({ default: { name: 'Bad Name', version: '1.0.0' } });
      const err = await registry
        .load('./plugin.js', { baseDir: '/somewhere' })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PluginFieldError);
      expect((err as PluginFieldError).field).toBe('name');
    });

    it('AC-11: loading a plugin whose name is already registered throws DuplicatePluginError', async () => {
      const { edges } = makeEdges({
        files: new Map([[moduleAt, { default: validPlugin({ name: 'dup' }) }]]),
      });
      const loading = new PluginRegistry(edges);
      loading.register(validPlugin({ name: 'dup' })); // same registry as the load below
      await expect(
        loading.load('./plugin.js', { baseDir: '/somewhere' })
      ).rejects.toThrow(DuplicatePluginError);
    });

    it('load errors are PluginError subclasses', async () => {
      const registry = registryFor({ noDefault: true });
      const err = await registry
        .load('./plugin.js', { baseDir: '/somewhere' })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PluginError);
    });
  });

  describe('Organizer integration (AC-12)', () => {
    it('AC-12: organizer.loadPlugin registers on the organizer registry', () => {
      const organizer = new Organizer();
      const plugin = validPlugin({ name: 'via-organizer' });
      const result = organizer.loadPlugin(plugin);
      expect(result).toBe(plugin);
      expect(organizer.listPlugins()).toEqual([plugin]);
    });

    it('AC-12: organizer.loadPlugin still validates and rejects invalid plugins', () => {
      const organizer = new Organizer();
      expect(() =>
        organizer.loadPlugin({ name: 'X', version: 'nope' } as OrganizerPlugin)
      ).toThrow(PluginFieldError);
    });
  });
});
