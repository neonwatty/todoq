# TodoQ Work-Next Command Summary

## Command
```bash
todoq work-next [directory]
```

## Command-Line Options

### Core Options
- `--test-timeout <ms>` - execution timeout (60000-600000ms, default: 300000)
- `--max-iterations <num>` - max Claude iterations (1-50, default: 10)
- `--max-turns <num>` - max conversation turns (1-100, default: 5)
- `--model <model>` - Claude model (sonnet|opus|full-model-name, default: sonnet)
- `--output-format <format>` - output format (text|json|stream-json, default: text)
- `--permission-mode <mode>` - permission handling (plan|ask|auto, default: plan)

### Control Options
- `--verbose` - enable detailed logging
- `--dangerously-skip-permissions` - skip permission prompts (dev mode)
- `--continue-session` - resume most recent conversation (enables multi-turn task completion)
- `--skip-claude-check` - skip Claude availability check
- Retry configuration: `maxRetries`, `retryDelay`, `retryBackoffMultiplier`, `maxRetryDelay`

## Configuration

### Config File Location
- `.todoqrc`
- `todoq.config.js` 
- `package.json` (todoq property)

### Config Schema
```json
{
  "claude": {
    "enabled": true,
    "claudePath": "/path/to/claude",
    "testTimeout": 300000,
    "maxIterations": 10,
    "maxTurns": 5,
    "model": "sonnet",
    "outputFormat": "text",
    "permissionMode": "plan",
    "verbose": false,
    "streaming": false,
    "dangerouslySkipPermissions": false,
    "continueSession": true,
    "allowedTools": ["Read", "Edit", "Bash", "Grep", "WebFetch", "WebSearch", "TodoWrite"],
    "disallowedTools": [],
    "customArgs": [],
    "addDir": [],
    "appendSystemPrompt": "",
    "maxRetries": 3,
    "retryDelay": 2000,
    "retryBackoffMultiplier": 2,
    "maxRetryDelay": 15000
  }
}
```

### Default Values
- `enabled`: false
- `testTimeout`: 300000ms (5 minutes)  
- `maxIterations`: 10
- `maxTurns`: 5
- `model`: "sonnet"
- `outputFormat`: "text"
- `permissionMode`: "plan" 
- `verbose`: false
- `streaming`: false
- `dangerouslySkipPermissions`: false
- `continueSession`: true (enables multi-turn task completion - Claude can build on previous attempts)
- `allowedTools`: ["Read", "Edit", "Bash", "Grep", "WebFetch", "WebSearch", "TodoWrite"]

### Key Configuration Notes
- `continueSession`: When `true`, enables multi-turn task completion where Claude can build upon previous conversation attempts to complete complex tasks. When `false`, each work-next execution starts fresh.
- `allowedTools`: Tools that Claude Code is permitted to use without additional prompts.
- `disallowedTools`: Tools explicitly blocked from Claude Code usage.

### Validation Ranges
- `testTimeout`: 60000-600000ms (1-10 minutes)
- `maxIterations`: 1-50
- `maxTurns`: 1-100
- `outputFormat`: text|json|stream-json
- `permissionMode`: plan|ask|auto

## Process Flow
1. **Steps 1-3**: Get next pending task from todoq database
2. **Steps 4-8**: Use Claude Code to work on the task via headless execution
3. **Report**: Completion status and duration

## Configuration Override
Command-line options override config file values using tfq-style parameter mapping.