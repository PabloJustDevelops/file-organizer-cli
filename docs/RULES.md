# Rules Configuration Guide

## Overview

Rules define how files are organized. Each rule has:
- **name**: Unique identifier
- **patterns**: Glob patterns to match files
- **destination**: Target path with optional variables
- **priority**: Higher = applied first (optional)
- **enabled**: Can be set to false to disable (optional)
- **condition**: Additional matching criteria (optional)

## Plugins (optional)

Load plugins before any file is organized:

```yaml
plugins:
  - ./my-plugin.js           # local, relative to this config file
  - file-organizer-compress  # npm package name
```

- Local specs resolve against the **config file's directory**, npm specifiers
  against the user's project. `fo config validate` checks the field's
  structure only — it never imports or executes plugin files.
- At organize time each spec is loaded, validated against the plugin
  contract, and registered; a broken spec aborts the run **before any file
  is scanned or moved**. Duplicate plugin names (across config and
  programmatic sources) are an error.
- See [PLUGINS.md](PLUGINS.md) for the plugin API and
  [specs/SPEC-config-plugins.md](specs/SPEC-config-plugins.md) for the
  formal contract.

## Pattern Syntax

### Extension Patterns
```yaml
patterns: ["*.jpg", "*.png", "*.gif"]
```
Matches files by extension.

### Name Patterns
```yaml
patterns: ["*screenshot*", "*Screen Shot*"]
```
Matches files containing text anywhere in the name.

### Prefix Patterns
```yaml
patterns: ["project-*", "IMG_*"]
```
Matches files starting with text.

### Wildcard
```yaml
patterns: ["*"]
```
Matches all files.

## Destination Variables

Use variables in destination paths. **Placeholders are case-insensitive**
(`{Year}` resolves like `{year}`); an unknown token is left as literal text and
`fo` warns about it at organize time (and `fo config validate` reports it).

| Variable | Type | Example Output |
|----------|------|----------------|
| `{year}` | Number | `2024` |
| `{month}` | Number | `01` - `12` |
| `{monthName}` | String | `january` - `december` (honors `locale`) |
| `{day}` | Number | `01` - `31` |
| `{year-month}` / `{yearMonth}` | String | `2024-03` |
| `{extension}` | String | `jpg`, `pdf` |
| `{type}` | String | `image`, `document`, `video`, `audio`, `code`, `archive`, `other` |
| `{name}` | String | Filename without extension |
| `{parent}` | String | Name of the subfolder the file was scanned from |
| `{sizeBucket}` | String | `tiny`, `small`, `medium`, `large`, `huge` (thresholds via `sizeBuckets`) |
| `{now:<format>}` | String | **Run-time** date, e.g. `{now:year-month}` → `2026-09`; accepts `year`, `month`, `monthName`, `day`, `year-month` |
| `{match}` / `{match1}` | String | Capture group from the rule's regex `condition.pattern` (`{match}` = group 0, `{match1}` = group 1) |

## Config Options

Beyond `rules:`, the config file accepts:

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `conflictResolution` | `rename` \| `overwrite` \| `skip` \| `newest` | `rename` | How to resolve a destination that already exists |
| `recursive` | Boolean | **`false`** | Descend into subdirectories when scanning. Off by default — opt in per run with `-r` |
| `dryRun` | Boolean | `false` | Preview only; equivalent to always passing `--dry-run` |
| `includeHidden` | Boolean | `false` | Include dotfiles when scanning |
| `locale` | String (BCP-47) | `en-US` | Affects `{monthName}` and `{now:monthName}`; invalid tags are rejected by `fo config validate` |
| `sizeBuckets` | Object | `{ small: 100KB, medium: 1MB, large: 100MB }` | Byte thresholds for `{sizeBucket}` (positive numbers) |
| `plugins` | String[] | `[]` | Plugin specs loaded before any file is moved |


## Conditions

### Regex Condition
Match files using regular expressions. The `pattern` is **required** and is
compiled at config time, so a typo fails `fo config validate` (naming the rule)
instead of the organize run:

```yaml
condition:
  type: regex
  pattern: "^(project\\d+)-"
```

### Extension Condition
Match specific extensions:

```yaml
condition:
  type: extension
  extensions: ["jpg", "png", "gif"]
```

### Size Condition
Match files by size (in bytes):

```yaml
condition:
  type: size
  minSize: 1048576      # 1 MB minimum
  maxSize: 104857600    # 100 MB maximum
```

### Date Condition
Match files by modification date:

```yaml
condition:
  type: date
  after: "2024-01-01"
  before: "2024-12-31"
```

## Priority System

Rules are applied in priority order (highest first):

```yaml
rules:
  - name: Screenshots
    priority: 20        # Applied first
    patterns: ["*screenshot*"]
    destination: "./screenshots"

  - name: Project Files
    priority: 15        # Applied second
    patterns: ["project-*"]
    destination: "./projects"

  - name: Images
    priority: 10        # Applied third
    patterns: ["*.jpg"]
    destination: "./images"

  - name: Other Files
    priority: 0         # Applied last (default)
    patterns: ["*"]
    destination: "./other"
```

## Complete Example

```yaml
rules:
  # High priority: Screenshots
  - name: Screenshots
    patterns:
      - "*screenshot*"
      - "*Screen Shot*"
      - "*Captura de pantalla*"
    destination: "./screenshots/{year}/{month}"
    priority: 20
    condition:
      type: regex
      pattern: "(screenshot|screen shot|captura)"

  # Project files with regex capture
  - name: Project Alpha Files
    patterns: ["*"]
    destination: "./projects/alpha"
    priority: 15
    condition:
      type: regex
      pattern: "^alpha-"

  # Large files (> 50 MB)
  - name: Large Files
    patterns: ["*"]
    destination: "./large/{type}"
    priority: 12
    condition:
      type: size
      minSize: 52428800

  # Recent files only
  - name: Recent Downloads
    patterns: ["*"]
    destination: "./recent/{year-month}"
    priority: 11
    condition:
      type: date
      after: "2024-06-01"

  # Images organized by date
  - name: Photos
    patterns:
      - "*.jpg"
      - "*.jpeg"
      - "*.png"
      - "*.raw"
    destination: "./photos/{year}/{month}/{day}"
    priority: 10

  # Documents by type
  - name: Documents
    patterns:
      - "*.pdf"
      - "*.docx"
      - "*.xlsx"
      - "*.pptx"
    destination: "./documents/{type}"
    priority: 10

  # Default: Everything else
  - name: Other
    patterns: ["*"]
    destination: "./other/{type}"
    priority: 0
    enabled: true

conflictResolution: rename
recursive: false
includeHidden: false
```
