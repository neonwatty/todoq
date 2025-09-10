# Implementation Plan: TodoQ Work-Next Command

## Overview
Create a new CLI command `work-next` that programmatically executes the todoq-work-next-task workflow using a combination of direct todoq CLI calls (steps 1-3) and headless Claude Code (steps 4-8), mirroring the tfq Claude service architecture.

## Todo List

### Phase 1: Service Layer Foundation

#### 1.1 Create Service Directory Structure
- [ ] Create `src/services/` directory
- [ ] Create `src/services/claude/` directory
- [ ] Create `src/services/claude/index.ts` (entry point)
- [ ] Create `src/services/claude/types.ts` (type definitions)
- [ ] Create `src/services/claude/config.ts` (configuration management)
- [ ] Create `src/services/claude/claude-service.ts` (main service class)

#### 1.2 Implement Type Definitions (`src/services/claude/types.ts`)
- [ ] Define `ClaudeConfig` interface with properties:
  - [ ] `enabled: boolean`
  - [ ] `claudePath?: string`
  - [ ] `maxIterations?: number`
  - [ ] `timeout?: number`
  - [ ] `model?: string`
  - [ ] `verbose?: boolean`
  - [ ] `streaming?: boolean`
  - [ ] `prompt?: string`
  - [ ] `allowedTools?: string[]`
  - [ ] `customArgs?: string[]`
- [ ] Define `WorkTaskResult` interface with properties:
  - [ ] `success: boolean`
  - [ ] `taskNumber?: string`
  - [ ] `taskName?: string`
  - [ ] `error?: string`
  - [ ] `duration: number`
  - [ ] `iterations: number`
  - [ ] `output?: string`
- [ ] Define `TaskContext` interface with properties:
  - [ ] `taskJson: any`
  - [ ] `projectDir: string`
  - [ ] `remainingCount: number`

#### 1.3 Implement Configuration Manager (`src/services/claude/config.ts`)
- [ ] Create `ClaudeConfigManager` class
- [ ] Implement constructor accepting optional `Partial<ClaudeConfig>`
- [ ] Implement `getDefaults()` method with defaults:
  - [ ] `enabled: false`
  - [ ] `maxIterations: 3`
  - [ ] `timeout: 180000`
  - [ ] `model: 'sonnet-4'` (updated default)
  - [ ] `verbose: false`
  - [ ] `streaming: false` (default to false)
- [ ] Implement `detectClaudePath()` method checking:
  - [ ] `'claude'` in PATH
  - [ ] `~/.claude/local/claude`
  - [ ] `/usr/local/bin/claude`
  - [ ] `process.env.CLAUDE_PATH`
- [ ] Implement `validateConfig()` method
- [ ] Implement `buildCliArguments()` method
- [ ] Implement getter methods:
  - [ ] `getClaudePath(): string`
  - [ ] `getTimeout(): number`
  - [ ] `isVerbose(): boolean`
  - [ ] `isStreaming(): boolean`
  - [ ] `getModel(): string`

### Phase 2: Core Service Implementation

#### 2.1 Implement Main Service (`src/services/claude/claude-service.ts`)
- [ ] Create `ClaudeService` class
- [ ] Add constructor accepting optional `configPath` and `overrideClaudePath`
- [ ] Initialize `ClaudeConfigManager` in constructor
- [ ] Add `execa` import for process execution

#### 2.2 Implement Service Methods
- [ ] Implement `isAvailable()` method:
  - [ ] Try to execute `claude --version`
  - [ ] Return boolean based on success/failure
  - [ ] Handle errors gracefully

- [ ] Implement `executeTodoqGetNext(projectDir: string)` method:
  - [ ] Get todoq CLI path from project dist
  - [ ] Execute `todoq init` in project directory
  - [ ] Execute `todoq remaining --count` and parse result
  - [ ] Throw error if count is 0
  - [ ] Execute `todoq current --json` to get task data
  - [ ] Execute `todoq current --start` to mark task in progress
  - [ ] Return `TaskContext` object

- [ ] Implement `executeTodoqNextPrompt(context: TaskContext)` method:
  - [ ] Build prompt using `buildPrompt()` method
  - [ ] Set up execa options with timeout and input
  - [ ] Handle streaming vs non-streaming execution based on config
  - [ ] For streaming: set up stdout/stderr event listeners
  - [ ] Execute Claude CLI with built arguments
  - [ ] Capture and return results as `WorkTaskResult`
  - [ ] Handle errors gracefully

- [ ] Implement `buildPrompt(context: TaskContext)` method:
  - [ ] Include task JSON in prompt
  - [ ] Include project directory
  - [ ] Add exact content from todoq-work-next-task.md steps 4-8:
    - [ ] Step 4: Phase 1 Checkpoint - Initialization Complete
    - [ ] Step 5: Context Extraction & Documentation Research
    - [ ] Step 6: Implementation Phase  
    - [ ] Step 7: Phase 2 Checkpoint - Implementation Complete
    - [ ] Step 8: Testing & Validation Pipeline
  - [ ] Include Error Recovery Pattern section
  - [ ] Include Mandatory Validation Rules section

- [ ] Implement `parseTaskInfo(output: string)` helper method

#### 2.3 Implement Singleton Pattern
- [ ] Add module-level `instance` variable
- [ ] Implement `getClaudeService(configPath?, overridePath?)` function:
  - [ ] Check if instance exists and no overrides provided
  - [ ] Create new instance if needed
  - [ ] Return singleton instance

#### 2.4 Complete Service Index (`src/services/claude/index.ts`)
- [ ] Export `ClaudeService` class
- [ ] Export `getClaudeService` function
- [ ] Export `ClaudeConfigManager` class
- [ ] Export all types from types.ts

### Phase 3: CLI Command Implementation

#### 3.1 Create Work-Next Command (`src/cli/commands/work-next.ts`)
- [ ] Import necessary dependencies (`Command`, `getClaudeService`)
- [ ] Create `registerWorkNextCommands(program: Command)` function
- [ ] Define command with:
  - [ ] Command name: `work-next`
  - [ ] Description: "Work on next task using Claude"
  - [ ] Directory argument (optional, defaults to cwd)
  - [ ] `--timeout <ms>` option (default: 180000)
  - [ ] `--verbose` option
  - [ ] `--streaming` option
  - [ ] `--skip-claude-check` option

#### 3.2 Implement Command Action
- [ ] Get Claude service instance
- [ ] Check Claude availability (unless skipped)
- [ ] Execute steps 1-3 via `executeTodoqGetNext()`
- [ ] Log current task information
- [ ] Execute steps 4-8 via `executeTodoqNextPrompt()`
- [ ] Handle success/failure results
- [ ] Proper error handling and exit codes

#### 3.3 Register New Command
- [ ] Update `src/cli/commands/index.ts`:
  - [ ] Import `registerWorkNextCommands`
  - [ ] Call registration function in `registerCommands()`

### Phase 4: Configuration Integration

#### 4.1 Extend TodoQ Configuration Schema
- [ ] Research current config loading mechanism in `src/adapters/config/`
- [ ] Add Claude config section to schema:
  ```json
  {
    "claude": {
      "enabled": true,
      "claudePath": "claude",
      "timeout": 180000,
      "model": "sonnet-4",
      "verbose": false,
      "streaming": false,
      "maxIterations": 3,
      "allowedTools": ["Read", "Edit", "Bash", "Grep", "WebFetch", "WebSearch", "TodoWrite"]
    }
  }
  ```

#### 4.2 Update Configuration Types
- [ ] Add Claude config types to main config interface
- [ ] Update config validation logic
- [ ] Add default values for Claude configuration

### Phase 5: Testing Implementation

#### 5.1 Unit Tests Structure
- [ ] Create `tests/unit/services/` directory
- [ ] Create `tests/unit/services/claude/` directory
- [ ] Create test files:
  - [ ] `claude-service.test.ts`
  - [ ] `config.test.ts`
  - [ ] `types.test.ts`

#### 5.2 Claude Service Unit Tests
- [ ] Test `isAvailable()` method
- [ ] Test `executeTodoqGetNext()` with mocked execa calls
- [ ] Test `executeTodoqNextPrompt()` with mocked Claude execution
- [ ] Test prompt building with exact step content verification
- [ ] Test error handling scenarios
- [ ] Test singleton pattern behavior

#### 5.3 Configuration Unit Tests
- [ ] Test default configuration values
- [ ] Test Claude path detection logic
- [ ] Test configuration merging
- [ ] Test CLI argument building
- [ ] Test validation methods

#### 5.4 Integration Tests
- [ ] Create `tests/claude/work-next.test.ts`
- [ ] Test full work-next command execution
- [ ] Test with and without Claude availability
- [ ] Test streaming vs non-streaming modes
- [ ] Test timeout handling
- [ ] Test error recovery scenarios

### Phase 6: Documentation and Polish

#### 6.1 Update Documentation
- [ ] Update `README.md` with work-next command documentation
- [ ] Update `CLAUDE.md` with new service information
- [ ] Add configuration examples
- [ ] Document CLI options and usage

#### 6.2 Code Quality
- [ ] Run linting: `npm run lint`
- [ ] Run type checking: `npm run typecheck`
- [ ] Run all tests: `npm run test`
- [ ] Fix any linting/type errors
- [ ] Add JSDoc comments to public methods

#### 6.3 Build and Test
- [ ] Build project: `npm run build`
- [ ] Test CLI functionality manually
- [ ] Verify error handling works correctly
- [ ] Test with actual Claude Code installation

### Phase 7: Final Review and Deployment

#### 7.1 Code Review
- [ ] Self-review all implementation
- [ ] Check adherence to existing code patterns
- [ ] Verify tfq architecture mirroring is accurate
- [ ] Ensure all requirements are met

#### 7.2 Final Testing
- [ ] Run full test suite
- [ ] Manual testing of happy path
- [ ] Manual testing of error scenarios
- [ ] Performance testing with realistic tasks

#### 7.3 Prepare for Merge
- [ ] Commit all changes with descriptive messages
- [ ] Update version number if needed
- [ ] Create pull request with detailed description
- [ ] Address any review feedback

## Success Criteria

### Functional Requirements
- [x] Command `todoq work-next [directory]` executes successfully
- [x] Steps 1-3 executed via direct todoq CLI calls
- [x] Steps 4-8 executed via Claude Code with exact prompt content
- [x] Configuration defaults: sonnet-4 model, streaming false
- [x] Error handling and graceful degradation
- [x] Singleton service pattern matching tfq architecture

### Technical Requirements
- [x] Clean, maintainable code following existing patterns
- [x] Comprehensive test coverage (unit + integration)
- [x] Proper TypeScript types and interfaces
- [x] Configuration integration with existing system
- [x] Proper error handling and logging

### Quality Requirements
- [x] All linting rules pass
- [x] All type checks pass
- [x] All tests pass
- [x] Documentation is complete and accurate
- [x] Code follows existing architectural patterns

## Notes
- Implementation should exactly mirror the tfq Claude service structure
- Default model is `sonnet-4`, not opus
- Streaming defaults to `false` for better stability
- Prompt content must match todoq-work-next-task.md steps 4-8 exactly
- Error handling should be robust and user-friendly
- Configuration should integrate seamlessly with existing .todoqrc system