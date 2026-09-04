# Plugins Guide

> Re-validated against the implemented plugin system (2026-09-04).
> Specs: [SPEC-plugin-contract](specs/SPEC-plugin-contract.md) ·
> [SPEC-plugin-loader](specs/SPEC-plugin-loader.md) ·
> [SPEC-config-plugins](specs/SPEC-config-plugins.md) ·
> [SPEC-plugin-hooks](specs/SPEC-plugin-hooks.md) ·
> [SPEC-plugin-rules](specs/SPEC-plugin-rules.md) ·
> [SPEC-plugin-transform](specs/SPEC-plugin-transform.md)

## Overview

File Organizer CLI supports plugins to extend functionality. Plugins can:
- Add custom rules to the rules engine
- Transform file metadata before organizing decisions
- Hook into the organization lifecycle

**A plugin is a plain object with a default export — no imports required.**
Previous versions of this guide showed `import type { OrganizerPlugin } from
'file-organizer-cli'`; that import never worked (the package entry point is
the CLI binary) and has been removed. TypeScript users get full typing
without any runtime import by declaring the shape inline (see below).

## Plugin Interface

The contract (validated at load time by `validatePlugin`):

```typescript
interface OrganizerPlugin {
  // Required: kebab-case, unique among loaded plugins
  name: string;         // e.g. "my-plugin"
  // Required: valid semver
  version: string;      // e.g. "1.0.0"

  // Lifecycle hooks (all optional)
  beforeOrganize?(context: OrganizeContext): Promise<void>;
  afterOrganize?(context: OrganizeContext): Promise<void>;

  // Custom rules (optional)
  customRules?(): Rule[];

  // File transformation (optional)
  transform?(file: FileInfo): Promise<FileInfo>;
}
```

Validation rules: `name` must be kebab-case, `version` must be semver, and
any optional member that is present must be a function. Invalid plugins are
rejected at load time with a specific error — before any file is touched.

## Creating a Plugin

```javascript
// my-plugin.js — plain ESM, zero imports
export default {
  name: 'my-plugin',
  version: '1.0.0',

  // Runs after the scan (context.files is populated) and after transforms
  async beforeOrganize(context) {
    console.log(`Organizing ${context.files.length} files...`);
  },

  // Runs after all moves; context.results is the same object being returned
  async afterOrganize(context) {
    console.log(`Moved ${context.results.moved.length} files!`);
  },

  // Rules validated exactly like YAML rules; names must not clash with config
  customRules() {
    return [
      {
        name: 'My Custom Rule',
        patterns: ['*.special'],
        destination: './special-files',
      },
    ];
  },

  // Decision-layer transform: remap extensions so rules route them
  async transform(file) {
    return {
      ...file,
      extension: file.extension === 'log' ? 'txt' : file.extension,
    };
  },
};
```

TypeScript users can type the plugin without importing anything:

```typescript
// my-plugin.ts
interface MyPlugin {
  name: string;
  version: string;
  beforeOrganize?(context: { files: unknown[] }): Promise<void>;
  // ...narrow further as needed
}

export default {
  name: 'my-plugin',
  version: '1.0.0',
} satisfies MyPlugin;
```

## Registering a Plugin

### Via config (recommended)

Add to your `.file-organizer.yaml`:

```yaml
plugins:
  - ./my-plugin.js                    # local path, relative to this config file
  - file-organizer-compress-plugin    # npm package
```

- Local paths (`./`, `../`, or absolute) resolve against the **config file's
  directory**.
- Bare specifiers resolve as npm packages from the config directory (your
  project's `node_modules`), not from the CLI installation.
- `fo config validate` checks the field's shape but **never imports or
  executes** plugin files; loading happens at organize time.

### Programmatically

`Organizer` exposes `loadPlugin(plugin)` and `loadSpec('./my-plugin.js')`.
Note: the published package currently ships only the CLI binary entry —
programmatic loading works when importing from the source/monorepo, and a
dedicated library export is a planned follow-up.

## Execution semantics

Ordering inside one `organize()` call:

```
load plugins (aborts run on broken spec, before touching files)
  → scan
  → transform            (per plugin, per file)
  → inject customRules   (config rule names win conflicts)
  → beforeOrganize       (sees the transformed files)
  → match + move
  → afterOrganize        (sees filled results)
```

**Error isolation — a failing plugin never aborts a run:**
- A throwing hook or transform is captured, logged, and reported in
  `result.pluginErrors` (`{ plugin, hook, error }`).
- Transform isolation is **per file**: one bad file keeps its original
  metadata; the plugin's other files still transform.
- Custom-rules isolation is **per rule**: one invalid rule is skipped; the
  plugin's other rules are injected.

**Transform semantics (decision layer only):** transforms change the
in-memory `FileInfo` that drives rule matching and destination paths —
they never touch the disk themselves. A remapped extension moves the file
under a matching name (`notes.log` + a `*.txt` rule lands as
`text/notes.txt`). The scanner lowercases extensions at scan time, so
lowercasing in a transform is a no-op — use transforms for *remapping*,
prefixing, or deriving metadata instead.

**Dry runs:** hooks and transforms also run in dry-run mode;
`context.config.dryRun` tells them which mode they're in.

## Example Plugins

### Compress Old Files

```javascript
import { stat } from 'node:fs/promises';

export default {
  name: 'compress-old-files',
  version: '1.0.0',

  async afterOrganize(context) {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    for (const moved of context.results.moved) {
      const stats = await stat(moved.to); // MovedFile = { from, to, rule }
      if (stats.mtimeMs < oneYearAgo) {
        console.log(`Compressing ${moved.to}...`);
        // Implement compression logic
      }
    }
  },
};
```

### Cloud Backup

```javascript
export default {
  name: 'cloud-backup',
  version: '1.0.0',

  async afterOrganize(context) {
    for (const moved of context.results.moved) {
      await uploadToCloud(moved.to);
    }
  },
};
```

### File Hash Verification

```javascript
export default {
  name: 'verify-hashes',
  version: '1.0.0',

  async beforeOrganize(context) {
    // Calculate hashes before moves — files are the transformed working set
    for (const file of context.files) {
      await storeHash(file.path, await calculateHash(file.path));
    }
  },

  async afterOrganize(context) {
    for (const moved of context.results.moved) {
      await verifyHash(moved.to);
    }
  },
};
```

## Publishing Plugins

1. Create an npm package with an ESM build
2. Export your plugin as the **default export**
3. Add `file-organizer-plugin` to your `package.json` keywords
4. Publish to npm

```json
{
  "name": "file-organizer-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "keywords": ["file-organizer-plugin"]
}
```

Users then add your package name to their `plugins:` list. Keep the plugin
dependency-free (or depend only on Node built-ins) — the CLI loads it with a
plain dynamic `import()`.
