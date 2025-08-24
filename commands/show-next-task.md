# Rule: Show Next Task

## Context

- Task number to show: "$TASK" (optional)
- Tasks directory: "$TASKS_DIR" (defaults to /tasks if not specified)

## Goal
Display the next task from the task list for user review without taking any implementation action.

**IMPORTANT: You MUST follow the exact output format specified below. Do not deviate from this format.**

## Usage
```
/show-next-task [optional-task-number] [optional-tasks-directory]
```

## Examples
```
/show-next-task                           # Next task from /tasks
/show-next-task 5                         # Task 5 from /tasks  
/show-next-task "" ./my-tasks             # Next task from ./my-tasks
```

## Process

**CRITICAL INSTRUCTION: Your response MUST start with "## Next Task: [number] - [title]" format. This is essential for automated parsing.**

1. **Task Discovery**
   - If $TASK provided: Find and display the specified task in `$TASKS_DIR` (defaults to `/tasks`)
   - Else: Find and display the next task number in `$TASKS_DIR` (defaults to `/tasks`)
   - If no task file found or invalid argument, return clear error message with available options

2. **Task Display**
   - Extract the next uncompleted task from the task list
   - **CRITICAL: Always use the exact output format specified below**
   - Parse the markdown file to extract:
     - Task number (from "## Task N:" or similar patterns)
     - Task title 
     - Task description/requirements
     - Identify files that will be modified
   - Return in the standardized format with task number clearly visible

3. **Context Information**
   - Display relevant files that would be involved
   - Show any prerequisites or dependencies
   - Provide documentation references for the task

4. **No Implementation**
   - This command is read-only - do not start working on the task
   - Do not create todos or begin implementation
   - Simply present the task information for user review

## Output Format
Always return this exact format for consistency:

```
## Next Task: [Task Number] - [Title]

**Description:** [Task details]

**Files Involved:**
- [List of relevant files]

**Status:** pending

**Dependencies:** [Any prerequisite tasks (if any)]
```

Example:
```
## Next Task: 1 - Add multiply function

**Description:** 
- Add multiply(a, b) function to calculator.js
- Function should return a * b
- Add JSDoc documentation for the function

**Files Involved:**
- src/calculator.js

**Status:** pending

**Dependencies:** None
```

## Error Handling
- If no uncompleted tasks found: "All tasks completed!"
- If task file not found: "No task file found. Available locations: tasks/, .claude/tasks/, .taskmaster/tasks/"
- If invalid task number: "Task [number] not found. Available tasks: [list]"