# TodoQ Claude Prompts

This directory contains prompt templates used by the Claude integration.

## Files

### task-execution.md
The main prompt template for task execution. This prompt guides Claude through the structured task completion process.

**Placeholders:**
- `{{TASK_JSON}}` - Replaced with the JSON representation of the current task
- `{{PROJECT_DIR}}` - Replaced with the project directory path

## Customization

Users can customize the task execution behavior by:

1. **Modifying the prompt file directly** - Edit `task-execution.md` to change how Claude approaches tasks
2. **Using appendSystemPrompt in config** - Add additional instructions via `.todoqrc` without modifying the core prompt

## Fallback Behavior

If the prompt file cannot be loaded, the system falls back to an embedded version in `claude-service.ts` to ensure TodoQ continues to work even if the prompt file is missing or corrupted.