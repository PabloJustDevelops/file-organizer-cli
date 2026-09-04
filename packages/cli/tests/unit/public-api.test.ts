import { describe, it, expect } from 'vitest';

/**
 * Guards the public library surface (package.json exports['.'] → src/index.ts):
 * every documented API name must be importable and side-effect free. The
 * dynamic import asserts the entry never starts a process (the old failure
 * mode where the package main was the CLI binary calling program.parse()).
 */
describe('public library surface (src/index.ts)', () => {
  it('exposes the documented API with no import-time side effects', async () => {
    const api = await import('../../src/index.js');

    // Core classes
    expect(api.Organizer).toBeTypeOf('function');
    expect(api.FileScanner).toBeTypeOf('function');
    expect(api.RulesEngine).toBeTypeOf('function');
    expect(api.HistoryStore).toBeTypeOf('function');

    // Plugin system
    expect(api.PluginRegistry).toBeTypeOf('function');
    expect(api.validatePlugin).toBeTypeOf('function');
    expect(api.runBeforeOrganize).toBeTypeOf('function');
    expect(api.runAfterOrganize).toBeTypeOf('function');
    expect(api.collectPluginRules).toBeTypeOf('function');
    expect(api.applyTransforms).toBeTypeOf('function');

    // Error hierarchy
    expect(api.PluginError).toBeTypeOf('function');
    expect(api.PluginTypeError).toBeTypeOf('function');
    expect(api.PluginFieldError).toBeTypeOf('function');
    expect(api.PluginNotFoundError).toBeTypeOf('function');
    expect(api.PluginLoadError).toBeTypeOf('function');
    expect(api.PluginExportError).toBeTypeOf('function');
    expect(api.DuplicatePluginError).toBeTypeOf('function');

    // Config + logger
    expect(api.loadConfig).toBeTypeOf('function');
    expect(api.saveConfig).toBeTypeOf('function');
    expect(api.findConfigPath).toBeTypeOf('function');
    expect(api.logger).toBeTypeOf('object');
    expect(api.setLogLevel).toBeTypeOf('function');
    expect(api.setLogFilePath).toBeTypeOf('function');
  });

  it('types resolve via `import type` without runtime cost', async () => {
    // Compile-time only: if this file typechecks, the type surface exists.
    const typeProbe: import('../../src/index.js').OrganizerPlugin = {
      name: 'type-probe',
      version: '0.0.1',
    };
    expect(typeProbe.name).toBe('type-probe');
  });
});
