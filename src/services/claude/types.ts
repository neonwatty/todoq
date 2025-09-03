/**
 * Configuration interface for Claude service
 */
export interface ClaudeConfig {
  /** Whether Claude integration is enabled */
  enabled: boolean;
  /** Path to Claude CLI executable */
  claudePath?: string;
  /** Maximum iterations for Claude execution */
  maxIterations?: number;
  /** Timeout in milliseconds for Claude execution */
  timeout?: number;
  /** Claude model to use */
  model?: string;
  /** Enable verbose output */
  verbose?: boolean;
  /** Enable streaming output */
  streaming?: boolean;
  /** Custom prompt template */
  prompt?: string;
  /** Allowed tools for Claude */
  allowedTools?: string[];
  /** Custom CLI arguments */
  customArgs?: string[];
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