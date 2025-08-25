# Command: Generate TodoQ Tasks from PRD

## Context

- prd file path: "$PRD_PATH" (required)
- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)
- todoq database directory: "$TODOQ_DIR" (determined from `.todoqrc` configuration)

## Goal

Generate hierarchical TodoQ tasks from a PRD using intelligent analysis and import them into the TodoQ database with validation and safety checks. Note: todoq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/generate-todoq-tasks $PRD_PATH $PROJECT_DIR
```

## Process

1. **Change Directory**: Use Bash tool to run `cd "$PROJECT_DIR"` (or repository root if not specified)

2. **Initialization Check**: 
   - Use Bash tool to run `test -f .todoq/todoq.db` to verify todoq is initialized
   - If fails, return error message instructing user to run `todoq init` in the project directory

3. **Backup Existing Tasks**:
   - Use Bash tool to run `todoq export --pretty > $TODOQ_DIR/backup-$(date +%Y%m%d-%H%M%S).json`
   - Create backup before any modifications to prevent data loss

4. **Intelligent PRD Analysis**:
   - Use Task tool with general-purpose agent to read $PRD_PATH and perform deep analysis
   - Agent should extract: functional requirements, non-functional requirements, user stories, acceptance criteria, business rules, implicit requirements
   - Agent should classify and prioritize requirements by business value and technical complexity

5. **Context Research**:
   - Use Task tool with general-purpose agent to research relevant documentation, codebase patterns, and testing strategies
   - Agent should gather context for implementation approaches that align with existing codebase patterns

6. **Intelligent Task Generation**:
   - Use Task tool with general-purpose agent to create hierarchical parent/sub-tasks using TodoQ JSON schema
   - Agent should design optimal task breakdown, determine logical dependencies, predict affected files, assign realistic priorities
   - Agent must provide: meaningful task descriptions, implementation guidance, accurate file predictions, testing strategies

7. **Task Integration Check**:
   - Use Bash tool to run `todoq list --json` to get existing tasks
   - Use Task tool with general-purpose agent to analyze conflicts and determine merge strategy for new tasks with existing ones

8. **Save JSON File**: Use Bash tool to write generated tasks to `$TODOQ_DIR/prd-tasks.json`

9. **Validate Schema**: 
    - Use Bash tool to run `todoq bulk-validate $TODOQ_DIR/prd-tasks.json`

10. **Intelligent Error Fixing**: 
    - If validation fails: Use Task tool with general-purpose agent to analyze schema errors, understand root causes, and fix JSON systematically
    - Agent should handle cascading fixes and dependency conflicts intelligently
    - Re-validate after each fix cycle until clean

11. **Quality Validation**:
    - Use Task tool with general-purpose agent to review generated tasks for logical consistency, implementation feasibility, and alignment with codebase patterns
    - Agent should verify task hierarchy makes sense for the specific PRD and project context

12. **Preview & User Review**:
    - Use Bash tool to display generated task hierarchy using formatted output
    - Prompt user to confirm import or request modifications
    - Allow iterative refinement based on user feedback

13. **Import Tasks**: 
    - Use Bash tool to run `todoq import $TODOQ_DIR/prd-tasks.json`

14. **Verify Import**: 
    - Use Bash tool to run `todoq list --tree` to display imported task hierarchy

15. **Start Workflow**: 
    - Use Bash tool to run `todoq current` to show next task
    - Provide summary of imported tasks and next steps

## TodoQ JSON Schema

Use this exact format for task generation:

```json
{
  "tasks": [
    {
      "number": "1.0",
      "name": "Task Name",
      "description": "Implementation details with specific guidance",
      "parent": null,
      "status": "pending",
      "priority": 1,
      "dependencies": [],
      "files": ["path/to/file.ts"],
      "docs_references": ["https://docs.url"],
      "testing_strategy": "Unit and integration approach",
      "notes": "Additional context and implementation hints"
    }
  ]
}
```

## Relevant TodoQ Commands

- `todoq bulk-validate $TODOQ_DIR/prd-tasks.json` - Validate JSON schema without importing
- `todoq init` - Initialize database if todoq.db missing
- `todoq import $TODOQ_DIR/prd-tasks.json` - Import validated tasks into database
- `todoq export --pretty` - Export existing tasks for backup
- `todoq list --tree` - Display hierarchical task view
- `todoq list --json` - Get existing tasks in JSON format
- `todoq current` - Show next task to work on