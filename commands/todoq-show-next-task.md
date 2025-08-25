# Rule: Show Next TodoQ Task

## Context

- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)

## Description

Display the next task from TodoQ database for user review without taking any implementation action. Note: todoq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/show-next-todoq-task $PROJECT_DIR
```

## Implementation

1. **Change Directory**: Navigate to $PROJECT_DIR (or repository root if not specified)

2. **Task Discovery**
   - Run `todoq remaining --count`, if the count is 0 return 'no more tasks remaining'
   - Run `todoq current --number` to get the next uncompleted task number
   - Return this task number to the user
   - If the return value is not a number, return exactly: 'no more tasks'

3. **No Implementation**
   - This command is read-only - do not start working on the task
   - Do not create todos or begin implementation
   - Simply return the task number
