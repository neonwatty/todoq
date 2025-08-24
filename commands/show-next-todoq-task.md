# Rule: Show Next TodoQ Task

## Context

- task number: "$TASK" (optional)
- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)

## Description

Display the next task from TodoQ database for user review without taking any implementation action.

**IMPORTANT: You MUST follow the exact output format specified below. Do not deviate from this format.**

## Usage
```
/show-next-todoq-task $TASK $PROJECT_DIR
```

## Examples
```
/show-next-todoq-task                     # Next task from current directory
/show-next-todoq-task 1.2                # Task 1.2 from current directory  
/show-next-todoq-task "" ./project       # Next task from ./project directory
```

## Implementation

**CRITICAL INSTRUCTION: Your response MUST start with "## Next Task: [number] - [title]" format. This is essential for automated parsing.**

1. **Change Directory**: Navigate to $PROJECT_DIR (or repository root if not specified)

2. **Task Discovery**
   - If $TASK provided: Run `todoq show $TASK` to display specified task
   - Else: Run `todoq current` to find next uncompleted task
   - If no task found, return clear error message

3. **Task Display**
   - Extract task information from TodoQ output
   - **CRITICAL: Always use the exact output format specified below**
   - Parse TodoQ data to extract:
     - Task number (hierarchical like 1.0, 1.1, 1.2.1)
     - Task name
     - Task description
     - Files array
     - Dependencies
     - Testing strategy

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
- [List of files from TodoQ files array]

**Status:** [pending/in_progress/completed/cancelled]

**Dependencies:** [Task numbers from dependencies array or "None"]

**Testing Strategy:** [From TodoQ testing_strategy field]

**Documentation:** [URLs from docs_references array or "None"]
```

## Relevant TodoQ Commands

- `todoq current` - Show next task to work on
- `todoq show $TASK` - Display specific task details
- `todoq list --tree` - Show all tasks in hierarchy
- `todoq stats` - Show overall progress

## Error Handling

- If no uncompleted tasks found: "All tasks completed!"
- If task not found: "Task [number] not found. Use `todoq list` to see available tasks."
- If TodoQ not initialized: "TodoQ not initialized. Run `todoq init` first."