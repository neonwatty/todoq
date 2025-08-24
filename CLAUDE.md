# TodoQ - Hierarchical Task Management CLI

A TypeScript CLI tool that transforms hierarchical task systems into a SQLite-backed database with powerful querying, navigation, and management capabilities. TodoQ supports direct JSON-to-database workflows for efficient task generation and management.

## Key Features

- **Hierarchical task organization** with parent-child relationships (1.0, 1.1, 1.2.1)
- **SQLite backend** with WAL mode for persistent, queryable storage  
- **JSON import/export** for programmatic task generation
- **Dependency management** with circular dependency detection
- **Git integration** for file change tracking
- **Smart navigation** algorithms for task ordering
- **Auto-completion** of parent tasks when all children complete

## Essential Commands

```bash
# Setup
todoq init                    # Initialize database and config
todoq template > tasks.json   # Generate JSON template

# Import/Export  
todoq import tasks.json       # Import tasks from JSON
todoq export --pretty         # Export all tasks as JSON

# Navigation
todoq current                 # Show current task
todoq list --tree            # Show hierarchical view
todoq show 1.0               # Show task details

# Management
todoq complete 1.0           # Mark task complete
todoq in-progress 1.0        # Mark task in progress
todoq stats                  # Show progress statistics
```

## Task JSON Schema

```json
{
  "tasks": [
    {
      "number": "1.0",
      "name": "Task Name",
      "description": "Detailed description",
      "parent": null,
      "status": "pending",
      "priority": 1,
      "dependencies": [],
      "files": ["src/file.ts"],
      "docs_references": ["https://docs.example.com"],
      "testing_strategy": "Unit and integration tests"
    }
  ]
}
```

## Development

**Build & Test:**
```bash
npm run build           # Build with esbuild to dist/cli/index.js
npm run dev            # Development mode with tsx
npm run test           # Run all tests with vitest
npm run lint           # ESLint check
npm run typecheck      # TypeScript check
```

**Run CLI:**
```bash
./dist/cli/index.js [command]  # After building
npm run dev [command]          # Development mode
```

## Architecture

**Clean Architecture Pattern:**
- `src/core/` - Domain logic, types, validation, business rules
- `src/adapters/` - External integrations (database, config, git)
- `src/cli/` - Command implementations and formatters

**Database:** SQLite with WAL mode, hierarchical task numbering, transaction-based operations

**Key Technologies:** TypeScript, Commander.js, Better-sqlite3, Zod validation, Cosmiconfig

## Configuration

Uses cosmiconfig for flexible loading from `.todoqrc`, `todoq.config.js`, or `package.json` (todoq property).

Default storage: `~/.todoq/tasks.db`

---

*This file provides guidance to Claude Code agents and serves as a quick reference for TodoQ users and contributors.*