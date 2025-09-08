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
todoq current --complete      # Mark current task complete
todoq current --start         # Mark current task in progress  
todoq current --reopen        # Mark current task pending
todoq current --cancel        # Mark current task cancelled
todoq list --tree            # Show hierarchical view
todoq show 1.0               # Show task details

# Management
todoq complete 1.0           # Mark task complete
todoq in-progress 1.0        # Mark task in progress
todoq stats                  # Show progress statistics

# Claude Integration (AI-Powered Task Execution)
todoq work-next              # Have Claude work on the next task
todoq --verbose work-next --output-format stream-json  # See Claude's full conversation
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
npm run test:claude    # Run Claude integration tests
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

Default storage: `.todoq/todoq.db`

### Claude Integration Configuration

Complete configuration options for `todoq work-next`:

```json
{
  "claude": {
    "enabled": true,
    "claudePath": "/path/to/claude",
    "maxIterations": 10,
    "timeout": 180000,
    "model": "opusplan",
    "verbose": true,
    "outputFormat": "stream-json",
    "permissionMode": "bypassPermissions",
    "dangerouslySkipPermissions": false,
    "allowedTools": ["Read", "Write", "Edit", "Bash", "Grep", "WebFetch", "WebSearch", "TodoWrite"],
    "customArgs": ["--custom-flag"],
    "continueSession": true,
    "appendSystemPrompt": "Custom instructions for Claude to follow during task execution",
    "maxRetries": 3,
    "retryDelay": 1000,
    "retryBackoffMultiplier": 2,
    "maxRetryDelay": 30000
  }
}
```

**Core Settings:**
- `"enabled": true/false` - Enable/disable Claude integration
- `"claudePath": "path"` - Path to Claude Code binary (auto-detected if omitted)  
- `"model": "sonnet|opus|opusplan|haiku"` - Claude model to use (default: "opusplan" - uses opus for planning, sonnet for execution)
- `"continueSession": true/false` - Continue previous conversation (default: true)

**Execution Control:**
- `"maxIterations": 10` - Max iterations for TodoQ internal logic (1-50)
- `"timeout": 180000` - Timeout in milliseconds for Claude operations (60-1200 seconds)

**Output & Debugging:**
- `"verbose": true/false` - Show Claude's full conversation and reasoning
- `"outputFormat": "text|json|stream-json"` - Claude output format (use "stream-json" for verbose)

**Permission Control:**
- `"permissionMode": "acceptEdits|bypassPermissions|default|plan"` - Permission handling mode
- `"dangerouslySkipPermissions": true/false` - Skip ALL permission checks (nuclear option)
- `"allowedTools": [...]` - List of Claude Code tools to allow
- `"customArgs": [...]` - Additional arguments to pass to Claude Code

**Retry Configuration (resilient headless execution):**
- `"maxRetries": 3` - Max retry attempts (0-10, default: 3)
- `"retryDelay": 2000` - Initial delay in ms (default: 2000)
- `"retryBackoffMultiplier": 2` - Backoff factor (default: 2)
- `"maxRetryDelay": 15000` - Max delay cap in ms (default: 15000)

Retries on: exit codes 1-2, timeouts. Doesn't retry on: exit code 127, permission errors, ENOENT.
Default delays: 2s → 4s → 8s (with maxRetries: 3)

**Command Line Options:**
```bash
# Basic usage
todoq work-next                                        # Use config defaults
todoq --verbose work-next --output-format stream-json  # See Claude's conversation

# Advanced options
todoq work-next --model opus --max-iterations 15 --test-timeout 1200000
todoq work-next --permission-mode plan --continue-session --skip-claude-check  
todoq work-next --dangerously-skip-permissions         # Full permissions (tests)

# All available options:
# --test-timeout <ms>             Execution timeout (60000-1200000ms)
# --max-iterations <num>          Max Claude iterations (1-50) 
# --max-turns <num>               Max conversation turns (1-100)
# --model <model>                 Claude model (sonnet|opus|haiku)
# --output-format <format>        Output format (text|json|stream-json)
# --permission-mode <mode>        Permission handling mode
# --dangerously-skip-permissions  Skip ALL permission checks
# --continue-session              Resume previous conversation  
# --skip-claude-check             Skip Claude availability check
```

**Common Configuration Examples:**

```json
// Minimal setup (basic functionality)
{
  "claude": {
    "enabled": true
  }
}

// Development setup (see everything Claude does)  
{
  "claude": {
    "enabled": true,
    "verbose": true,
    "outputFormat": "stream-json",
    "permissionMode": "bypassPermissions"
  }
}

// Production automation (fast, reliable)
{
  "claude": {
    "enabled": true,
    "dangerouslySkipPermissions": true,
    "maxIterations": 20,
    "timeout": 300000,
    "model": "opusplan"
  }
}

// Resilient headless execution with retries
{
  "claude": {
    "enabled": true,
    "dangerouslySkipPermissions": true,
    "maxRetries": 10,  // Match interactive mode resilience
    "retryDelay": 1000,
    "retryBackoffMultiplier": 2,
    "maxRetryDelay": 30000
  }
}
```

---

*This file provides guidance to Claude Code agents and serves as a quick reference for TodoQ users and contributors.*