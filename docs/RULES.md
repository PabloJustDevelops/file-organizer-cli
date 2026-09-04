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

Use variables in destination paths:

| Variable | Type | Example Output |
|----------|------|----------------|
| `{year}` | Number | `2024` |
| `{month}` | Number | `01` - `12` |
| `{monthName}` | String | `january` - `december` |
| `{day}` | Number | `01` - `31` |
| `{year-month}` | String | `2024-03` |
| `{extension}` | String | `jpg`, `pdf` |
| `{type}` | String | `image`, `document`, `video`, `audio`, `code`, `archive`, `other` |
| `{name}` | String | Filename without extension |
| `{match1}` | String | First regex capture group |

## Conditions

### Regex Condition
Match files using regular expressions:

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
      pattern: "(?i)(screenshot|screen shot|captura)"

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
