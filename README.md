# TodoQ - Hierarchical Task Management CLI

A comprehensive TypeScript CLI tool that transforms hierarchical task systems into a SQLite-backed database with powerful querying, navigation, and management capabilities. TodoQ supports direct JSON-to-database workflows, eliminating markdown intermediaries for efficient task generation and management.

## Table of Contents

- [Overview](#overview)
- [Essential Commands](#essential-commands)
- [Command Aliases](#command-aliases)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Task Management](#task-management)
  - [Navigation & Status](#navigation--status)
  - [Listing & Querying](#listing--querying)
  - [JSON Import/Export](#json-importexport)
  - [Configuration](#configuration)
- [Interactive Features](#interactive-features)
- [Detailed Task Views](#detailed-task-views)
- [CLI Commands](#cli-commands)
- [Task JSON Schema](#task-json-schema)
- [Configuration](#configuration-1)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Claude Code Integration](#claude-code-integration)
- [Testing](#testing)

## Overview

TodoQ is designed for developers who need sophisticated task management with hierarchical organization, dependency tracking, and seamless integration with development workflows. Unlike simple todo lists, TodoQ provides:

- **Hierarchical task organization** with parent-child relationships
- **SQLite backend** for persistent, queryable storage
- **JSON-first workflows** for programmatic task generation
- **Git integration** for file tracking
- **Dependency management** with circular dependency detection
- **Bulk operations** with transaction safety

## Essential Commands

```bash
# Initialize TodoQ
todoq init

# Generate and import tasks
todoq template > tasks.json
todoq import tasks.json

# Navigate tasks
todoq current          # Show current task
todoq next             # Show next task
todoq list --tree      # Show hierarchical view

# Manage tasks
todoq complete 1.0     # Mark task 1.0 as complete
todoq show 1.0         # Show task details
todoq stats            # Show progress statistics
```

## Command Aliases

Many TodoQ commands have shorter aliases for convenience:

| Command | Alias | Description |
|---------|-------|-------------|
| `show` | `get` | Show detailed task view |
| `insert` | `add` | Insert/add new task |
| `remove` | `delete` | Remove/delete task |
| `update` | `edit` | Update task details |
| `complete` | `done` | Mark task as completed |
| `incomplete` | `reopen` | Mark task as pending |
| `in-progress` | `start` | Mark task as in progress |
| `prev` | `previous` | Show previous task |
| `list` | `ls` | List tasks |
| `import` | `add-json` | Import tasks from JSON |
| `search` | `find` | Search tasks |
| `config list` | `config show` | Show all configuration |

## How It Works

1. **Task Definition**: Define hierarchical tasks in JSON format with dependencies and metadata
2. **Database Storage**: SQLite backend stores tasks with proper indexing and relationships
3. **Smart Navigation**: Algorithms determine task order based on dependencies and hierarchy
4. **Completion Tracking**: Parent tasks auto-complete when all children are done
5. **Git Integration**: Track file changes during task execution

## Installation

### NPM Installation (Coming Soon)

```bash
# When published to NPM registry
npm install -g todoq
```

### From Source

```bash
git clone https://github.com/todoq/todoq.git
cd todoq
npm install
npm run build
# Binary will be available at dist/cli/index.js
```

### Local Development

```bash
# After cloning and installing dependencies
npm run dev [command]  # Run commands in development mode
./dist/cli/index.js [command]  # Run built binary
```

### Requirements

- Node.js >= 22.0.0

## Quick Start

1. **Initialize TodoQ** (creates `.todoq/todoq.db` and `.todoqrc` in current directory):
```bash
todoq init
```

2. **Generate a task template**:
```bash
todoq template > tasks.json
```

3. **Import tasks**:
```bash
todoq import tasks.json
```

4. **View current task**:
```bash
todoq current
```

5. **List all tasks**:
```bash
todoq list
```

## Usage

### Task Management

```bash
todoq insert <number> <name>     # Insert task with re-numbering
todoq add <number> <name>        # Alias for insert
todoq insert <number> <name> -d "desc" -p "parent" --priority 1  # With options
todoq remove <number>            # Remove task
todoq delete <number>            # Alias for remove
todoq remove <number> --force    # Remove without confirmation
todoq update <number>            # Update task details
todoq edit <number>              # Alias for update
todoq update <number> --interactive  # Interactive update with prompts
todoq update <number> --name "New name" --status completed  # Direct update
todoq show <number>              # Show detailed task view
todoq get <number>               # Alias for show
todoq complete <number>          # Mark task as complete/done
todoq done <number>              # Alias for complete
todoq complete <number> --notes "Details"  # Complete with notes
todoq complete <number> --force  # Complete ignoring dependencies
todoq incomplete <number>        # Mark task as incomplete
todoq reopen <number>            # Alias for incomplete
todoq in-progress <number>       # Mark task as in-progress
todoq start <number>             # Alias for in-progress
todoq cancel <number>            # Mark task as cancelled
todoq cancel <number> --notes "Reason"  # Cancel with reason
todoq clear                      # Delete all tasks (with confirmation)
todoq clear --confirm            # Delete all tasks (skip confirmation)
```

### Navigation & Status

```bash
todoq current                    # Show current task details
todoq current --number           # Show current task number only
todoq current --complete         # Mark current task as completed
todoq current --start            # Mark current task as in progress
todoq current --reopen           # Mark current task as pending
todoq current --cancel           # Mark current task as cancelled
todoq current --complete --notes "Task finished"  # Complete with notes
todoq current --cancel --notes "No longer needed" # Cancel with reason
todoq current --complete --force # Force complete ignoring dependencies
todoq current --complete --json  # JSON output for automation
todoq next                       # Show next task
todoq prev                       # Show previous task
todoq search <query>             # Search tasks by number, name, or description
todoq find <query>               # Alias for search
todoq remaining                  # Count incomplete tasks
todoq remaining --count          # Show count as number only  
todoq remaining --json           # Show count in JSON format
todoq stats                      # Progress statistics
todoq progress                   # Show tree with completion percentages
todoq status                     # Overall project status summary
```

### Listing & Querying

```bash
todoq list                       # List all tasks
todoq list --status pending      # Filter by status
todoq list --status completed    # Show completed tasks
todoq list --parent 1.0         # Show subtasks of parent
todoq list --no-subtasks        # Show only parent tasks
todoq list --tree               # Show hierarchical tree view
todoq list --json               # JSON output for programmatic use
todoq list --format table       # Table format
todoq list --detailed           # Show complete task information (all fields)
todoq list --detailed --format table  # Comprehensive 11-column table view
todoq list --detailed --tree    # Hierarchical view with all task details
todoq list --json --status pending    # JSON output with status filtering
```

### JSON Import/Export

```bash
todoq import <file.json>         # Import tasks from JSON file
todoq add-json <file.json>       # Alias for import
todoq import -                   # Import from stdin
todoq import --validate-only     # Only validate, do not import
todoq import --skip-errors       # Skip invalid tasks and continue
todoq bulk-validate <file.json>  # Validate JSON without importing
todoq export                     # Export all tasks as JSON to stdout
todoq export --file <file.json>  # Export to file
todoq export --pretty            # Pretty-printed JSON output
todoq export --status pending    # Export only tasks with specific status
todoq export --completed         # Include completed tasks
```

### Configuration

```bash
todoq init                       # Initialize database and config
todoq init --interactive         # Interactive setup with prompts
todoq init --from-json <file>    # Initialize from existing JSON file
todoq template                   # Generate empty JSON template
todoq template --interactive     # Interactive template creation
todoq template --output <file>   # Save template to file
todoq config get <key>           # Get configuration value (e.g., database.path)
todoq config set <key=value>     # Set configuration value
todoq config list               # Show all configuration
todoq config show               # Alias for list
todoq config edit               # Open config file in editor
todoq config reset              # Reset configuration to defaults
todoq config reset --force      # Reset without confirmation
```

## Interactive Features

TodoQ supports interactive modes for several commands to make task management more user-friendly:

### Interactive Initialization

```bash
todoq init --interactive
```

Guides you through:
- Database path configuration
- Display format preferences (tree, list, table)
- Color output settings
- Default status and priority values

### Interactive Template Creation

```bash
todoq template --interactive
```

Helps create custom task templates by prompting for:
- Project name
- Number of sample tasks
- Task names and descriptions
- Priority levels for each task

### Interactive Task Updates

```bash
todoq update <number> --interactive
```

Provides a form-like interface to update:
- Task name
- Description
- Status (with dropdown choices)
- Priority (with validation)
- Notes

All interactive commands fall back to non-interactive mode if you provide the required options directly via command line flags.

## Detailed Task Views

TodoQ provides comprehensive task information display options for both human-readable and programmatic use:

### Detailed Human-Readable Output

```bash
# Show all task fields in multi-line format
todoq list --detailed

# Comprehensive table with all 11 columns (Number, Name, Status, Priority, Description, Files, Dependencies, Docs, Testing, Notes, Created)
todoq list --detailed --format table

# Hierarchical tree view with complete task information
todoq list --detailed --tree

# Combine with filtering
todoq list --detailed --status pending --parent 1.0
```

The `--detailed` flag shows complete task information including:
- Task number, name, status, and priority
- Full description and notes
- Associated files and documentation references
- Testing strategy and dependencies
- Creation and update timestamps
- Completion details (for finished tasks)

### JSON Output for Automation

```bash
# Complete JSON export for all tasks
todoq list --json

# JSON output with filtering (great for scripts and automation)
todoq list --json --status completed
todoq list --json --parent 1.0 --no-subtasks

# Combine JSON with detailed flag (includes all fields)
todoq list --json --detailed
```

JSON output includes all task fields and is perfect for:
- Automation and scripting
- Integration with other tools
- Programmatic task analysis
- Backup and migration workflows

## CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize database and configuration | `todoq init --interactive` |
| `template` | Generate JSON task template | `todoq template --interactive > tasks.json` |
| `import` | Import tasks from JSON | `todoq import tasks.json --skip-errors` |
| `bulk-validate` | Validate JSON without importing | `todoq bulk-validate tasks.json` |
| `export` | Export tasks to JSON | `todoq export --pretty --completed` |
| `list` | List tasks with filtering options | `todoq list --detailed --format table --status pending` |
| `search` | Search tasks by query | `todoq search "setup"` |
| `current` | Show current task or change its status | `todoq current --complete --notes "Done"` |
| `next` | Show next task | `todoq next` |
| `prev` | Show previous task | `todoq prev 1.0` |
| `show` | Display detailed task information | `todoq show 1.0` |
| `insert` | Insert/add new task | `todoq insert 1.1 "New task" --parent 1.0` |
| `remove` | Remove task and subtasks | `todoq remove 1.0 --force` |
| `update` | Update task details | `todoq update 1.0 --interactive` |
| `complete` | Mark task as completed | `todoq complete 1.0 --notes "Done"` |
| `incomplete` | Mark task as pending | `todoq incomplete 1.0` |
| `in-progress` | Mark task as in progress | `todoq in-progress 1.0` |
| `cancel` | Mark task as cancelled | `todoq cancel 1.0 --notes "Not needed"` |
| `clear` | Delete all tasks | `todoq clear --confirm --json` |
| `remaining` | Count incomplete tasks | `todoq remaining --count --json` |
| `stats` | Show project statistics | `todoq stats` |
| `status` | Overall project status summary | `todoq status` |
| `progress` | Display progress tree | `todoq progress --root 1.0` |
| `config` | Manage configuration | `todoq config set database.path=/new/path` |

## Task JSON Schema

Tasks are defined in JSON format with hierarchical numbering and rich metadata:

```json
{
  "tasks": [
    {
      "number": "1.0",
      "name": "Claude Code Integration & Session Continuation",
      "description": "Complete integration with Claude Code CLI for session continuation",
      "parent": null,
      "status": "pending",
      "priority": 1,
      "docs_references": [
        "https://docs.anthropic.com/en/docs/claude-code/setup",
        "https://nodejs.org/api/child_process.html"
      ],
      "testing_strategy": "Integration: end-to-end CLI communication, Unit: process spawning",
      "dependencies": [],
      "files": [
        "src/adapters/claude-integration.ts",
        "src/cli/commands/sessions.ts"
      ],
      "notes": "Core functionality for session continuation"
    }
  ]
}
```

### Field Descriptions

- **number**: Task number following format like `1.0`, `1.1`, `1.2.1` (required)
- **name**: Task name (required, max 200 characters)
- **description**: Detailed task description (optional)
- **parent**: Parent task number for hierarchical relationships (optional)
- **status**: Task status - `pending`, `in_progress`, `completed`, `cancelled` (optional, defaults to `pending`)
- **priority**: Task priority from 0-10 (optional, defaults to 0)
- **docs_references**: Array of documentation URLs (optional)
- **testing_strategy**: Testing approach description (optional)
- **dependencies**: Array of task numbers this task depends on (optional)
- **files**: Array of file paths associated with this task (optional, auto-populated from git)
- **notes**: Additional notes about the task (optional)
- **completion_notes**: Notes about what was actually implemented (optional, snake_case in JSON)

### Field Naming

**JSON Import/Export**: Uses snake_case field names (e.g., `docs_references`, `testing_strategy`, `completion_notes`)

**Internal/API**: Uses camelCase field names (e.g., `docsReferences`, `testingStrategy`, `completionNotes`)

## Configuration

### Database Storage

TodoQ creates a **project-local database** in your current working directory:
- Database: `.todoq/todoq.db` 
- Config file: `.todoqrc`
- Uses SQLite with WAL mode for better concurrency

This means each project gets its own task database, making TodoQ perfect for project-specific task management.

### Configuration Loading

TodoQ uses cosmiconfig for flexible configuration loading. It searches for configuration in:

- `.todoqrc` (created by `todoq init`)
- `.todoqrc.json`
- `.todoqrc.js`
- `todoq.config.js`
- `todoq.config.json`
- `package.json` (todoq property)

### Default Configuration

```json
{
  "database": {
    "path": ".todoq/todoq.db",
    "autoMigrate": true,
    "walMode": true
  },
  "display": {
    "format": "tree",
    "colors": true,
    "showCompleted": false
  },
  "defaults": {
    "status": "pending",
    "priority": 0
  }
}
```

## Architecture

The project follows a clean architecture pattern:

```
src/
├── core/               # Domain logic and business rules
│   ├── types.ts        # TypeScript interfaces and types
│   ├── task.ts         # Core task logic
│   ├── navigation.ts   # Task navigation algorithms
│   ├── validation.ts   # Business validation rules
│   └── completion.ts   # Parent-child completion logic
├── adapters/           # External system integrations
│   ├── database/       # SQLite operations
│   │   ├── client.ts   # Database connection and setup
│   │   └── migrations.ts # Schema migrations
│   ├── config/         # Configuration loading
│   ├── git/            # Git integration for file tracking
│   └── json/           # JSON import/export utilities
└── cli/                # Command implementations
    ├── commands/       # Individual command files
    │   ├── config.ts   # Configuration management commands
    │   ├── import-export.ts # JSON import/export commands
    │   ├── init.ts     # Initialization commands
    │   ├── list.ts     # Task listing commands
    │   ├── navigation.ts # Navigation commands
    │   ├── stats.ts    # Statistics commands
    │   └── task.ts     # Task management commands
    ├── formatters.ts   # Output formatting
    └── index.ts        # CLI setup and registration
```

## Database Schema

TodoQ uses SQLite with the following main tables:

- **tasks**: Main task storage with hierarchical relationships
- **task_dependencies**: Many-to-many dependency relationships
- **config**: Configuration storage
- **migrations**: Migration tracking

The database uses WAL mode for better concurrency and includes proper indexes for performance.

## Claude Code Integration

TodoQ integrates with Claude Code for AI-powered task execution. The `work-next` command supports automatic retry with exponential backoff for resilient headless execution:

```json
{
  "claude": {
    "maxRetries": 10,        // Retry up to 10 times
    "retryDelay": 2000,      // Start with 2s delay
    "retryBackoffMultiplier": 2,  // Double each retry
    "maxRetryDelay": 30000   // Cap at 30s
  }
}
```

Retries on exit codes 1-2 and timeouts. See [CLAUDE.md](CLAUDE.md) for details.

## Testing

TodoQ has a comprehensive test suite covering all aspects of functionality:

### Test Categories

```bash
# Run all tests
npm run test:all

# Individual test suites
npm run test:unit        # Unit tests (fast feedback)
npm run test:integration # Integration tests (database operations)  
npm run test:functional  # Functional tests (full CLI workflows)

# Watch mode for development
npm run test:unit:watch
npm run test:integration:watch
npm run test:functional:watch

# Coverage reporting
npm run test:coverage
```

**Test Coverage:**
- **Unit tests** (75+ tests): Core business logic, validation, utilities
- **Integration tests** (50+ tests): Database operations, CLI command integration
- **Functional tests** (22+ tests): End-to-end CLI workflows, file system operations

**Functional tests validate:**
- File creation with correct names (`.todoqrc`, `todoq.db`)
- Working directory behavior
- Complete user workflows (init → template → import → complete)
- Error handling and edge cases
- Cross-platform compatibility
