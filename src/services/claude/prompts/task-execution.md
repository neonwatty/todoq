You are working on task: {{TASK_JSON}}
Project directory: {{PROJECT_DIR}}

Execute the following steps:

4. **Phase 1 Checkpoint - Initialization Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-3 as completed
   - Verify task json successfully extracted and task marked in_progress
   - If ANY previous step incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 4 complete, start step 5

5. **Context Extraction & Documentation Research**
   - **CHECKPOINT**: Verify step 4 completed in TodoWrite before proceeding
   - Extract all elements from task json (number, name, description, files, docs_references, etc.)
   - If documentation references provided: Use WebFetch/WebSearch tools for comprehensive documentation research
   - Formulate effective search queries and connect findings to implementation and testing strategies
   - Integrate documentation findings with task context for implementation planning
   - **COMPLETION**: Mark step 5 complete, start step 6

6. **Implementation Phase**
   - **CHECKPOINT**: Verify step 5 completed in TodoWrite before proceeding
   - Expand task into specific implementation steps and update TodoWrite accordingly
   - Execute each implementation step using appropriate tools (Read, Edit, Bash, etc.)
   - Validate each substep completion before proceeding to next substep
   - Follow existing code conventions and patterns found in the codebase
   - **COMPLETION**: Mark step 6 complete when all implementation subtasks completed, start step 7

7. **Phase 2 Checkpoint - Implementation Complete**
   - **MANDATORY VALIDATION**: Verify TodoWrite shows steps 1-6 as completed
   - Verify all implementation subtasks completed successfully
   - If implementation incomplete: create specific recovery todos and STOP
   - **COMPLETION**: Mark step 7 complete, start step 8

8. **Testing & Validation Pipeline**
   - **CHECKPOINT**: Verify step 7 completed in TodoWrite before proceeding
   - Determine proper unit and integration tests for implemented functionality
   - Use Bash tool to run project-specific testing commands
   - Use Bash tool to run linting/typecheck validation if available (npm run lint, npm run typecheck)
   - On ANY test failures: Create specific recovery todos, keep step 8 as in_progress, and STOP
   - **COMPLETION**: Only mark step 8 complete when ALL tests pass

## Error Recovery Pattern
**On ANY Step Failure:**
1. Keep current step as in_progress in TodoWrite
2. Create specific recovery todo describing the exact failure
3. DO NOT proceed to next step until current step shows completed
4. Analyze failure context and resolve using appropriate direct tools (Read, Edit, Bash, etc.)
5. Only continue sequential execution after recovery todo completed

## Mandatory Validation Rules
1. **Sequential Enforcement**: No step can begin until previous step shows completed in TodoWrite
2. **Checkpoint Validation**: Phase checkpoints (4, 7) MUST verify all previous steps completed
3. **Error Stopping**: ANY failure creates recovery todos and halts progression
4. **No Skipping**: Every step must be explicitly marked complete in TodoWrite