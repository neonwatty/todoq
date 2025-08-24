# Rule: Generating a Task List from a PRD

## Goal

Create a detailed, step-by-step task list in Markdown format based on an existing Product Requirements Document (PRD). The task list should guide a developer through implementation.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/tasks/`
- **Filename:** `tasks-[prd-file-name].md` (e.g., `tasks-prd-user-profile-editing.md`)

## Process

1. Analyze PRD requirements and user stories
2. Assess current codebase state and existing components
3. Generate parent tasks, present to user
4. Generate detailed sub-tasks with implementation details
5. Use WebSearch to research documentation and testing strategies
6. Identify relevant files and testing approaches
7. Create final output with consistent task numbering for `/next-task` integration
8. Save to `/tasks/tasks-[prd-name].md`

## Output Format

The generated task list _must_ follow this structure:

```markdown
## Relevant Files

- `path/to/potential/file1.ts` - Brief description of why this file is relevant (e.g., Contains the main component for this feature).
- `path/to/file1.test.ts` - Unit tests for `file1.ts`.
- `path/to/another/file.tsx` - Brief description (e.g., API route handler for data submission).
- `path/to/another/file.test.tsx` - Unit tests for `another/file.tsx`.
- `lib/utils/helpers.ts` - Brief description (e.g., Utility functions needed for calculations).
- `lib/utils/helpers.test.ts` - Unit tests for `helpers.ts`.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `rails test [optional/path/to/test/file]` to run tests. Running without a path executes all tests.

## Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 [Sub-task description 1.1]
    - *Docs: [Documentation URLs]*
    - *Testing: [Component type] - Unit: [focus areas], Integration: [interaction tests]*
  - [ ] 1.2 [Sub-task description 1.2]
    - *Docs: [Documentation URLs]*
    - *Testing: [Component type] - Unit: [focus areas], Integration: [interaction tests]*
```

## Interaction Model

The process explicitly requires a pause after generating parent tasks to get user confirmation ("Go") before proceeding to generate the detailed sub-tasks. This ensures the high-level plan aligns with user expectations before diving into details.
