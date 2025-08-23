# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TodoQ is a hierarchical task management CLI built with TypeScript, SQLite, and Commander.js. It transforms hierarchical task systems into a database-backed solution with JSON import/export, dependency tracking, and git integration.

## Development Commands

**Build & Test:**
```bash
npm run build           # Build with esbuild to dist/cli/index.js
npm run dev            # Development mode with tsx
npm run test           # Run all tests with vitest
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:watch     # Watch mode for tests
npm run lint           # ESLint on TypeScript files
npm run typecheck      # TypeScript compilation check
```

**Running the CLI:**
```bash
./dist/cli/index.js [command]  # After building
npm run dev [command]          # Development mode
```

## Architecture

**Clean Architecture Pattern:**
- `src/core/` - Domain logic, types, validation, business rules
- `src/adapters/` - External integrations (database, config, git) 
- `src/cli/` - Command implementations and formatters

**Key Files:**
- `src/core/types.ts` - All TypeScript interfaces and types
- `src/adapters/database/client.ts` - SQLite connection with WAL mode
- `src/cli/index.ts` - Commander.js CLI setup with global options
- `build.js` - esbuild configuration with shebang injection

## Database

**SQLite with WAL Mode:**
- Main storage in `~/.todoq/tasks.db` (configurable)
- Tables: tasks, task_dependencies, config, migrations
- Hierarchical task numbering (1.0, 1.1, 1.2.1)
- Transaction-based bulk operations

## Task Management

**Core Concepts:**
- Hierarchical numbering with parent-child relationships
- Status tracking: pending, in_progress, completed, cancelled
- Dependency management with circular dependency detection
- Git integration for file change tracking
- Parent task completion percentages auto-calculated

**JSON Schema:**
Tasks are imported/exported in JSON format with fields: number, name, description, parent, status, priority, docs_references, testing_strategy, dependencies, files, notes.

## Configuration

Uses cosmiconfig for flexible configuration loading from:
- `.todoqrc`, `.todoqrc.json`, `todoq.config.js`, `package.json` (todoq property)

## Testing

**Structure:**
- `tests/unit/` - Unit tests for core logic
- `tests/integration/` - Database and CLI integration tests
- Uses vitest with separate configs for unit vs integration
- In-memory SQLite for test isolation

## Key Implementation Details

- Commander.js with pre-action hooks for config loading
- Zod for runtime validation of JSON imports
- Better-sqlite3 with prepared statements and transactions
- Error handling with custom TodoqError class
- Git file tracking on task completion
- Bulk operations with detailed result reporting

## Common Patterns

**Database Operations:** Use transactions for multi-step operations, prepared statements for performance
**CLI Commands:** Inherit global options (--json, --config), use pre-action hooks for setup
**Validation:** Zod schemas for input validation with detailed error reporting
**Error Handling:** Custom TodoqError with error codes and optional details