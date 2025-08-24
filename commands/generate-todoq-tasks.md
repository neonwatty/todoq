# Rule: Generate TodoQ Tasks from PRD

## Context

- prd file path: "$PRD_PATH" (required)
- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)
- todoq database directory: "$TODOQ_DIR" (determined from `.todoqrc` configuration)

## Description

Generate hierarchical TodoQ tasks from a PRD and import them into the TodoQ database.  Note: todoq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/generate-todoq-tasks $PRD_PATH $PROJECT_DIR
```

## Implementation

1. **Change Directory**: Navigate to $PROJECT_DIR (or repository root if not specified)
2. **Analyze PRD**: Read $PRD_PATH, extract requirements and user stories
3. **Generate Tasks**: Create hierarchical parent/sub-tasks with TodoQ JSON schema
4. **Research Context**: Use WebSearch for documentation and testing strategies
5. **Save JSON File**: Write generated tasks to `$TODOQ_DIR/prd-tasks.json`
6. **Validate Schema**: Run `todoq bulk-validate $TODOQ_DIR/prd-tasks.json`
7. **Fix Issues**: If validation fails, recursively fix JSON schema errors and re-validate
8. **Import Tasks**: Run `todoq import $TODOQ_DIR/prd-tasks.json`
9. **Verify Import**: Run `todoq list --tree` to display task hierarchy
10. **Start Workflow**: Run `todoq current` to show next task

## TodoQ JSON Schema

Use this exact format for task generation:

```json
{
  "tasks": [
    {
      "number": "1.0",
      "name": "Task Name",
      "description": "Implementation details",
      "parent": null,
      "status": "pending",
      "priority": 1,
      "dependencies": [],
      "files": ["path/to/file.ts"],
      "docs_references": ["https://docs.url"],
      "testing_strategy": "Unit and integration approach",
      "notes": "Additional context"
    }
  ]
}
```

## Relevant TodoQ Commands

- `todoq bulk-validate $TODOQ_DIR/prd-tasks.json` - Validate JSON schema without importing
- `todoq init` - Initialize database if todoq.db missing
- `todoq import $TODOQ_DIR/prd-tasks.json` - Import validated tasks into database
- `todoq list --tree` - Display hierarchical task view
- `todoq current` - Show next task to work on