# TodoQ - TypeScript Task Management CLI Implementation Plan

## Overview
A comprehensive TypeScript CLI tool that transforms hierarchical task systems into a SQLite-backed database with powerful querying, navigation, and management capabilities. Built with patterns learned from the tfq CLI tool, todoq supports direct JSON-to-database workflows, eliminating markdown intermediaries for efficient task generation and management.

## Architecture Overview

### Core Components
- **SQLite Database**: Persistent storage with WAL mode, proper indexing, and transaction support
- **Commander.js CLI**: Lightweight command system with global options and pre-action hooks
- **JSON Integration**: Direct JSON input/output for programmatic workflows
- **Validation System**: Runtime validation with Zod and detailed error reporting
- **Configuration Management**: Multi-source configuration with validation

### Architecture Pattern (from tfq)
```
todoq/
├── src/
│   ├── core/               # Domain logic and business rules
│   │   ├── types.ts        # TypeScript interfaces and types
│   │   ├── task.ts         # Core task logic
│   │   ├── navigation.ts   # Task navigation algorithms
│   │   └── validation.ts   # Business validation rules
│   ├── adapters/           # External system integrations
│   │   ├── database/       # SQLite operations
│   │   │   ├── client.ts   # Database connection and setup
│   │   │   ├── queries.ts  # SQL query builders
│   │   │   └── migrations.ts # Schema migrations
│   │   ├── json/           # JSON import/export
│   │   └── config/         # Configuration loading
│   └── cli/                # Command implementations
│       ├── commands/       # Individual command files
│       ├── formatters.ts   # Output formatting
│       └── index.ts        # CLI setup and registration
```

## Database Schema

### Core Tables with Optimizations
```sql
-- Main tasks table with proper indexing
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    task_number TEXT UNIQUE NOT NULL, -- e.g., "1.0", "1.1", "1.2"
    name TEXT NOT NULL,
    description TEXT,
    docs_references TEXT, -- JSON array
    testing_strategy TEXT,
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    files TEXT, -- JSON array of file paths (auto-populated from git)
    notes TEXT,
    completion_notes TEXT, -- What was actually implemented
    completion_percentage REAL, -- Auto-calculated for parent tasks (0-100)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_task_number ON tasks(task_number);
CREATE INDEX idx_tasks_priority ON tasks(priority DESC);

-- Task dependencies (many-to-many)
CREATE TABLE task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, depends_on_id)
);

-- Configuration storage
CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enable WAL mode for better concurrency (from tfq)
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
```

## Type Definitions (from tfq patterns)

```typescript
// Core types with strict typing
interface Task {
    id?: number;
    parentId?: number;
    taskNumber: string;
    name: string;
    description?: string;
    docsReferences?: string[];
    testingStrategy?: string;
    status: TaskStatus;
    priority: number;
    files?: string[];
    notes?: string;
    completionNotes?: string;  // What was actually implemented
    completionPercentage?: number;  // Auto-calculated for parent tasks
    createdAt?: Date;
    updatedAt?: Date;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface TodoqConfig {
    database: {
        path: string;
        autoMigrate: boolean;
        walMode: boolean;
    };
    display: {
        format: 'tree' | 'list' | 'table';
        colors: boolean;
        showCompleted: boolean;
    };
    defaults: {
        status: TaskStatus;
        priority: number;
    };
}

// Result types for operations
interface OperationResult<T> {
    success: boolean;
    data?: T;
    error?: TodoqError;
}

interface BulkInsertResult {
    success: boolean;
    inserted: Task[];
    skipped: Array<{task: TaskInput; reason: string}>;
    errors: Array<{task: TaskInput; error: string}>;
    summary: {
        total: number;
        successful: number;
        skipped: number;
        failed: number;
    };
}
```

## JSON Schema for Task Creation

### Task Input Format
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

### Validation with Zod
```typescript
import { z } from 'zod';

const TaskInputSchema = z.object({
    number: z.string().regex(/^\d+(\.\d+)*$/),
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    parent: z.string().nullable().optional(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    priority: z.number().int().min(0).max(10).optional(),
    docs_references: z.array(z.string().url()).optional(),
    testing_strategy: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(),
    notes: z.string().optional(),
    completion_notes: z.string().optional()
});

const BulkTaskInputSchema = z.object({
    tasks: z.array(TaskInputSchema)
});
```

## Complete CLI Command Set (with Commander.js)

### Core Navigation & Status Commands
```bash
# Task Navigation
todoq current                    # Show current task details
todoq current --number           # Show current task number only
todoq current --json             # Output as JSON
todoq next                       # Show next task
todoq next --number              # Show next task number only  
todoq prev                       # Show previous task
todoq prev --number              # Show previous task number only

# Status & Statistics
todoq remaining                  # Count incomplete tasks
todoq stats                      # Progress statistics (completed/total, percentages)
todoq progress                    # Show tree with completion percentages
todoq status                     # Overall project status summary
todoq status --json              # JSON output for programmatic use
```

### Task Management Commands
```bash
# Basic CRUD Operations
todoq insert <number> <name>     # Insert task with re-numbering
todoq remove <number>            # Remove task
todoq update <number>            # Update task details (interactive)
todoq show <number>              # Show detailed task view
todoq show <number> --json       # JSON output

# Status Management
todoq complete <number>          # Mark task as complete/done
todoq complete <number> --notes "Implementation details"  # Complete with notes
todoq incomplete <number>        # Mark task as incomplete
todoq in-progress <number>        # Mark task as in-progress
todoq cancel <number>            # Mark task as cancelled
```

### Listing & Querying Commands
```bash
# List Operations with flexible output
todoq list                       # List all tasks
todoq list --status pending      # Filter by status
todoq list --status completed    # Show completed tasks
todoq list --parent 1.0         # Show subtasks of parent
todoq list --no-subtasks        # Show only parent tasks
todoq list --tree               # Show hierarchical tree view
todoq list --json               # JSON output
todoq list --format table       # Table format
```

### JSON Import/Export Commands
```bash
# Import - JSON only with strict validation
todoq import <file.json>         # Import tasks from JSON file
todoq import --stdin             # Import from stdin (for piping)
todoq add-json <file.json>       # Alias for import
todoq bulk-add <file.json>       # Optimized bulk insertion with transactions
todoq bulk-validate <file.json>  # Validate JSON without importing

# Export - JSON only
todoq export                     # Export all tasks as JSON to stdout
todoq export --file <file.json>  # Export to file
todoq export --pretty            # Pretty-printed JSON output
```

### Configuration & Initialization
```bash
# Setup with interactive mode (from tfq)
todoq init                       # Initialize database and config
todoq init --interactive         # Interactive setup with prompts
todoq init --from-json <file>    # Initialize from existing JSON

# Configuration management
todoq config set <key=value>     # Set configuration
todoq config get <key>           # Get configuration value
todoq config list                # Show all configuration
todoq config edit                # Open config in editor

# Templates
todoq template                   # Generate empty JSON template
todoq template --interactive     # Interactive template creation
```

## Technical Stack (Updated from tfq learnings)

### Dependencies
```json
{
    "dependencies": {
        "commander": "^11.x",        // CLI framework (replacing oclif)
        "better-sqlite3": "^9.x",    // Fast SQLite3 with WAL support
        "zod": "^3.x",               // Runtime validation
        "chalk": "^5.x",             // Terminal colors
        "inquirer": "^9.x",          // Interactive prompts
        "cosmiconfig": "^8.x",       // Flexible configuration
        "ora": "^6.x",               // Spinner for long operations
        "cli-table3": "^0.6.x"       // Table formatting
    },
    "devDependencies": {
        "@types/better-sqlite3": "^7.x",
        "@types/inquirer": "^9.x",
        "typescript": "^5.x",
        "tsx": "^4.x",               // Fast TypeScript execution
        "vitest": "^1.x",            // Testing framework
        "esbuild": "^0.19.x"         // Fast bundling
    }
}
```

## Implementation Patterns from tfq

### 1. Database Connection with WAL Mode
```typescript
import Database from 'better-sqlite3';

export class DatabaseClient {
    private db: Database.Database;

    constructor(path: string) {
        this.db = new Database(path);
        this.optimize();
    }

    private optimize() {
        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = -64000'); // 64MB cache
    }

    transaction<T>(fn: () => T): T {
        const trx = this.db.transaction(fn);
        return trx();
    }
}
```

### 2. Commander.js Setup with Global Options
```typescript
import { Command } from 'commander';

const program = new Command()
    .name('todoq')
    .description('Hierarchical task management CLI')
    .version('1.0.0')
    .option('-c, --config <path>', 'config file path')
    .option('--json', 'output as JSON')
    .hook('preAction', async (thisCommand, actionCommand) => {
        // Load config before any command
        const config = await loadConfig(thisCommand.opts().config);
        actionCommand.setOptionValue('_config', config);
    });

// Commands inherit global options
program
    .command('current')
    .description('Show current task')
    .option('--number', 'show number only')
    .action(async (options) => {
        const config = options._config;
        const result = await getCurrentTask(config);
        
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        } else if (options.number) {
            console.log(result.taskNumber);
        } else {
            displayTask(result);
        }
    });
```

### 3. Error Handling Pattern
```typescript
export class TodoqError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: any
    ) {
        super(message);
        this.name = 'TodoqError';
    }
}

export function handleError(error: unknown): void {
    if (error instanceof TodoqError) {
        console.error(chalk.red(`Error (${error.code}): ${error.message}`));
        if (error.details && process.env.DEBUG) {
            console.error('Details:', error.details);
        }
        process.exit(1);
    } else if (error instanceof Error) {
        console.error(chalk.red('Unexpected error:', error.message));
        process.exit(1);
    } else {
        console.error(chalk.red('Unknown error occurred'));
        process.exit(1);
    }
}
```

### 4. Bulk Operations with Transactions
```typescript
export class TaskService {
    bulkInsert(tasks: TaskInput[]): BulkInsertResult {
        const result: BulkInsertResult = {
            success: false,
            inserted: [],
            skipped: [],
            errors: [],
            summary: { total: tasks.length, successful: 0, skipped: 0, failed: 0 }
        };

        try {
            this.db.transaction(() => {
                for (const task of tasks) {
                    try {
                        // Validate task
                        const validation = TaskInputSchema.safeParse(task);
                        if (!validation.success) {
                            result.errors.push({ task, error: validation.error.message });
                            result.summary.failed++;
                            continue;
                        }

                        // Check for duplicates
                        const existing = this.findByNumber(task.number);
                        if (existing) {
                            result.skipped.push({ task, reason: 'Already exists' });
                            result.summary.skipped++;
                            continue;
                        }

                        // Insert task
                        const inserted = this.insert(task);
                        result.inserted.push(inserted);
                        result.summary.successful++;
                    } catch (error) {
                        result.errors.push({ task, error: String(error) });
                        result.summary.failed++;
                    }
                }
            })();

            result.success = result.summary.failed === 0;
        } catch (error) {
            throw new TodoqError('Bulk insert failed', 'BULK_INSERT_ERROR', { error });
        }

        return result;
    }
}
```

### 5. Configuration Loading (from tfq)
```typescript
import { cosmiconfigSync } from 'cosmiconfig';

export async function loadConfig(configPath?: string): Promise<TodoqConfig> {
    const explorer = cosmiconfigSync('todoq', {
        searchPlaces: [
            'package.json',
            '.todoqrc',
            '.todoqrc.json',
            '.todoqrc.js',
            'todoq.config.js',
            'todoq.config.json'
        ]
    });

    const result = configPath 
        ? explorer.load(configPath)
        : explorer.search();

    const config = result?.config || getDefaultConfig();
    
    // Validate config
    const validation = TodoqConfigSchema.safeParse(config);
    if (!validation.success) {
        throw new TodoqError('Invalid configuration', 'CONFIG_ERROR', validation.error);
    }

    return validation.data;
}
```

### 6. Git Integration for File Tracking
```typescript
import { execSync } from 'child_process';

export class GitFileTracker {
    private taskStartStates = new Map<string, string>();

    // Capture git state when task starts
    onTaskStart(taskNumber: string): void {
        try {
            const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
            const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            this.taskStartStates.set(taskNumber, currentCommit);
        } catch (error) {
            // Not in a git repo, skip tracking
        }
    }

    // Detect changed files when task completes
    onTaskComplete(taskNumber: string): string[] {
        try {
            const startCommit = this.taskStartStates.get(taskNumber);
            if (!startCommit) return [];

            // Get all files changed since task started
            const gitDiff = execSync(
                `git diff --name-only ${startCommit} HEAD`,
                { encoding: 'utf8' }
            );
            const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });

            // Parse and combine results
            const changedFiles = new Set<string>();
            gitDiff.split('\n').filter(Boolean).forEach(file => changedFiles.add(file));
            gitStatus.split('\n').forEach(line => {
                const file = line.substring(3).trim();
                if (file) changedFiles.add(file);
            });

            return Array.from(changedFiles);
        } catch (error) {
            return [];
        }
    }
}

// Integration in complete command
export async function completeTask(taskNumber: string, notes?: string) {
    const tracker = new GitFileTracker();
    const files = tracker.onTaskComplete(taskNumber);
    
    await db.update(
        'UPDATE tasks SET status = ?, completion_notes = ?, files = ? WHERE task_number = ?',
        ['completed', notes || null, JSON.stringify(files), taskNumber]
    );
}
```

### 7. Parent-Child Completion Logic
```typescript
export class TaskCompletionService {
    // Calculate parent task completion percentage
    calculateParentCompletion(parentId: number): number {
        const children = db.prepare(
            'SELECT status FROM tasks WHERE parent_id = ?'
        ).all(parentId);

        if (children.length === 0) return 0;

        const completed = children.filter(c => c.status === 'completed').length;
        return Math.round((completed / children.length) * 100);
    }

    // Update all parent completion percentages
    updateCompletionTree(taskNumber: string): void {
        const task = db.prepare(
            'SELECT id, parent_id FROM tasks WHERE task_number = ?'
        ).get(taskNumber);

        if (!task) return;

        // Traverse up the tree updating percentages
        let currentParentId = task.parent_id;
        while (currentParentId) {
            const percentage = this.calculateParentCompletion(currentParentId);
            
            db.prepare(
                'UPDATE tasks SET completion_percentage = ? WHERE id = ?'
            ).run(percentage, currentParentId);

            // Get next parent
            const parent = db.prepare(
                'SELECT parent_id FROM tasks WHERE id = ?'
            ).get(currentParentId);
            
            currentParentId = parent?.parent_id;
        }
    }

    // Display tree with completion percentages
    displayProgressTree(): void {
        const tasks = db.prepare(
            'SELECT * FROM tasks ORDER BY task_number'
        ).all();

        tasks.forEach(task => {
            const indent = '  '.repeat(task.task_number.split('.').length - 1);
            const progress = task.completion_percentage 
                ? ` [${task.completion_percentage}%]` 
                : task.status === 'completed' ? ' ✓' : '';
            
            console.log(`${indent}${task.task_number} ${task.name}${progress}`);
        });
    }
}
```

### 8. Strict Validation Requirements
```typescript
export class TaskValidator {
    private errors: Array<{task: string; field: string; error: string}> = [];

    validateImport(tasks: TaskInput[]): ValidationResult {
        this.errors = [];
        const taskNumbers = new Set<string>();
        const taskMap = new Map<string, TaskInput>();

        // First pass: collect all tasks and check for duplicates
        for (const task of tasks) {
            // Validate against schema
            const validation = TaskInputSchema.safeParse(task);
            if (!validation.success) {
                validation.error.issues.forEach(issue => {
                    this.errors.push({
                        task: task.number,
                        field: issue.path.join('.'),
                        error: issue.message
                    });
                });
                continue;
            }

            // Check for duplicate task numbers
            if (taskNumbers.has(task.number)) {
                this.errors.push({
                    task: task.number,
                    field: 'number',
                    error: 'Duplicate task number'
                });
                continue;
            }

            taskNumbers.add(task.number);
            taskMap.set(task.number, task);
        }

        // Second pass: validate hierarchical relationships
        for (const task of taskMap.values()) {
            // Validate parent exists
            if (task.parent && !taskMap.has(task.parent)) {
                // Check if parent exists in database
                const dbParent = db.prepare(
                    'SELECT id FROM tasks WHERE task_number = ?'
                ).get(task.parent);

                if (!dbParent) {
                    this.errors.push({
                        task: task.number,
                        field: 'parent',
                        error: `Parent task ${task.parent} not found`
                    });
                }
            }

            // Validate dependencies exist
            if (task.dependencies) {
                for (const dep of task.dependencies) {
                    if (!taskMap.has(dep) && !this.taskExistsInDb(dep)) {
                        this.errors.push({
                            task: task.number,
                            field: 'dependencies',
                            error: `Dependency ${dep} not found`
                        });
                    }
                }
            }

            // Validate task number format matches parent hierarchy
            if (task.parent) {
                const expectedPrefix = task.parent + '.';
                if (!task.number.startsWith(expectedPrefix)) {
                    this.errors.push({
                        task: task.number,
                        field: 'number',
                        error: `Task number should start with ${expectedPrefix}`
                    });
                }
            }
        }

        // Check for circular dependencies
        this.validateNoCycles(taskMap);

        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            summary: {
                total: tasks.length,
                valid: tasks.length - this.errors.length,
                invalid: this.errors.length
            }
        };
    }

    private validateNoCycles(taskMap: Map<string, TaskInput>): void {
        // Implement cycle detection algorithm
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (taskNumber: string): boolean => {
            visited.add(taskNumber);
            recursionStack.add(taskNumber);

            const task = taskMap.get(taskNumber);
            if (task?.dependencies) {
                for (const dep of task.dependencies) {
                    if (!visited.has(dep)) {
                        if (hasCycle(dep)) return true;
                    } else if (recursionStack.has(dep)) {
                        this.errors.push({
                            task: taskNumber,
                            field: 'dependencies',
                            error: `Circular dependency detected with ${dep}`
                        });
                        return true;
                    }
                }
            }

            recursionStack.delete(taskNumber);
            return false;
        };

        for (const taskNumber of taskMap.keys()) {
            if (!visited.has(taskNumber)) {
                hasCycle(taskNumber);
            }
        }
    }

    private taskExistsInDb(taskNumber: string): boolean {
        const result = db.prepare(
            'SELECT id FROM tasks WHERE task_number = ?'
        ).get(taskNumber);
        return !!result;
    }
}
```

## Testing Strategy (from tfq)

### Test Structure
```
src/
├── core/__tests__/
│   ├── task.test.ts           # Unit tests for task logic
│   ├── navigation.test.ts     # Navigation algorithm tests
│   └── validation.test.ts     # Validation tests
├── adapters/__tests__/
│   ├── database.test.ts       # Database integration tests
│   └── json.test.ts          # JSON import/export tests
└── cli/__tests__/
    ├── commands.test.ts       # CLI command tests
    └── fixtures/              # Test data
        ├── tasks.json
        └── invalid-tasks.json
```

### Example Test
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from '../core/task';
import { DatabaseClient } from '../adapters/database/client';

describe('TaskService', () => {
    let service: TaskService;
    let db: DatabaseClient;

    beforeEach(() => {
        db = new DatabaseClient(':memory:');
        service = new TaskService(db);
    });

    describe('bulkInsert', () => {
        it('should insert valid tasks', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1' },
                { number: '1.1', name: 'Task 1.1', parent: '1.0' }
            ];

            const result = service.bulkInsert(tasks);

            expect(result.success).toBe(true);
            expect(result.inserted).toHaveLength(2);
            expect(result.summary.successful).toBe(2);
        });

        it('should skip duplicates', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1' },
                { number: '1.0', name: 'Duplicate' }
            ];

            const result = service.bulkInsert(tasks);

            expect(result.inserted).toHaveLength(1);
            expect(result.skipped).toHaveLength(1);
            expect(result.skipped[0].reason).toBe('Already exists');
        });
    });
});
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Project setup with Commander.js framework
- SQLite database with WAL mode and migrations
- Type definitions and core domain logic
- Basic CLI commands (init, config, current, next, prev)
- Configuration system with cosmiconfig

### Phase 2: Task Management
- CRUD operations (insert, remove, update, show)
- Status management commands
- Task navigation logic with hierarchy support
- Transaction-based operations

### Phase 3: JSON Integration & Bulk Operations
- JSON schema with Zod validation
- Bulk insertion with detailed result reporting
- Template generation and validation
- Error handling and recovery

### Phase 4: Advanced Features
- List operations with filtering and tree view
- Statistics and progress tracking
- Export capabilities (JSON, markdown)
- Interactive mode for complex operations

### Phase 5: Testing & Polish
- Comprehensive test suite
- Performance optimizations
- Documentation
- Build and packaging configuration

## Key Technical Improvements from tfq

1. **Commander.js Benefits**: Simpler setup, better option inheritance, cleaner command registration
2. **WAL Mode**: Better concurrency for database operations
3. **Transaction Patterns**: Atomic bulk operations with rollback
4. **Type Safety**: Explicit typing for all database operations and results
5. **Error Context**: Rich error objects with debugging information
6. **Config Flexibility**: Multiple config sources with validation
7. **Testing Approach**: Separate unit/integration/CLI tests
8. **Interactive Mode**: Smart initialization and template generation

## Success Criteria

- [ ] Parse and import existing task structures with validation
- [ ] All CLI commands working with JSON output support
- [ ] Complex hierarchical numbering with automatic re-numbering
- [ ] Bulk JSON insertion with comprehensive error reporting
- [ ] Transaction-based operations ensuring data integrity
- [ ] Performance: Handle 1000+ tasks efficiently
- [ ] 80%+ test coverage across all modules
- [ ] Single executable distribution