# Rule: Work Next Task

## Context

- Task number to work on: "$TASK" (optional)
- Tasks directory: "$TASKS_DIR" (defaults to /tasks if not specified)  
- Project directory: "$PROJECT_DIR" (optional, defaults to current directory for TFQ operations)

## Goal
Help developers work on tasks with auto-fetched documentation context and implementation guidance.

## Usage
```
/next-task [optional-task-number] [optional-tasks-directory] [optional-project-directory]
```

## Examples
```
/next-task                           # Next task from /tasks, TFQ in current dir
/next-task 5                         # Task 5 from /tasks, TFQ in current dir
/next-task "" ./my-tasks             # Next task from ./my-tasks, TFQ in current dir
/next-task 3 ./my-tasks ./project    # Task 3 from ./my-tasks, TFQ in ./project
```

## Process

1. **Task Discovery & Validation**
   - If $TASK provided: Validate argument format and find specified task in `$TASKS_DIR` (defaults to `/tasks`)
   - Else: Find and work on the next task number in `$TASKS_DIR` (defaults to `/tasks`)
   - If no task file found or invalid argument, return clear error message with available options

2. **TodoWrite Initialization (Single-Threaded Execution)**
   - Create initial TodoWrite with task discovery, context extraction, implementation steps
   - Mark ONLY the first todo as `in_progress` (enforce one active task at a time)
   - Include error handling todos for potential failure points

3. **Context & Implementation**
   - Extract task context and documentation references
   - Use WebSearch to fetch relevant documentation context
   - Mark current todo as `completed`, update next todo to `in_progress`
   - Carefully expand the task into implementation steps and update TodoWrite list
   - Complete each step individually, updating TodoWrite status immediately

4. **Testing & Validation Pipeline**
   - Determine proper unit and integration tests for implemented task
   - Run project-specific testing commands (check CLAUDE.md for test commands)
   - Run linting/typecheck validation if available
   - Handle test failures by creating recovery todos, keep original task `in_progress`

5. **Quality Assurance**
   - Spawn validation agent via Task tool to independently review
   - If validation fails: Create specific fix todos, maintain task as `in_progress`
   - If validation succeeds: Mark all todos `completed`, mark task complete in task file

6. **Automated Test Fixing**
   - If `$PROJECT_DIR` is provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This runs comprehensive test fixing for the target project directory after implementation
   - Update TodoWrite status based on test fixing results

7. **Second Round Test Fixing**
   - If `$PROJECT_DIR` is provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This ensures any remaining test failures are addressed in the project directory
   - Update TodoWrite status based on test fixing results

8. **Third Round Test Fixing**
   - If `$PROJECT_DIR` is provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This ensures any remaining test failures are addressed in the project directory
   - Update TodoWrite status based on test fixing results

9. **Error Recovery**
   - On any failure: Preserve current state, create specific recovery todos
   - Never mark task complete unless all validation passes
   - Provide clear next steps for manual intervention if needed
