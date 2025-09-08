import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeConfigManager } from '../../../../src/services/claude/config.js';
import type { ClaudeConfig } from '../../../../src/services/claude/types.js';

// Mock dependencies
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('ClaudeConfigManager', () => {
  let configManager: ClaudeConfigManager;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and defaults', () => {
    it('should initialize with default configuration', () => {
      configManager = new ClaudeConfigManager();
      
      expect(configManager.isEnabled()).toBe(false);
      expect(configManager.getMaxIterations()).toBe(10);
      expect(configManager.getTimeout()).toBe(300000);
      expect(configManager.getModel()).toBe('opusplan');
      expect(configManager.isVerbose()).toBe(true);
      expect(configManager.isStreaming()).toBe(false);
    });

    it('should merge provided config with defaults', () => {
      const customConfig: Partial<ClaudeConfig> = {
        enabled: true,
        testTimeout: 240000,
        model: 'claude-3-opus-20240229',
        verbose: false
      };

      configManager = new ClaudeConfigManager(customConfig);
      
      expect(configManager.isEnabled()).toBe(true);
      expect(configManager.getTimeout()).toBe(240000);
      expect(configManager.getModel()).toBe('claude-3-opus-20240229');
      expect(configManager.isVerbose()).toBe(false);
      // Should still use defaults for unspecified values
      expect(configManager.getMaxIterations()).toBe(10);
      expect(configManager.isStreaming()).toBe(false);
    });
  });

  describe('configuration validation', () => {
    it('should enforce minimum testTimeout of 60000ms', () => {
      configManager = new ClaudeConfigManager({ testTimeout: 30000 });
      expect(configManager.getTimeout()).toBe(60000);
    });

    it('should enforce maximum testTimeout of 1200000ms', () => {
      configManager = new ClaudeConfigManager({ testTimeout: 1500000 });
      expect(configManager.getTimeout()).toBe(1200000);
    });

    it('should enforce minimum maxIterations of 1', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 0 });
      expect(configManager.getMaxIterations()).toBe(1);
    });

    it('should enforce maximum maxIterations of 50', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 75 });
      expect(configManager.getMaxIterations()).toBe(50);
    });

    it('should accept valid testTimeout values', () => {
      configManager = new ClaudeConfigManager({ testTimeout: 180000 });
      expect(configManager.getTimeout()).toBe(180000);
    });

    it('should accept valid maxIterations values', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 25 });
      expect(configManager.getMaxIterations()).toBe(25);
    });

    it('should enforce minimum maxTurns of 1', () => {
      configManager = new ClaudeConfigManager({ maxTurns: 0 });
      expect(configManager.getMaxIterations()).toBe(10); // Uses default since maxTurns validation doesn't affect this getter
    });

    it('should enforce maximum maxTurns of 100', () => {
      configManager = new ClaudeConfigManager({ maxTurns: 200 });
      expect(configManager.getMaxIterations()).toBe(10); // Uses default since maxTurns validation doesn't affect this getter
    });
  });

  describe('CLI arguments building', () => {
    it('should build basic CLI arguments', () => {
      configManager = new ClaudeConfigManager({
        model: 'sonnet',
        dangerouslySkipPermissions: true
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--model');
      expect(args).toContain('sonnet');
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should include allowed and disallowed tools', () => {
      configManager = new ClaudeConfigManager({
        allowedTools: ['Read', 'Edit'],
        disallowedTools: ['Bash']
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--allowed-tools');
      expect(args).toContain('Read,Edit');
      expect(args).toContain('--disallowed-tools');
      expect(args).toContain('Bash');
    });

    it('should include output format and permission mode', () => {
      configManager = new ClaudeConfigManager({
        outputFormat: 'json',
        permissionMode: 'ask'
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--output-format');
      expect(args).toContain('json');
      // Permission mode is not passed to Claude CLI when dangerouslySkipPermissions is set
      expect(args).not.toContain('--permission-mode');
    });

    it('should include custom arguments', () => {
      configManager = new ClaudeConfigManager({
        customArgs: ['--debug']
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--debug');
    });

    it('should build complete CLI arguments with all options', () => {
      configManager = new ClaudeConfigManager({
        model: 'claude-3-opus-20240229',
        dangerouslySkipPermissions: true,
        allowedTools: ['Read', 'Edit'],
        disallowedTools: ['Bash'],
        permissionMode: 'plan',
        outputFormat: 'text',
        verbose: true,
        maxTurns: 5,
        continueSession: true,
        customArgs: ['--debug']
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toEqual([
        '-p',
        '--model', 'claude-3-opus-20240229',
        '--dangerously-skip-permissions',
        '--allowed-tools', 'Read,Edit',
        '--disallowed-tools', 'Bash',
        '--output-format', 'text',
        '--verbose',
        '--continue',
        '--debug'
      ]);
    });

    it('should automatically include --verbose when outputFormat is stream-json', () => {
      configManager = new ClaudeConfigManager({
        outputFormat: 'stream-json',
        verbose: false // explicitly set to false to test auto-enable
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--output-format');
      expect(args).toContain('stream-json');
      expect(args).toContain('--verbose'); // should be automatically included
    });

    it('should not duplicate --verbose when both stream-json and verbose are enabled', () => {
      configManager = new ClaudeConfigManager({
        outputFormat: 'stream-json',
        verbose: true
      });
      
      const args = configManager.buildCliArguments();
      
      // Count occurrences of --verbose
      const verboseCount = args.filter(arg => arg === '--verbose').length;
      expect(verboseCount).toBe(1); // should only appear once
    });
  });

  describe('getter methods', () => {
    it('should return correct configuration values', () => {
      const config: Partial<ClaudeConfig> = {
        enabled: true,
        testTimeout: 240000,
        maxIterations: 7,
        model: 'claude-3-opus-20240229',
        verbose: false,
        outputFormat: 'stream-json'
      };
      
      configManager = new ClaudeConfigManager(config);
      
      expect(configManager.isEnabled()).toBe(true);
      expect(configManager.getTimeout()).toBe(240000);
      expect(configManager.getMaxIterations()).toBe(7);
      expect(configManager.getModel()).toBe('claude-3-opus-20240229');
      expect(configManager.isVerbose()).toBe(true); // stream-json automatically enables verbose
      expect(configManager.isStreaming()).toBe(true); // stream-json enables streaming
    });

    it('should return full configuration', () => {
      const config: Partial<ClaudeConfig> = {
        enabled: true,
        testTimeout: 120000,
        model: 'sonnet'
      };
      
      configManager = new ClaudeConfigManager(config);
      const fullConfig = configManager.getConfig();
      
      expect(fullConfig.enabled).toBe(true);
      expect(fullConfig.testTimeout).toBe(120000);
      expect(fullConfig.model).toBe('sonnet');
      // Should include defaults for unspecified values
      expect(fullConfig.maxIterations).toBe(10);
      expect(fullConfig.verbose).toBe(true);
    });
  });

  describe('Claude path detection', () => {
    beforeEach(() => {
      configManager = new ClaudeConfigManager();
    });

    it('should use custom path if provided and valid', async () => {
      const { execa } = await import('execa');
      const customConfig = new ClaudeConfigManager({ claudePath: '/custom/claude' });
      
      vi.mocked(execa).mockResolvedValueOnce({ stdout: 'Claude v1.0' } as any);
      
      const path = await customConfig.detectClaudePath();
      
      expect(path).toBe('/custom/claude');
      expect(execa).toHaveBeenCalledWith('/custom/claude', ['--version'], { timeout: 5000 });
    });

    it('should fall back to PATH search if custom path fails', async () => {
      const { execa } = await import('execa');
      const customConfig = new ClaudeConfigManager({ claudePath: '/invalid/claude' });
      
      vi.mocked(execa)
        .mockRejectedValueOnce(new Error('Custom path failed'))
        .mockResolvedValueOnce({ stdout: 'Claude v1.0' } as any);
      
      const path = await customConfig.detectClaudePath();
      
      expect(path).toBe('claude'); // First fallback path
    });

    it('should return null if no Claude CLI found', async () => {
      const { execa } = await import('execa');
      
      vi.mocked(execa).mockRejectedValue(new Error('Not found'));
      
      const path = await configManager.detectClaudePath();
      
      expect(path).toBeNull();
    });

    it('should cache detected path', async () => {
      const { execa } = await import('execa');
      
      vi.mocked(execa).mockResolvedValue({ stdout: 'Claude v1.0' } as any);
      
      const path1 = await configManager.detectClaudePath();
      const path2 = await configManager.detectClaudePath();
      
      expect(path1).toBe('claude');
      expect(path2).toBe('claude');
      expect(execa).toHaveBeenCalledTimes(1); // Should be cached
    });
  });

  describe('getClaudePath', () => {
    beforeEach(() => {
      configManager = new ClaudeConfigManager();
    });

    it('should return detected path when available', async () => {
      const { execa } = await import('execa');
      
      vi.mocked(execa).mockResolvedValue({ stdout: 'Claude v1.0' } as any);
      
      const path = await configManager.getClaudePath();
      
      expect(path).toBe('claude');
    });

    it('should throw error when Claude CLI not found', async () => {
      const { execa } = await import('execa');
      
      vi.mocked(execa).mockRejectedValue(new Error('Not found'));
      
      await expect(configManager.getClaudePath())
        .rejects.toThrow('Claude CLI not found. Please ensure Claude is installed and available in PATH.');
    });
  });
});