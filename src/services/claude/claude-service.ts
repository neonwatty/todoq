import { execa } from 'execa';
import path from 'path';
import { ClaudeConfigManager } from './config.js';
import type { ClaudeConfig, WorkTaskResult, TaskContext } from './types.js';

/**
 * Claude service for executing todoq work-next tasks
 */
export class ClaudeService {
  private configManager: ClaudeConfigManager;

  constructor(configPath?: string, overrideClaudePath?: string) {
    // Initialize configuration
    const config: Partial<ClaudeConfig> = {};
    
    if (overrideClaudePath) {
      config.claudePath = overrideClaudePath;
    }

    // TODO: Load config from configPath when configuration integration is complete
    this.configManager = new ClaudeConfigManager(config);
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
   * Execute steps 1-3: Get next task via todoq CLI calls
   */
  async executeTodoqGetNext(projectDir: string): Promise<TaskContext> {
    // Get todoq CLI path - use dev version for now due to bundling issues
    const todoqPath = path.join(process.cwd(), 'src', 'cli', 'index.ts');
    
    try {
      // Step 2: Directory setup & validation (todoq init)
      await execa('npx', ['tsx', todoqPath, 'init'], { 
        cwd: projectDir,
        timeout: 30000 
      });

      // Step 3: Task discovery & status update
      const countResult = await execa('npx', ['tsx', todoqPath, 'remaining', '--count'], { 
        cwd: projectDir,
        timeout: 10000 
      });
      
      const remainingCount = parseInt(countResult.stdout.trim());
      
      if (remainingCount === 0) {
        throw new Error('No remaining tasks found');
      }

      // Get current task JSON
      const taskResult = await execa('npx', ['tsx', todoqPath, 'current', '--json'], { 
        cwd: projectDir,
        timeout: 10000 
      });

      const taskJson = JSON.parse(taskResult.stdout);

      // Mark task as in progress
      await execa('npx', ['tsx', todoqPath, 'current', '--start'], { 
        cwd: projectDir,
        timeout: 10000 
      });

      return {
        taskJson,
        projectDir,
        remainingCount
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to get next task: ${err.message}`);
    }
  }

  /**
   * Execute steps 4-8: Work on task using Claude
   */
  async executeTodoqNextPrompt(context: TaskContext): Promise<WorkTaskResult> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildPrompt(context);
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

      const childProcess = execa(claudePath, cliArgs, execOptions);

      if (this.configManager.isStreaming()) {
        // Set up streaming output handlers
        childProcess.stdout?.on('data', (chunk) => {
          const text = chunk.toString();
          allOutput += text;
          if (this.configManager.isVerbose()) {
            console.log(text);
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

      return {
        success: result.exitCode === 0,
        output: allOutput,
        duration: Date.now() - startTime,
        iterations: 1,
        ...taskInfo
      };

    } catch (error) {
      const err = error as any;
      return {
        success: false,
        error: err.message || 'Unknown error',
        output: err.stdout || err.stderr || '',
        duration: Date.now() - startTime,
        iterations: 1
      };
    }
  }

  /**
   * Build prompt for Claude execution with exact steps 4-8 content
   */
  private buildPrompt(context: TaskContext): string {
    return `You are working on task: ${JSON.stringify(context.taskJson, null, 2)}
Project directory: ${context.projectDir}

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
}

// Singleton pattern (mirrors tfq architecture)
let instance: ClaudeService | null = null;

/**
 * Get Claude service instance (singleton pattern)
 */
export function getClaudeService(configPath?: string, overridePath?: string): ClaudeService {
  if (!instance || configPath || overridePath) {
    instance = new ClaudeService(configPath, overridePath);
  }
  return instance;
}