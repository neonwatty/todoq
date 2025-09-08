import { homedir } from 'os';
import path from 'path';
import { execa } from 'execa';
import type { ClaudeConfig } from './types.js';

/**
 * Configuration manager for Claude service
 */
export class ClaudeConfigManager {
  private config: ClaudeConfig;
  private claudePath: string | null = null;

  constructor(config?: Partial<ClaudeConfig>) {
    // Filter out undefined values from config
    const cleanConfig = config ? Object.fromEntries(
      Object.entries(config).filter(([_, v]) => v !== undefined)
    ) as Partial<ClaudeConfig> : {};
    
    this.config = { ...this.getDefaults(), ...cleanConfig };
    this.validateConfig();
  }

  /**
   * Get default configuration values (matching tfq defaults)
   */
  private getDefaults(): ClaudeConfig {
    return {
      enabled: false,
      maxIterations: 10,
      testTimeout: 300000, // 5 minutes (300000ms within 1-10 min range)
      
      // Security & Permissions
      dangerouslySkipPermissions: true, // Skip all permission prompts for full automation
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
      disallowedTools: [],
      permissionMode: 'bypassPermissions', // Bypass all permissions for maximum automation
      
      // Output & Behavior  
      outputFormat: 'text',
      verbose: true,
      maxTurns: 5,
      model: 'opusplan',
      
      // Advanced Options
      addDir: [],
      appendSystemPrompt: '',
      continueSession: true, // Needed for multi-turn task completion
      customArgs: [],
      
      // Retry Configuration
      maxRetries: 3, // Default: 3 retries for basic resilience
      retryDelay: 2000, // Default: 2 second initial delay
      retryBackoffMultiplier: 2, // Default: exponential backoff with factor of 2
      maxRetryDelay: 15000 // Default: cap at 15 seconds
    };
  }

  /**
   * Validate configuration values (matching tfq validation)
   */
  private validateConfig(): void {
    // Validate testTimeout (1-20 minutes: 60000-1200000ms)
    if (this.config.testTimeout !== undefined) {
      if (this.config.testTimeout < 60000) {
        this.config.testTimeout = 60000; // Minimum 1 minute
      }
      if (this.config.testTimeout > 1200000) {
        this.config.testTimeout = 1200000; // Maximum 20 minutes
      }
    }
    
    // Validate maxIterations
    if (this.config.maxIterations !== undefined && this.config.maxIterations < 1) {
      this.config.maxIterations = 1; // Minimum 1 iteration
    }
    
    if (this.config.maxIterations !== undefined && this.config.maxIterations > 50) {
      this.config.maxIterations = 50; // Maximum 50 iterations
    }
    
    // Validate maxTurns
    if (this.config.maxTurns !== undefined && this.config.maxTurns < 1) {
      this.config.maxTurns = 1; // Minimum 1 turn
    }
    
    if (this.config.maxTurns !== undefined && this.config.maxTurns > 100) {
      this.config.maxTurns = 100; // Maximum 100 turns
    }
    
    // Validate retry configuration
    if (this.config.maxRetries !== undefined && this.config.maxRetries < 0) {
      this.config.maxRetries = 0; // Minimum 0 retries
    }
    
    if (this.config.maxRetries !== undefined && this.config.maxRetries > 10) {
      this.config.maxRetries = 10; // Maximum 10 retries
    }
    
    if (this.config.retryDelay !== undefined && this.config.retryDelay < 100) {
      this.config.retryDelay = 100; // Minimum 100ms delay
    }
    
    if (this.config.retryBackoffMultiplier !== undefined && this.config.retryBackoffMultiplier < 1) {
      this.config.retryBackoffMultiplier = 1; // Minimum multiplier of 1 (no backoff)
    }
    
    if (this.config.maxRetryDelay !== undefined && this.config.maxRetryDelay < this.config.retryDelay!) {
      this.config.maxRetryDelay = this.config.retryDelay; // Max delay should be at least initial delay
    }
    
    // Ensure arrays are initialized
    if (!this.config.allowedTools) {
      this.config.allowedTools = [];
    }
    if (!this.config.disallowedTools) {
      this.config.disallowedTools = [];
    }
    if (!this.config.addDir) {
      this.config.addDir = [];
    }
    if (!this.config.customArgs) {
      this.config.customArgs = [];
    }
  }

  /**
   * Detect Claude CLI path from various locations
   */
  async detectClaudePath(): Promise<string | null> {
    if (this.claudePath) {
      return this.claudePath;
    }

    // Check if custom path is provided
    if (this.config.claudePath) {
      try {
        await execa(this.config.claudePath, ['--version'], { timeout: 5000 });
        this.claudePath = this.config.claudePath;
        return this.claudePath;
      } catch {
        // Continue to other paths if custom path fails
      }
    }

    // Try common locations
    const possiblePaths = [
      'claude', // In PATH
      path.join(homedir(), '.claude', 'local', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      process.env.CLAUDE_PATH
    ].filter(Boolean) as string[];

    for (const claudePath of possiblePaths) {
      try {
        await execa(claudePath, ['--version'], { timeout: 5000 });
        this.claudePath = claudePath;
        return this.claudePath;
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Build CLI arguments for Claude execution (tfq-style)
   */
  buildCliArguments(): string[] {
    const args: string[] = [];

    // Required for non-interactive operation with output format
    args.push('-p');

    // Model
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Security & Permissions
    if (this.config.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    if (this.config.allowedTools && this.config.allowedTools.length > 0) {
      args.push('--allowed-tools', this.config.allowedTools.join(','));
    }

    if (this.config.disallowedTools && this.config.disallowedTools.length > 0) {
      args.push('--disallowed-tools', this.config.disallowedTools.join(','));
    }

    // Note: when dangerouslySkipPermissions is true, we skip permission-mode to avoid conflicts

    // Output & Behavior
    if (this.config.outputFormat) {
      args.push('--output-format', this.config.outputFormat);
    }

    if (this.config.verbose) {
      args.push('--verbose');
    }

    // Note: maxTurns, maxIterations, and testTimeout are TodoQ-internal config
    // They are not passed to Claude CLI as they don't support these options

    // Advanced Options
    if (this.config.addDir && this.config.addDir.length > 0) {
      this.config.addDir.forEach(dir => {
        args.push('--add-dir', dir);
      });
    }

    if (this.config.appendSystemPrompt) {
      args.push('--append-system-prompt', this.config.appendSystemPrompt);
    }

    if (this.config.continueSession !== false) {
      args.push('--continue');
    }

    // Custom arguments
    if (this.config.customArgs && this.config.customArgs.length > 0) {
      args.push(...this.config.customArgs);
    }

    return args;
  }

  /**
   * Get Claude CLI path
   */
  async getClaudePath(): Promise<string> {
    const path = await this.detectClaudePath();
    if (!path) {
      throw new Error('Claude CLI not found. Please ensure Claude is installed and available in PATH.');
    }
    return path;
  }

  /**
   * Get timeout value (using testTimeout for tfq compatibility)
   */
  getTimeout(): number {
    return this.config.testTimeout || 300000; // Default 5 minutes
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.config.verbose || false;
  }

  /**
   * Check if streaming is enabled (based on outputFormat)
   */
  isStreaming(): boolean {
    return this.config.outputFormat === 'stream-json';
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.config.model || 'sonnet';
  }

  /**
   * Get max iterations
   */
  getMaxIterations(): number {
    return this.config.maxIterations || 3;
  }

  /**
   * Check if Claude is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled || false;
  }

  /**
   * Get max retries
   */
  getMaxRetries(): number {
    return this.config.maxRetries || 0;
  }

  /**
   * Get retry delay
   */
  getRetryDelay(): number {
    return this.config.retryDelay || 1000;
  }

  /**
   * Get retry backoff multiplier
   */
  getRetryBackoffMultiplier(): number {
    return this.config.retryBackoffMultiplier || 2;
  }

  /**
   * Get max retry delay
   */
  getMaxRetryDelay(): number {
    return this.config.maxRetryDelay || 30000;
  }

  /**
   * Get full configuration
   */
  getConfig(): ClaudeConfig {
    return { ...this.config };
  }
}