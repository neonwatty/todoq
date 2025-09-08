import { execa } from 'execa';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { ClaudeConfigManager } from './config.js';
import { formatToolInput } from '../../cli/utils/json-formatter.js';
import type { ClaudeConfig, WorkTaskResult, TaskContext } from './types.js';
import type { TodoqConfig } from '../../core/types.js';

/**
 * Claude service for executing todoq work-next tasks
 */
export class ClaudeService {
  private configManager: ClaudeConfigManager;

  constructor(configPath?: string, overrideClaudePath?: string, todoqConfig?: TodoqConfig) {
    // Initialize configuration from TodoqConfig if provided
    let config: Partial<ClaudeConfig> = {};
    
    if (todoqConfig?.claude) {
      config = {
        enabled: todoqConfig.claude.enabled,
        claudePath: todoqConfig.claude.claudePath,
        maxIterations: todoqConfig.claude.maxIterations,
        testTimeout: todoqConfig.claude.timeout,
        model: todoqConfig.claude.model,
        verbose: todoqConfig.claude.verbose,
        outputFormat: todoqConfig.claude.outputFormat,
        permissionMode: todoqConfig.claude.permissionMode,
        dangerouslySkipPermissions: todoqConfig.claude.dangerouslySkipPermissions,
        allowedTools: todoqConfig.claude.allowedTools,
        customArgs: todoqConfig.claude.customArgs,
        continueSession: todoqConfig.claude.continueSession,
        appendSystemPrompt: todoqConfig.claude.appendSystemPrompt,
        // Retry configuration
        maxRetries: todoqConfig.claude.maxRetries,
        retryDelay: todoqConfig.claude.retryDelay,
        retryBackoffMultiplier: todoqConfig.claude.retryBackoffMultiplier,
        maxRetryDelay: todoqConfig.claude.maxRetryDelay
      };
    }
    
    if (overrideClaudePath) {
      config.claudePath = overrideClaudePath;
    }

    this.configManager = new ClaudeConfigManager(config);
  }

  /**
   * Find the TodoQ repository root directory
   */
  private findRepoRoot(): string {
    try {
      // Get current file path and go up to repo root
      const currentFile = fileURLToPath(import.meta.url);
      // From dist/cli/index.js (bundled) go up 2 levels to repo root
      // From src/services/claude/claude-service.ts go up 3 levels to repo root  
      const levels = currentFile.includes('dist/cli') ? '../..' : '../../..';
      const repoRoot = path.resolve(path.dirname(currentFile), levels);
      
      // Debug logging (only in development)
      if (process.env.DEBUG && process.env.NODE_ENV !== 'production') {
        console.log('Current file:', currentFile);
        console.log('Going up levels:', levels);
        console.log('Repo root:', repoRoot);
      }
      
      return repoRoot;
    } catch {
      // Fallback to current working directory
      return process.cwd();
    }
  }

  /**
   * Check if Claude is available in the system
   */
  async isAvailable(): Promise<boolean> {
    try {
      const claudePath = await this.configManager.getClaudePath();
      await execa(claudePath, ['--version'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.configManager.isVerbose();
  }

  /**
   * Execute steps 1-3: Get next task via todoq CLI calls
   */
  async executeTodoqGetNext(projectDir: string): Promise<TaskContext> {
    // Determine todoq CLI path based on environment
    const repoRoot = this.findRepoRoot();
    const isDevelopment = process.env.NODE_ENV !== 'production' && process.argv[1]?.includes('tsx');
    
    let todoqPath: string;
    let execCommand: string;
    let execArgs: string[];
    
    if (isDevelopment) {
      todoqPath = path.join(repoRoot, 'src', 'cli', 'index.ts');
      execCommand = 'npx';
      execArgs = ['tsx', todoqPath];
    } else {
      todoqPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
      execCommand = 'node';
      execArgs = [todoqPath];
    }
    
    // Verify the CLI exists
    if (!existsSync(todoqPath)) {
      throw new Error(`TodoQ CLI not found at ${todoqPath}. Please rebuild the project.`);
    }
    
    try {
      // Step 2: Directory setup & validation (todoq init)
      await execa(execCommand, [...execArgs, 'init'], { 
        cwd: projectDir,
        timeout: 30000 
      });

      // Step 3: Task discovery & status update
      const countResult = await execa(execCommand, [...execArgs, 'remaining', '--count'], { 
        cwd: projectDir,
        timeout: 10000 
      });
      
      const remainingCount = parseInt(countResult.stdout.trim());
      
      if (remainingCount === 0) {
        throw new Error('No remaining tasks found');
      }

      // Get current task JSON
      const taskResult = await execa(execCommand, [...execArgs, 'current', '--json'], { 
        cwd: projectDir,
        timeout: 10000 
      });

      const taskJson = JSON.parse(taskResult.stdout);

      // Mark task as in progress
      await execa(execCommand, [...execArgs, 'current', '--start'], { 
        cwd: projectDir,
        timeout: 10000 
      });

      return {
        taskJson,
        projectDir,
        remainingCount
      };
    } catch (error) {
      const err = error as any;
      
      // Provide specific error messages for common issues
      if (err.stderr?.includes('Database not initialized') || err.message?.includes('ENOENT')) {
        throw new Error(
          `TodoQ database not found in ${projectDir}. ` +
          `Please run 'todoq init' in the project directory first.`
        );
      }
      
      if (err.stderr?.includes('No remaining tasks') || err.stdout?.trim() === '0') {
        throw new Error(
          `No remaining tasks found in ${projectDir}. ` +
          `Add tasks using 'todoq import' or 'todoq insert' first.`
        );
      }
      
      if (err.code === 'ETIMEDOUT') {
        throw new Error(
          `Timeout while communicating with todoq CLI. ` +
          `Please check if the database is accessible.`
        );
      }
      
      // Generic error with more context
      const errorDetails = err.stderr || err.stdout || err.message || 'Unknown error';
      throw new Error(`Failed to get next task from ${projectDir}: ${errorDetails}`);
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Timeout errors are retryable
    if (error.timedOut || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Exit codes 1-2 are often transient errors (Claude execution errors)
    if (error.exitCode !== undefined && error.exitCode >= 1 && error.exitCode <= 2) {
      return true;
    }
    
    // Exit code 127 (command not found) is not retryable
    if (error.exitCode === 127) {
      return false;
    }
    
    // Permission errors are not retryable
    if (error.message?.toLowerCase().includes('permission denied') || 
        error.stderr?.toLowerCase().includes('permission denied')) {
      return false;
    }
    
    // ENOENT (file not found) is not retryable
    if (error.code === 'ENOENT') {
      return false;
    }
    
    // Default: don't retry unknown errors
    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.configManager.getRetryDelay();
    const multiplier = this.configManager.getRetryBackoffMultiplier();
    const maxDelay = this.configManager.getMaxRetryDelay();
    
    const delay = baseDelay * Math.pow(multiplier, attempt);
    return Math.min(delay, maxDelay);
  }

  /**
   * Execute Claude with prompt and handle retries
   */
  private async executeClaudeWithRetry(context: TaskContext, prompt: string): Promise<WorkTaskResult> {
    const startTime = Date.now();
    const maxRetries = this.configManager.getMaxRetries();
    let lastError: any = null;
    let totalOutput = '';
    let actualRetryCount = 0;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeClaudeOnce(context, prompt);
        
        // Add retry attempts to result
        return {
          ...result,
          duration: Date.now() - startTime,
          retryAttempts: attempt
        };
        
      } catch (error) {
        lastError = error;
        
        // Capture any output from failed attempt
        if ((error as any).stdout || (error as any).stderr) {
          totalOutput = (error as any).stdout || (error as any).stderr || '';
        }
        
        // This was a retry if attempt > 0
        if (attempt > 0) {
          actualRetryCount = attempt;
        }
        
        // Check if we should retry
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = this.calculateBackoffDelay(attempt);
          
          if (this.configManager.isVerbose()) {
            console.log(`\n⚠️  Claude execution failed (attempt ${attempt + 1}/${maxRetries + 1})`);
            console.log(`   Error: ${(error as any).message || 'Unknown error'}`);
            console.log(`   Retrying in ${delay}ms...\n`);
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // No more retries or non-retryable error
          break;
        }
      }
    }
    
    // All retries exhausted or non-retryable error
    const err = lastError as any;
    
    // Check if this is an execa error with exit code
    if (err.exitCode !== undefined && err.exitCode !== 0) {
      return {
        success: false,
        error: `Claude Code exited with code ${err.exitCode}. This is a Claude execution error, not a TodoQ error.`,
        output: totalOutput || err.stdout || err.stderr || '',
        duration: Date.now() - startTime,
        iterations: 1,
        retryAttempts: actualRetryCount
      };
    }
    
    return {
      success: false,
      error: err.message || 'Unknown error',
      output: totalOutput || err.stdout || err.stderr || '',
      duration: Date.now() - startTime,
      iterations: 1,
      retryAttempts: actualRetryCount
    };
  }

  /**
   * Execute Claude once (single attempt)
   */
  private async executeClaudeOnce(context: TaskContext, prompt: string): Promise<WorkTaskResult> {
    const startTime = Date.now();
    
    try {
      const claudePath = await this.configManager.getClaudePath();
      const cliArgs = this.configManager.buildCliArguments();

      const execOptions: any = {
        cwd: context.projectDir,
        timeout: this.configManager.getTimeout(),
        input: prompt
      };

      let allOutput = '';

      // Handle streaming vs non-streaming execution
      if (this.configManager.isStreaming()) {
        execOptions.buffer = false;
      }

      // Debug: log the command being executed
      if (this.configManager.isVerbose()) {
        console.log('DEBUG: Executing Claude command:', claudePath, cliArgs.join(' '));
      }
      
      const childProcess = execa(claudePath, cliArgs, execOptions);

      if (this.configManager.isStreaming()) {
        // Set up streaming output handlers
        childProcess.stdout?.on('data', (chunk) => {
          const text = chunk.toString();
          allOutput += text;
          if (this.configManager.isVerbose()) {
            this.displayVerboseOutput(text);
          }
        });

        childProcess.stderr?.on('data', (chunk) => {
          const text = chunk.toString();
          allOutput += text;
          console.error(text);
        });
      }

      const result = await childProcess;

      if (!this.configManager.isStreaming()) {
        allOutput = result.stdout || '';
      }

      const taskInfo = this.parseTaskInfo(allOutput);

      // Check if Claude exited with non-zero code
      if (result.exitCode !== 0) {
        const error = new Error(`Claude Code exited with code ${result.exitCode}`) as any;
        error.exitCode = result.exitCode;
        error.stdout = allOutput;
        throw error;
      }

      return {
        success: true,
        output: allOutput,
        duration: Date.now() - startTime,
        iterations: 1,
        ...taskInfo
      };
      
    } catch (error) {
      // Re-throw the error to be handled by retry logic
      throw error;
    }
  }

  /**
   * Execute steps 4-8: Work on task using Claude
   */
  async executeTodoqNextPrompt(context: TaskContext): Promise<WorkTaskResult> {
    const prompt = this.buildPrompt(context);
    return this.executeClaudeWithRetry(context, prompt);
  }

  /**
   * Build prompt for Claude execution with exact steps 4-8 content
   */
  private buildPrompt(context: TaskContext): string {
    try {
      // Load the prompt template from file
      const currentFile = fileURLToPath(import.meta.url);
      const promptPath = path.join(
        path.dirname(currentFile), 
        'prompts', 
        'task-execution.md'
      );
      
      let promptTemplate: string;
      
      if (existsSync(promptPath)) {
        // Read from file if it exists
        promptTemplate = readFileSync(promptPath, 'utf-8');
      } else {
        // Fallback to embedded prompt if file not found
        promptTemplate = this.getDefaultPromptTemplate();
      }
      
      // Replace placeholders with actual values
      return promptTemplate
        .replace('{{TASK_JSON}}', JSON.stringify(context.taskJson, null, 2))
        .replace('{{PROJECT_DIR}}', context.projectDir);
        
    } catch (error) {
      // If any error occurs, use the fallback embedded prompt
      console.warn('Warning: Could not load prompt template from file, using embedded default');
      return this.getDefaultPromptTemplate()
        .replace('{{TASK_JSON}}', JSON.stringify(context.taskJson, null, 2))
        .replace('{{PROJECT_DIR}}', context.projectDir);
    }
  }

  /**
   * Get default prompt template (fallback when file is not available)
   */
  private getDefaultPromptTemplate(): string {
    return `You are working on task: {{TASK_JSON}}
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
4. **No Skipping**: Every step must be explicitly marked complete in TodoWrite`;
  }

  /**
   * Parse task information from Claude output
   */
  private parseTaskInfo(output: string): Partial<WorkTaskResult> {
    const taskInfo: Partial<WorkTaskResult> = {};
    
    // Try to extract task number from output
    const taskNumberMatch = output.match(/task[:\s]+(\d+(?:\.\d+)*)/i);
    if (taskNumberMatch) {
      taskInfo.taskNumber = taskNumberMatch[1];
    }

    // Try to extract task name from output  
    const taskNameMatch = output.match(/task[^:]*:\s*([^\n]+)/i);
    if (taskNameMatch) {
      taskInfo.taskName = taskNameMatch[1].trim();
    }

    return taskInfo;
  }

  /**
   * Display human-readable verbose output from Claude's JSON stream
   */
  private displayVerboseOutput(jsonText: string): void {
    try {
      // Split by newlines and process each potential JSON object
      const lines = jsonText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('{')) continue;
        
        try {
          const parsed = JSON.parse(trimmed);
          
          // Display different types of messages
          if (parsed.type === 'assistant' && parsed.message) {
            const content = parsed.message.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'text' && item.text) {
                  console.log(`🤖 Claude: ${item.text}`);
                } else if (item.type === 'tool_use') {
                  const formattedInput = formatToolInput(item.name, item.input);
                  console.log(`🔧 Using ${item.name}:${formattedInput}`);
                }
              }
            }
          } else if (parsed.type === 'user' && parsed.message) {
            const content = parsed.message.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'tool_result' && !item.is_error) {
                  console.log(`✅ Tool result: ${item.content}`);
                } else if (item.type === 'tool_result' && item.is_error) {
                  console.log(`❌ Tool error: ${item.content}`);
                }
              }
            }
          } else if (parsed.type === 'result') {
            if (parsed.subtype === 'success') {
              console.log(`🎉 Final result: ${parsed.result}`);
            }
          }
        } catch (parseError) {
          // Ignore individual JSON parse errors, just skip that line
        }
      }
    } catch (error) {
      // Fallback to raw output if JSON parsing completely fails
      console.log(jsonText);
    }
  }
}

// Singleton pattern (mirrors tfq architecture)
let instance: ClaudeService | null = null;

/**
 * Get Claude service instance (singleton pattern)
 */
export function getClaudeService(configPath?: string, overridePath?: string, todoqConfig?: TodoqConfig): ClaudeService {
  if (!instance || configPath || overridePath || todoqConfig) {
    instance = new ClaudeService(configPath, overridePath, todoqConfig);
  }
  return instance;
}