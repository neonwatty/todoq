# Command: Work Next TodoQ Task

## Context

- Project directory: "$PROJECT_DIR" (optional, defaults to current directory for TFQ operations)

## Goal
Help developers work on tasks with auto-fetched documentation context and implementation guidance.  Note: todoq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/work-next-todoq-task $PROJECT_DIR
```

## Process

1. **Change Directory**: Navigate to $PROJECT_DIR (or repository root if not specified)

2. **Task Discovery**
   - Run `todoq current --json` to get the next uncompleted task in json form
   - If the return value is not a number, return exactly: 'no more tasks'
   - Run `todoq current --start` to mark the task as `in_progress`

3. **TodoWrite Initialization (Single-Threaded Execution)**
   - Create initial TodoWrite with task discovery, context extraction, implementation steps
   - Mark ONLY the first todo as `in_progress` (enforce one active task at a time)
   - Include error handling todos for potential failure points

3. **Context extraction**
   - Extract the elements of the return task json
   - If documentation references are provided, use WebSearch to fetch relevant documentation context with respect to the task description and testing strategies

4. **Implementation**
   - Carefully expand the task into implementation steps and update TodoWrite list
   - Complete each step individually, updating TodoWrite status immediately

5. **Testing & Validation Pipeline**
   - Determine proper unit and integration tests for implemented task
   - Run project-specific testing commands (check CLAUDE.md for test commands)
   - Run linting/typecheck validation if available
   - Handle test failures by creating recovery todos, keep as task `in_progress`

6. **Quality Assurance**
   - Spawn validation agent via Task tool to independently review
   - If validation fails: Create specific fix todos, maintain task as `in_progress`

7. **Automated Test Fixing**
   - Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This runs comprehensive test fixing for the target project directory after implementation
   - Update TodoWrite status based on test fixing results

8. **Second Round Test Fixing**
   - If `$PROJECT_DIR` is provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This ensures any remaining test failures are addressed in the project directory
   - Update TodoWrite status based on test fixing results

9. **Third Round Test Fixing**
   - If `$PROJECT_DIR` is provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
   - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
   - This ensures any remaining test failures are addressed in the project directory
   - Update TodoWrite status based on test fixing results

10. **Complete or Error Recovery**
   - If the previous steps succeed: Mark all todos `completed`, mark todoq task complete as `todoq current --complete --force`
   - On any failure: Preserve current state, create specific recovery todos
   - Never mark task complete unless all validation passes
   - Provide clear next steps for manual intervention if needed


