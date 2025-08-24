# TodoQ - Hierarchical Task Management CLI

A TypeScript CLI tool for hierarchical task management with SQLite backend, JSON workflows, and dependency tracking.

## Key Features

- **Hierarchical tasks** with numbering (1.0, 1.1, 1.2.1)
- **SQLite storage** for persistent, queryable data
- **JSON import/export** for programmatic task generation
- **Dependency tracking** with circular detection
- **Smart navigation** and auto-completion of parent tasks

## Quick Start

```bash
# Initialize (creates .todoq/todoq.db and .todoqrc in current directory)
todoq init

# Generate template and import tasks
todoq template > tasks.json
todoq import tasks.json

# View and manage
todoq current                 # Show current task
todoq list --tree            # Show all tasks as tree
todoq complete 1.0           # Mark task complete
```

## Essential Commands

**Setup:**
- `todoq init` - Initialize database and config
- `todoq template` - Generate JSON template

**Import/Export:**
- `todoq import tasks.json` - Import tasks from JSON
- `todoq bulk-validate tasks.json` - Validate JSON without importing
- `todoq export --pretty` - Export all tasks as JSON

**Navigation:**
- `todoq current` - Show current task or change its status
- `todoq current --complete` - Mark current task as completed
- `todoq current --start` - Mark current task as in progress
- `todoq current --cancel` - Mark current task as cancelled
- `todoq list --tree` - Show hierarchical view
- `todoq show 1.0` - Show task details
- `todoq search <query>` - Search tasks
- `todoq stats` - Show progress statistics

**Task Management:**
- `todoq add 1.1 "Task name"` - Insert/add new task
- `todoq update 1.0` - Update task details
- `todoq delete 1.0` - Remove task
- `todoq done 1.0` - Mark task complete (alias: complete)
- `todoq start 1.0` - Mark task in progress (alias: in-progress)
- `todoq reopen 1.0` - Mark task incomplete (alias: incomplete)
- `todoq cancel 1.0` - Mark task cancelled

## Task JSON Format

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
      "testing_strategy": "Unit and integration tests",
      "notes": "Additional notes",
      "completion_notes": "What was actually implemented"
    }
  ]
}
```

**Status Options:** `pending`, `in_progress`, `completed`, `cancelled`

## Configuration

**Project-local storage:** 
- Database: `.todoq/todoq.db` (in current working directory)
- Config: `.todoqrc` (created by `todoq init`)

Configure via `.todoqrc`, `todoq.config.js`, or `package.json` (todoq property).

---

*For full documentation, see README.md*