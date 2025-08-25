# Command: Work Next TodoQ Task

## Context

- Project directory: "$PROJECT_DIR" (optional, defaults to current directory)

## Goal
Help developers work on tasks with auto-fetched documentation context and implementation guidance. Note: todoq AND tfq must be initialized in the $PROJECT_DIR for this command to function properly.

## Usage
```
/work-next-todoq-task $PROJECT_DIR
```

## Process

1. **Initialize Complete Execution Plan**
   - Create comprehensive TodoWrite with ALL steps (1-14) pre-planned
   - Mark ONLY step 2 as `in_progress` initially
   - Include validation checkpoints and error recovery todos
   - **SUCCESS CRITERIA**: TodoWrite shows complete execution roadmap

2. **Directory Setup & Validation**
   - **CHECKPOINT**: Verify step 1 completed in TodoWrite before proceeding
   - Use Bash tool to run `cd "$PROJECT_DIR"` (or repository root if not specified)
   - Use Bash tool to run `test -f .todoq/todoq.db` to verify todoq is initialized
   - Use Bash tool to run `test -f .tfq/tfq.db` to verify tfq is initialized
   - If either fails, create recovery todo and STOP: "Initialize missing databases (todoq init / tfq init)"
   - **COMPLETION**: Mark step 2 complete, start step 3

3. **Task Discovery & Status Update**
   - **CHECKPOINT**: Verify step 2 completed in TodoWrite before proceeding
   - Use Bash tool to run `todoq remaining --count`, if count is 0 create todo "Handle no remaining tasks" and STOP
   - Use Bash tool to run `todoq current --json` to get next uncompleted task in json form
   - Use Bash tool to run `todoq current --start` to mark task as `in_progress`
   - **COMPLETION**: Mark step 3 complete, start step 4

4. **Phase 1 Checkpoint - Initialization Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-3 as completed
   - Verify task json successfully extracted and task marked in_progress
   - If ANY previous step incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 4 complete, start step 5

5. **Context Extraction & Documentation Research**
   - **CHECKPOINT**: Verify step 4 completed in TodoWrite before proceeding
   - Extract all elements from task json (number, name, description, files, docs_references, etc.)
   - If documentation references provided: Use Task tool with general-purpose agent for comprehensive documentation research
   - Agent must formulate effective search queries and connect findings to implementation and testing strategies
   - **COMPLETION**: Mark step 5 complete, start step 6

6. **Implementation Phase**
   - **CHECKPOINT**: Verify step 5 completed in TodoWrite before proceeding
   - Use Task tool with general-purpose agent to handle complete implementation
   - Provide extracted context from step 5 as detailed input to implementation agent
   - Agent MUST expand task into specific implementation steps and update TodoWrite accordingly
   - Agent MUST complete each implementation step individually with proper validation
   - **COMPLETION**: Mark step 6 complete, start step 7

7. **Phase 2 Checkpoint - Implementation Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-6 as completed
   - Verify implementation agent completed all implementation subtasks
   - If implementation incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 7 complete, start step 8

8. **Testing & Validation Pipeline**
   - **CHECKPOINT**: Verify step 7 completed in TodoWrite before proceeding
   - Determine proper unit and integration tests for implemented functionality
   - Use Bash tool to run project-specific testing commands (npm test, cargo test, etc.)
   - Use Bash tool to run linting/typecheck validation if available (npm run lint, npm run typecheck)
   - On ANY test failures: Create specific recovery todos, keep step 8 as in_progress, and STOP
   - **COMPLETION**: Only mark step 8 complete when ALL tests pass, start step 9

9. **Quality Assurance Review**
   - **CHECKPOINT**: Verify step 8 completed in TodoWrite before proceeding
   - Use Task tool to spawn independent validation agent for comprehensive review
   - Validation agent must double-check implementation against original task requirements
   - If validation fails: Create specific fix todos, keep step 9 as in_progress, and STOP
   - **COMPLETION**: Mark step 9 complete, start step 10

10. **Automated Test Fixing - Round 1**
    - **CHECKPOINT**: Verify step 9 completed in TodoWrite before proceeding
    - If `$PROJECT_DIR` provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
    - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
    - Update TodoWrite with specific results from test fixing
    - **COMPLETION**: Mark step 10 complete, start step 11

11. **Automated Test Fixing - Round 2**
    - **CHECKPOINT**: Verify step 10 completed in TodoWrite before proceeding
    - If `$PROJECT_DIR` provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
    - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
    - Update TodoWrite with specific results from test fixing
    - **COMPLETION**: Mark step 11 complete, start step 12

12. **Automated Test Fixing - Round 3**
    - **CHECKPOINT**: Verify step 11 completed in TodoWrite before proceeding
    - If `$PROJECT_DIR` provided: Use Task tool to execute `/tfq:tfq-fix-all $PROJECT_DIR`
    - Else: Use Task tool to execute `/tfq:tfq-fix-all` (runs in current directory)
    - Update TodoWrite with specific results from test fixing
    - **COMPLETION**: Mark step 12 complete, start step 13

13. **Phase 3 Checkpoint - Testing Complete**
    - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-12 as completed
    - Use Bash tool to run `tfq count` to verify no remaining test failures
    - Run final comprehensive test suite to ensure everything works
    - If ANY tests still failing: Create specific recovery todos and STOP
    - **COMPLETION**: Mark step 13 complete, start step 14

14. **Task Completion & Final Validation**
    - **CHECKPOINT**: Verify step 13 completed in TodoWrite before proceeding
    - **FINAL VALIDATION**: Verify ALL TodoWrite steps 1-13 marked as completed
    - Use Bash tool to run `tfq count`, if result is `0`: Use Bash tool to run `todoq current --complete --force`
    - If `tfq count` > 0: Create recovery todo "Resolve remaining test failures" and STOP
    - Use Bash tool to run `todoq current --json` to verify task marked as completed
    - **COMPLETION**: Mark step 14 complete - EXECUTION FINISHED

## Error Recovery Pattern (Applied to ALL Steps)

**On ANY Step Failure:**
1. Keep current step as `in_progress` in TodoWrite
2. Create specific recovery todo describing the exact failure
3. DO NOT proceed to next step until current step shows `completed`
4. Use Task tool with general-purpose agent to analyze and resolve specific failure
5. Only continue sequential execution after recovery todo completed

## Mandatory Validation Rules

1. **Sequential Enforcement**: No step can begin until previous step shows `completed` in TodoWrite
2. **Checkpoint Validation**: Phase checkpoints (4, 7, 13) MUST verify all previous steps completed
3. **Error Stopping**: ANY failure creates recovery todos and halts progression
4. **Final Validation**: Step 14 verifies complete execution before task completion
5. **No Skipping**: Every step must be explicitly marked complete in TodoWrite


