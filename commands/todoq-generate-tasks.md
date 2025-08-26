# Command: Generate TodoQ Tasks from PRD

## Context

- prd file path: "$PRD_PATH" (required)
- project directory: "$PROJECT_DIR" (optional, defaults to repository root if not specified)
- todoq database directory: "$TODOQ_DIR" (determined from `.todoqrc` configuration)

## Goal

Generate hierarchical TodoQ tasks from a PRD using intelligent analysis and import them into the TodoQ database with comprehensive validation, user control, and safety checks. Note: todoq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/generate-todoq-tasks $PRD_PATH $PROJECT_DIR
```

## Process

1. **Initialize Complete Execution Plan**
   - Create comprehensive TodoWrite with ALL steps (1-18) pre-planned
   - Mark ONLY step 2 as `in_progress` initially
   - Include validation checkpoints and error recovery todos
   - **SUCCESS CRITERIA**: TodoWrite shows complete execution roadmap

2. **Directory Setup & Validation**
   - **CHECKPOINT**: Verify step 1 completed in TodoWrite before proceeding
   - Use Bash tool to run `cd "$PROJECT_DIR"` (or repository root if not specified)
   - Use Bash tool to run `test -f .todoq/todoq.db` to verify todoq is initialized
   - If fails, create recovery todo "Initialize todoq database (todoq init)" and STOP
   - **COMPLETION**: Mark step 2 complete, start step 3

3. **Early Task Integration Analysis**
   - **CHECKPOINT**: Verify step 2 completed in TodoWrite before proceeding
   - Use Bash tool to run `todoq list --json` to get existing tasks early
   - Use Task tool with general-purpose agent to analyze existing task structure
   - Agent should identify potential conflicts and integration strategies upfront
   - **COMPLETION**: Mark step 3 complete, start step 4

4. **Phase 1 Checkpoint - Environment Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-3 as completed
   - Verify todoq initialized and existing tasks analyzed
   - If ANY previous step incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 4 complete, start step 5

5. **Intelligent PRD Analysis with User Review**
   - **CHECKPOINT**: Verify step 4 completed in TodoWrite before proceeding
   - Use Task tool with general-purpose agent to read $PRD_PATH and perform deep analysis
   - Agent should extract: functional requirements, non-functional requirements, user stories, acceptance criteria, business rules, implicit requirements
   - Agent should classify and prioritize requirements by business value and technical complexity
   - **USER REVIEW**: Present analysis results and get user approval before proceeding
   - **COMPLETION**: Mark step 5 complete, start step 6

6. **Context Research & Codebase Analysis**
   - **CHECKPOINT**: Verify step 5 completed in TodoWrite before proceeding
   - Use Task tool with general-purpose agent to research relevant documentation, codebase patterns, and testing strategies
   - Agent should gather context for implementation approaches that align with existing codebase patterns
   - **COMPLETION**: Mark step 6 complete, start step 7

7. **Intelligent Task Generation with Structure Preview**
   - **CHECKPOINT**: Verify step 6 completed in TodoWrite before proceeding
   - Use Task tool with general-purpose agent to create hierarchical parent/sub-tasks using TodoQ JSON schema
   - Agent should design optimal task breakdown, determine logical dependencies, predict affected files, assign realistic priorities
   - **ATOMICITY VALIDATION**: Agent validates each task is atomic (single responsibility, 1-4 hours, independently testable) and breaks down complex tasks further
   - **TEST & DOCUMENTATION DESIGN**: Agent designs unit and integration test strategies for each task, explores necessary documentation updates, and ensures testability requirements are captured
   - **USER PREVIEW**: Display task structure hierarchy for user review and approval
   - Allow iterative refinement of task structure based on user feedback
   - **COMPLETION**: Mark step 7 complete, start step 8

8. **Phase 2 Checkpoint - Analysis & Generation Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-7 as completed
   - Verify PRD analyzed, context researched, tasks generated, and user approved structure
   - If ANY previous step incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 8 complete, start step 9

9. **Advanced Integration Strategy Analysis**
   - **CHECKPOINT**: Verify step 8 completed in TodoWrite before proceeding
   - Use Task tool with general-purpose agent to analyze integration of new tasks with existing ones
   - Agent should determine optimal merge strategies: append, interleave, or replace patterns
   - Present multiple integration options to user for selection
   - **COMPLETION**: Mark step 9 complete, start step 10

10. **Create Backup & Safety Checkpoint**
    - **CHECKPOINT**: Verify step 9 completed in TodoWrite before proceeding
    - Use Bash tool to run `todoq export --pretty > $TODOQ_DIR/backup-$(date +%Y%m%d-%H%M%S).json`
    - Create additional backup in case rollback needed after user review
    - **COMPLETION**: Mark step 10 complete, start step 11

11. **Save Generated Tasks & Schema Validation**
    - **CHECKPOINT**: Verify step 10 completed in TodoWrite before proceeding
    - Use Bash tool to write generated tasks to `$TODOQ_DIR/prd-tasks.json`
    - Use Bash tool to run `todoq bulk-validate $TODOQ_DIR/prd-tasks.json`
    - If validation fails: Use Task tool with general-purpose agent to fix schema errors systematically
    - **COMPLETION**: Mark step 11 complete, start step 12

12. **Phase 3 Checkpoint - Integration & Quality Complete**
    - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-11 as completed
    - Verify tasks generated, integration strategy selected, backup created, and schema validated
    - If ANY previous step incomplete: create specific recovery todos and STOP
    - **COMPLETION**: Mark step 12 complete, start step 13

13. **Multi-Layer Quality Validation**
    - **CHECKPOINT**: Verify step 12 completed in TodoWrite before proceeding
    - Use Task tool with general-purpose agent to review generated tasks for:
      - Logical consistency and hierarchy validation
      - Implementation feasibility analysis  
      - Alignment with codebase patterns
      - Dependency conflict detection
    - **COMPLETION**: Mark step 13 complete, start step 14

14. **Final User Review & Import Decision**
    - **CHECKPOINT**: Verify step 13 completed in TodoWrite before proceeding
    - Use Bash tool to display formatted task hierarchy with quality assessment
    - Present user with options: approve, modify, reject, or partial import
    - Allow final iterative refinement based on user feedback
    - **USER DECISION POINT**: Proceed only with explicit user approval
    - **COMPLETION**: Mark step 14 complete, start step 15

15. **Safe Task Import with Verification**
    - **CHECKPOINT**: Verify step 14 completed in TodoWrite before proceeding
    - Use Bash tool to run `todoq import $TODOQ_DIR/prd-tasks.json`
    - If import fails: Create recovery todo with specific error analysis and STOP
    - **COMPLETION**: Mark step 15 complete, start step 16

16. **Import Verification & Rollback Check**
    - **CHECKPOINT**: Verify step 15 completed in TodoWrite before proceeding
    - Use Bash tool to run `todoq list --tree` to display imported task hierarchy
    - Verify imported tasks match expected structure and relationships
    - If verification fails: Offer rollback to backup and STOP
    - **COMPLETION**: Mark step 16 complete, start step 17

17. **Phase 4 Checkpoint - Import Complete**
    - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-16 as completed
    - Use Bash tool to run `todoq stats` to verify import success metrics
    - Final verification that all tasks imported correctly and database consistent
    - If ANY verification fails: create specific recovery todos and STOP
    - **COMPLETION**: Mark step 17 complete, start step 18

18. **Workflow Initialization & Summary**
    - **CHECKPOINT**: Verify step 17 completed in TodoWrite before proceeding
    - Use Bash tool to run `todoq current` to show next task
    - Provide comprehensive summary of imported tasks, next steps, and success metrics
    - **FINAL VALIDATION**: Verify ALL TodoWrite steps 1-17 marked as completed
    - **COMPLETION**: Mark step 18 complete - EXECUTION FINISHED

## Error Recovery Pattern (Applied to ALL Steps)

**On ANY Step Failure:**
1. Keep current step as `in_progress` in TodoWrite
2. Create specific recovery todo describing the exact failure
3. DO NOT proceed to next step until current step shows `completed`
4. Use Task tool with general-purpose agent to analyze and resolve specific failure
5. Only continue sequential execution after recovery todo completed

## Mandatory Validation Rules

1. **Sequential Enforcement**: No step can begin until previous step shows `completed` in TodoWrite
2. **Checkpoint Validation**: Phase checkpoints (4, 8, 12, 17) MUST verify all previous steps completed
3. **Error Stopping**: ANY failure creates recovery todos and halts progression
4. **User Control Points**: Steps 5, 7, 9, 14 require explicit user approval before proceeding
5. **Final Validation**: Step 18 verifies complete execution before finish
6. **No Skipping**: Every step must be explicitly marked complete in TodoWrite

## Rollback & Safety Features

**Multiple Rollback Points:**
- Step 10: Pre-import backup created
- Step 16: Post-import verification with rollback option
- User can request rollback at any approval point

**Partial Import Support:**
- User can select subset of generated tasks for import
- Selective integration based on user preferences

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
- `todoq stats` - Show progress statistics