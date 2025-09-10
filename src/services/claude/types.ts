/**
 * Configuration interface for Claude service (matching tfq structure)
 */
export interface ClaudeConfig {
  /** Whether Claude integration is enabled */
  enabled: boolean;
  /** Path to Claude CLI executable */
  claudePath?: string;
  /** Maximum iterations for Claude execution */
  maxIterations?: number;
  /** Test timeout in milliseconds (15-60 minutes: 900000-3600000ms) */
  testTimeout?: number;
  
  // Security & Permissions
  /** Skip permission prompts (dev mode) */
  dangerouslySkipPermissions?: boolean;
  /** Allowed tools without prompts */
  allowedTools?: string[];
  /** Explicitly denied tools */
  disallowedTools?: string[];
  /** Permission handling mode */
  permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
  
  // Output & Behavior  
  /** Output format */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** Enable detailed logging */
  verbose?: boolean;
  /** Limit conversation turns */
  maxTurns?: number;
  /** Claude model (sonnet|opus|full-model-name) */
  model?: string;
  
  // Advanced Options
  /** Additional working directories */
  addDir?: string[];
  /** Append to system prompt */
  appendSystemPrompt?: string;
  /** Resume most recent conversation */
  continueSession?: boolean;
  /** Any additional CLI arguments */
  customArgs?: string[];
  
  // Retry Configuration
  /** Maximum number of retry attempts (default: 0, no retries) */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  retryBackoffMultiplier?: number;
  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxRetryDelay?: number;
}

/**
 * Result of work task execution
 */
export interface WorkTaskResult {
  /** Whether the task execution was successful */
  success: boolean;
  /** Task number if available */
  taskNumber?: string;
  /** Task name if available */
  taskName?: string;
  /** Error message if execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration: number;
  /** Number of iterations performed */
  iterations: number;
  /** Output from Claude execution */
  output?: string;
  /** Number of retry attempts made (0 if no retries) */
  retryAttempts?: number;
}

/**
 * Context information for task execution
 */
export interface TaskContext {
  /** JSON representation of the task */
  taskJson: any;
  /** Project directory path */
  projectDir: string;
  /** Number of remaining tasks */
  remainingCount: number;
}