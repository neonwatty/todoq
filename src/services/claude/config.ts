import { existsSync } from 'fs';
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
    this.config = { ...this.getDefaults(), ...config };
    this.validateConfig();
  }

  /**
   * Get default configuration values
   */
  private getDefaults(): ClaudeConfig {
    return {
      enabled: false,
      maxIterations: 3,
      timeout: 180000, // 3 minutes
      model: 'claude-3-5-sonnet-20241022',
      verbose: false,
      streaming: false,
      prompt: '',
      allowedTools: ['Read', 'Edit', 'Bash', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite'],
      customArgs: []
    };
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    if (this.config.timeout && this.config.timeout < 1000) {
      this.config.timeout = 1000; // Minimum 1 second
    }
    
    if (this.config.maxIterations !== undefined && this.config.maxIterations < 1) {
      this.config.maxIterations = 1; // Minimum 1 iteration
    }
    
    if (this.config.maxIterations !== undefined && this.config.maxIterations > 10) {
      this.config.maxIterations = 10; // Maximum 10 iterations
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
   * Build CLI arguments for Claude execution
   */
  buildCliArguments(): string[] {
    const args: string[] = [];

    // Add model if specified
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Add allowed tools
    if (this.config.allowedTools && this.config.allowedTools.length > 0) {
      args.push('--allowed-tools', this.config.allowedTools.join(','));
    }

    // Add custom arguments
    if (this.config.customArgs && this.config.customArgs.length > 0) {
      args.push(...this.config.customArgs);
    }

    // Add safety flags
    args.push('--dangerously-skip-permissions');

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
   * Get timeout value
   */
  getTimeout(): number {
    return this.config.timeout || 180000;
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose(): boolean {
    return this.config.verbose || false;
  }

  /**
   * Check if streaming is enabled
   */
  isStreaming(): boolean {
    return this.config.streaming || false;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.config.model || 'claude-3-5-sonnet-20241022';
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
   * Get full configuration
   */
  getConfig(): ClaudeConfig {
    return { ...this.config };
  }
}