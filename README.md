# TodoQ - Hierarchical Task Management CLI

A comprehensive TypeScript CLI tool that transforms hierarchical task systems into a SQLite-backed database with powerful querying, navigation, and management capabilities. TodoQ supports direct JSON-to-database workflows, eliminating markdown intermediaries for efficient task generation and management.

## Table of Contents

- [Overview](#overview)
- [Essential Commands](#essential-commands)
- [How It Works](#how-it-works)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Task Management](#task-management)
  - [Navigation & Status](#navigation--status)
  - [Listing & Querying](#listing--querying)
  - [JSON Import/Export](#json-importexport)
  - [Configuration](#configuration)
- [CLI Commands](#cli-commands)
- [Task JSON Schema](#task-json-schema)
- [Configuration](#configuration-1)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Advanced Features](#advanced-features)
- [Claude Code Integration](#claude-code-integration)
- [Use Cases](#use-cases)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

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

## How It Works

1. **Task Definition**: Define hierarchical tasks in JSON format with dependencies and metadata
2. **Database Storage**: SQLite backend stores tasks with proper indexing and relationships
3. **Smart Navigation**: Algorithms determine task order based on dependencies and hierarchy
4. **Completion Tracking**: Parent tasks auto-complete when all children are done
5. **Git Integration**: Track file changes during task execution

## Installation

```bash
git clone <repository-url>
cd todoq
npm install
npm run build
```

## Quick Start

1. **Initialize TodoQ**:
```bash
./dist/cli/index.js init
```

2. **Generate a task template**:
```bash
./dist/cli/index.js template > tasks.json
```

3. **Import tasks**:
```bash
./dist/cli/index.js import tasks.json
```

4. **View current task**:
```bash
./dist/cli/index.js current
```

5. **List all tasks**:
```bash
./dist/cli/index.js list
```

## Usage

### Task Management

```bash
todoq insert <number> <name>     # Insert task with re-numbering
todoq remove <number>            # Remove task
todoq update <number>            # Update task details (interactive)
todoq show <number>              # Show detailed task view
todoq complete <number>          # Mark task as complete/done
todoq complete <number> --notes "Details"  # Complete with notes
todoq incomplete <number>        # Mark task as incomplete
todoq in-progress <number>       # Mark task as in-progress
todoq cancel <number>            # Mark task as cancelled
```

### Navigation & Status

```bash
todoq current                    # Show current task details
todoq current --number           # Show current task number only
todoq next                       # Show next task
todoq prev                       # Show previous task
todoq remaining                  # Count incomplete tasks
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
todoq list --json               # JSON output
todoq list --format table       # Table format
```

### JSON Import/Export

```bash
todoq import <file.json>         # Import tasks from JSON file
todoq import --stdin             # Import from stdin
todoq bulk-validate <file.json>  # Validate JSON without importing
todoq export                     # Export all tasks as JSON to stdout
todoq export --file <file.json>  # Export to file
todoq export --pretty            # Pretty-printed JSON output
```

### Configuration

```bash
todoq init                       # Initialize database and config
todoq init --interactive         # Interactive setup with prompts
todoq template                   # Generate empty JSON template
todoq template --interactive     # Interactive template creation
todoq config set <key=value>     # Set configuration
todoq config get <key>           # Get configuration value
todoq config list                # Show all configuration
todoq config edit                # Open config in editor
```

## CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize database and configuration | `todoq init` |
| `template` | Generate JSON task template | `todoq template > tasks.json` |
| `import` | Import tasks from JSON | `todoq import tasks.json` |
| `export` | Export tasks to JSON | `todoq export --pretty` |
| `list` | List tasks with filtering options | `todoq list --tree` |
| `current` | Show current/active task | `todoq current` |
| `show` | Display detailed task information | `todoq show 1.0` |
| `complete` | Mark task as completed | `todoq complete 1.0 --notes "Done"` |
| `stats` | Show project statistics | `todoq stats` |
| `progress` | Display progress tree | `todoq progress` |
| `config` | Manage configuration | `todoq config list` |

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
- **completion_notes**: Notes about what was actually implemented (optional)

## Configuration

TodoQ uses cosmiconfig for flexible configuration loading. It searches for configuration in:

- `package.json` (todoq property)
- `.todoqrc`
- `.todoqrc.json`
- `.todoqrc.js`
- `todoq.config.js`
- `todoq.config.json`

### Default Configuration

```json
{
  "database": {
    "path": "~/.todoq/tasks.db",
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
│   └── git/            # Git integration for file tracking
└── cli/                # Command implementations
    ├── commands/       # Individual command files
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

## Advanced Features

### Parent-Child Completion

TodoQ automatically calculates completion percentages for parent tasks based on their children's status. When all child tasks are completed, the parent task is automatically marked as completed.

### Dependency Management

Tasks can depend on other tasks. TodoQ validates that:
- All dependencies exist
- No circular dependencies are created
- Tasks cannot be completed until all dependencies are completed

### Git Integration

When tasks are completed, TodoQ can automatically:
- Track which files were modified during task execution
- Link file changes to task completion records

### Bulk Operations

TodoQ supports efficient bulk operations with:
- Transaction-based imports for data integrity
- Detailed validation and error reporting
- Rollback on failures
- Progress tracking for large imports
