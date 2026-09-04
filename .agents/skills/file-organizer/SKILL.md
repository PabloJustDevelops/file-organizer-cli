# File Organizer Skill

## Description
Skill for organizing files automatically using file-organizer-cli (`fo`).

## When to Use
- When the user wants to organize files or directories
- When the user asks about file management automation
- When the user needs to sort files by type, date, or pattern
- When the user wants to clean up downloads or desktop folders

## Commands

### Main Commands
- `fo organize [dir]` - Organize files in directory
- `fo watch [dir]` - Watch directory and auto-organize
- `fo undo` - Undo last operation
- `fo rules list` - List configured rules
- `fo rules add` - Add new rule interactively

### Config Commands
- `fo config init` - Create config file
- `fo config show` - Show current config
- `fo config validate` - Validate config file
- `fo config example` - Show example rules

## Common Usage Examples

### Organize Downloads folder
```bash
fo organize ~/Downloads --dry-run    # Preview first
fo organize ~/Downloads              # Actually organize
```

### Create config and organize
```bash
fo config init .file-organizer.yaml  # Create config
# Edit config file with your rules
fo organize .                        # Organize current directory
```

### Watch mode (auto-organize new files)
```bash
fo watch ~/Downloads
```

### Add a rule interactively
```bash
fo rules add
```

## Configuration Format
Rules are defined in YAML with patterns and destinations:

```yaml
rules:
  - name: Images
    patterns: ["*.jpg", "*.png"]
    destination: "./images/{year}/{month}"
```

### Available Variables
- `{year}` - File modification year
- `{month}` - File modification month (01-12)
- `{monthName}` - Month name
- `{day}` - Day of month
- `{year-month}` - YYYY-MM format
- `{extension}` - File extension
- `{type}` - File category (image, document, video, etc.)
- `{name}` - Filename without extension

## Error Handling
If organization fails, check:
1. Config file is valid YAML
2. Patterns use correct glob syntax
3. Destination paths are valid
4. Sufficient permissions on files/directories
