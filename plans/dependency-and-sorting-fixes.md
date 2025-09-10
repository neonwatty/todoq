# TodoQ: Task Ordering and Dependency Checking Implementation Plan

## Overview
This plan addresses two critical issues in TodoQ:
1. **Task Ordering Bug**: Tasks are sorted alphabetically instead of numerically (10.0 appears before 2.0)
2. **Missing Dependency Checking**: `todoq work-next` and `todoq current` don't check if task dependencies are met

## Part 1: Fix Task Number Sorting

### Problem
- Task numbers are stored as TEXT in the database
- `ORDER BY task_number` sorts alphabetically: "10.0" < "2.0" < "3.0"
- This affects ALL commands: list, current, next, work-next, etc.

### Solution: Add Numerical Columns for Sorting

#### 1.1 Database Schema Migration
```sql
-- Create new migration to add numerical sorting columns
ALTER TABLE tasks ADD COLUMN task_number INTEGER;
ALTER TABLE tasks ADD COLUMN subtask_number INTEGER;

-- Populate from existing task_number "10.2"
UPDATE tasks SET 
  task_number = CAST(SUBSTR(task_number, 1, INSTR(task_number, '.') - 1) AS INTEGER),
  subtask_number = CAST(SUBSTR(task_number, INSTR(task_number, '.') + 1) AS INTEGER);

-- Create indexes for performance
CREATE INDEX idx_task_ordering ON tasks(task_number, subtask_number);
```

**Note**: Keep the original `task_number` TEXT column for display and lookups.

#### 1.2 Update Task Creation/Import
When inserting or importing tasks, parse the task number to populate numerical columns:
```typescript
// In TaskService.create() and bulkInsert()
const [taskNum, subtaskNum] = input.number.split('.').map(n => parseInt(n));
// Add task_number and subtask_number to INSERT statement
```

#### 1.3 Update All ORDER BY Clauses
Replace throughout the codebase:
```sql
-- Old (broken)
ORDER BY task_number

-- New (correct)
ORDER BY task_number, subtask_number
```

Files to update:
- `src/core/navigation.ts` - getCurrentTask, getNextTask, etc.
- `src/core/task.ts` - list method
- `src/core/completion.ts` - getProgressTree

## Part 2: Add Dependency Checking

### Problem
- `getCurrentTask()` returns the first incomplete task without checking dependencies
- `todoq work-next` can select tasks whose dependencies aren't complete
- This causes failures when Claude attempts to work on blocked tasks

### Solution: Make Navigation Dependency-Aware

#### 2.1 Update NavigationService Core Methods

**getCurrentTask()** - Only return tasks with met dependencies:
```typescript
// src/core/navigation.ts
getCurrentTask(): Task | null {
    const stmt = this.db.prepare(`
        SELECT t.* FROM tasks t
        WHERE t.status IN ('pending', 'in_progress')
        AND NOT EXISTS (
            SELECT 1 FROM task_dependencies td
            JOIN tasks dep ON td.depends_on_id = dep.id
            WHERE td.task_id = t.id 
            AND dep.status != 'completed'
        )
        ORDER BY t.task_number, t.subtask_number
        LIMIT 1
    `);
    // ...
}
```

**getNextTask()** - Same dependency checking logic

#### 2.2 Add New Navigation Methods

```typescript
// Get all tasks blocked by dependencies
getBlockedTasks(): Task[] {
    const stmt = this.db.prepare(`
        SELECT DISTINCT t.* FROM tasks t
        WHERE t.status IN ('pending', 'in_progress')
        AND EXISTS (
            SELECT 1 FROM task_dependencies td
            JOIN tasks dep ON td.depends_on_id = dep.id
            WHERE td.task_id = t.id 
            AND dep.status != 'completed'
        )
        ORDER BY t.task_number, t.subtask_number
    `);
    // ...
}

// Check if a specific task can be started
canStartTask(taskNumber: string): { canStart: boolean; blockers: string[] } {
    // Similar to canCompleteTask but for starting work
}
```

## Part 3: Update CLI Commands

### 3.1 Fix `todoq current` Command
- Always use dependency-aware task selection (no optional flag needed)
- When no available task due to dependencies, show why:
```
❌ No tasks available. 3 tasks are blocked by dependencies:
  🔒 2.0 Main Task - blocked by: 1.0 Setup Task (pending)
  🔒 3.0 Final Task - blocked by: 2.0 Main Task (pending)
```

### 3.2 Fix `todoq work-next` Command
- Update `executeTodoqGetNext()` to use dependency-aware navigation
- Prevents Claude from attempting blocked tasks

### 3.3 Add New Dependency Commands

```bash
# Show task dependencies and their status
todoq deps 2.0
> Dependencies for 2.0 Main Task:
>   ✅ 1.0 Setup Task (completed)
>   ❌ 1.1 Config Task (pending)

# List all blocked tasks
todoq blocked
> Blocked tasks:
>   🔒 2.0 Main Task - waiting on: 1.1 Config Task
>   🔒 3.0 Final Task - waiting on: 2.0 Main Task

# List ready tasks (no blockers)
todoq ready
> Ready to work on:
>   ✅ 1.1 Config Task
>   ✅ 4.0 Independent Task
```

## Part 4: Update Display and Formatters

### 4.1 Update formatTask()
```typescript
// src/cli/formatters.ts
// Add dependency status to task display
if (task.dependencies && task.dependencies.length > 0) {
    const depStatus = getTaskDependencyStatus(task);
    if (depStatus.blocked) {
        lines.push(`  🔒 Blocked by: ${depStatus.blockers.join(', ')}`);
    } else {
        lines.push(`  ✅ Dependencies met`);
    }
}
```

### 4.2 Update List Display
- Add visual indicators for blocked tasks
- Show 🔒 next to blocked tasks in tree/list views

## Part 5: Testing Requirements

### 5.1 Sorting Tests
- Test ordering: 1.0, 2.0, ..., 9.0, 10.0, 11.0 (not 1.0, 10.0, 11.0, 2.0)
- Test subtask ordering: 1.1, 1.2, ..., 1.9, 1.10, 1.11

### 5.2 Dependency Tests
- Test getCurrentTask() skips blocked tasks
- Test work-next only selects ready tasks
- Test circular dependency detection still works
- Test completion still checks dependencies

### 5.3 Integration Tests
- Create tasks with dependencies via import
- Verify work-next respects dependency order
- Test blocked task reporting

## Implementation Order

1. **Fix Sorting (Critical)**
   - Add migration for numerical columns
   - Update all ORDER BY clauses
   - Test with tasks 1.0 through 20.0

2. **Add Dependency Checking**
   - Update getCurrentTask() and getNextTask()
   - Add getBlockedTasks() method
   - Update work-next command

3. **Enhance CLI Commands**
   - Update current command output
   - Add deps, blocked, ready commands
   - Update formatters

4. **Testing & Documentation**
   - Add comprehensive tests
   - Update README with dependency features
   - Document new commands

## Files to Modify

### Core Changes
- `src/adapters/database/migrations.ts` - Add new migration
- `src/core/navigation.ts` - Update navigation methods
- `src/core/task.ts` - Update create/insert for numerical columns
- `src/services/claude/claude-service.ts` - Use dependency-aware navigation

### CLI Changes
- `src/cli/commands/navigation.ts` - Update current command
- `src/cli/commands/task.ts` - Add new dependency commands
- `src/cli/formatters.ts` - Add dependency indicators

### Test Updates
- `tests/unit/core/navigation.test.ts` - Test dependency-aware navigation
- `tests/integration/cli/commands.test.ts` - Test new commands
- Add new test files for sorting and dependencies

## Success Criteria

1. ✅ Tasks sort correctly: 1.0, 2.0, 3.0, ..., 10.0, 11.0, 12.0
2. ✅ `todoq current` only shows tasks with met dependencies
3. ✅ `todoq work-next` never attempts blocked tasks
4. ✅ Clear feedback when tasks are blocked
5. ✅ New commands to inspect dependencies
6. ✅ All existing tests pass
7. ✅ New tests for dependency checking

## Notes

- No backward compatibility needed per user requirement
- Keep original task_number TEXT column for display/lookup
- Dependency checking becomes mandatory, not optional
- This fixes both the immediate work-next issue and the broader sorting problem