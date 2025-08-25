# Rule: Transform Old Tasks to TodoQ Format

## Context

- old task file path: "$OLD_TASK_FILE" (required - path to markdown file in old-tasks/ directory)
- output name: "$OUTPUT_NAME" (optional - defaults to "transformed-tasks" if not specified)
- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)
- todoq database directory: "$TODOQ_DIR" (determined from `.todoqrc` configuration)

## Description

Transform legacy markdown-based task lists into proper TodoQ JSON format and import them into the TodoQ database. Preserves hierarchical structure, completion status, metadata, and task relationships while converting to TodoQ schema.

## Usage
```
/transform-old-tasks $OLD_TASK_FILE [$OUTPUT_NAME] [$PROJECT_DIR]
```

## Examples
```
/transform-old-tasks old-tasks/old-tasks-1.md
/transform-old-tasks old-tasks/old-tasks-2.md ai-platform-tasks
/transform-old-tasks old-tasks/old-tasks-3.md marketing-content /path/to/project
```

## Implementation

1. **Change Directory**: Navigate to $PROJECT_DIR (or repository root if not specified)
2. **Parse Markdown Tasks**: Read $OLD_TASK_FILE and extract hierarchical task structure
3. **Transform Structure**: Convert markdown format to TodoQ JSON schema with proper mappings
4. **Generate Task Numbers**: Create hierarchical numbering (1.0, 1.1, 1.2.1, etc.)
5. **Map Metadata**: Extract docs references, testing strategies, files, and status notes
6. **Save JSON File**: Write transformed tasks to `$TODOQ_DIR/$OUTPUT_NAME-tasks.json`
7. **Validate Schema**: Run `todoq bulk-validate $TODOQ_DIR/$OUTPUT_NAME-tasks.json`
8. **Fix Issues**: If validation fails, recursively fix JSON schema errors and re-validate
9. **Import Tasks**: Run `todoq import $TODOQ_DIR/$OUTPUT_NAME-tasks.json`
10. **Verify Import**: Run `todoq list --tree` to display task hierarchy
11. **Start Workflow**: Run `todoq current` to show next task

## Transformation Rules

### Task Structure Mapping
- **Markdown bullets** (`-`, `*`) → **TodoQ hierarchy** (1.0, 1.1, 1.2.1)
- **Indentation levels** → **Parent-child relationships** via task numbers
- **Status indicators** `[x]` → `"completed"`, `[ ]` → `"pending"`
- **Task names** extracted from first line after status indicator

### Metadata Extraction
- **Documentation links**: `*Docs: [link](url)*` → `docs_references` array
- **Testing info**: `*Testing: strategy*` → `testing_strategy` field  
- **Status notes**: `*STATUS: info*` → `notes` field
- **File references**: Parse file paths from descriptions → `files` array
- **Dependencies**: Extract task number references → `dependencies` array

### Content Processing
- **Descriptions**: Multi-line content after task name
- **Code blocks**: Preserve formatting in descriptions
- **Links and URLs**: Extract and categorize appropriately
- **Priority**: Infer from task level (1.0 = priority 1, 1.1 = priority 2, etc.)

## Output Format

Generated JSON follows TodoQ schema:

```json
{
  "tasks": [
    {
      "number": "1.0",
      "name": "Task Name from Markdown",
      "description": "Multi-line description with implementation details",
      "parent": null,
      "status": "completed|pending|in_progress|cancelled", 
      "priority": 1,
      "dependencies": ["2.1", "3.0"],
      "files": ["src/file.ts", "docs/readme.md"],
      "docs_references": ["https://docs.example.com"],
      "testing_strategy": "Unit and integration testing approach",
      "notes": "Status updates and additional context"
    }
  ]
}
```

## Error Handling

- **Invalid markdown structure**: Report parsing errors with line numbers
- **Missing task names**: Skip malformed entries with warnings
- **Circular dependencies**: Detect and resolve during number generation
- **Schema validation failures**: Fix common issues automatically, report complex problems
- **Import conflicts**: Handle duplicate task numbers gracefully

## Validation Steps

1. **Parse validation**: Ensure markdown structure is parseable
2. **Schema validation**: Verify all required TodoQ fields are present
3. **Dependency validation**: Check that all referenced task numbers exist
4. **Hierarchy validation**: Ensure parent-child relationships are valid
5. **TodoQ validation**: Use `todoq bulk-validate` for final schema check

## Relevant TodoQ Commands

- `todoq bulk-validate $TODOQ_DIR/$OUTPUT_NAME-tasks.json` - Validate JSON schema
- `todoq import $TODOQ_DIR/$OUTPUT_NAME-tasks.json` - Import validated tasks
- `todoq list --tree` - Display hierarchical task view
- `todoq current` - Show next task to work on
- `todoq stats` - Show transformation summary statistics