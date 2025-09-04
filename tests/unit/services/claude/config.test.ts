import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeConfigManager } from '../../../../src/services/claude/config.js';
import type { ClaudeConfig } from '../../../../src/services/claude/types.js';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('ClaudeConfigManager', () => {
  let configManager: ClaudeConfigManager;
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor and defaults', () => {
    it('should initialize with default configuration', () => {
      configManager = new ClaudeConfigManager();
      
      expect(configManager.isEnabled()).toBe(false);
      expect(configManager.getMaxIterations()).toBe(3);
      expect(configManager.getTimeout()).toBe(180000);
      expect(configManager.getModel()).toBe('claude-3-5-sonnet-20241022');
      expect(configManager.isVerbose()).toBe(false);
      expect(configManager.isStreaming()).toBe(false);
    });

    it('should merge provided config with defaults', () => {
      const customConfig: Partial<ClaudeConfig> = {
        enabled: true,
        timeout: 240000,
        model: 'claude-3-opus-20240229',
        verbose: true
      };

      configManager = new ClaudeConfigManager(customConfig);
      
      expect(configManager.isEnabled()).toBe(true);
      expect(configManager.getTimeout()).toBe(240000);
      expect(configManager.getModel()).toBe('claude-3-opus-20240229');
      expect(configManager.isVerbose()).toBe(true);
      // Should still use defaults for unspecified values
      expect(configManager.getMaxIterations()).toBe(3);
      expect(configManager.isStreaming()).toBe(false);
    });
  });

  describe('configuration validation', () => {
    it('should enforce minimum timeout of 1000ms', () => {
      configManager = new ClaudeConfigManager({ timeout: 500 });
      expect(configManager.getTimeout()).toBe(1000);
    });

    it('should enforce minimum maxIterations of 1', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 0 });
      expect(configManager.getMaxIterations()).toBe(1);
    });

    it('should enforce maximum maxIterations of 10', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 15 });
      expect(configManager.getMaxIterations()).toBe(10);
    });

    it('should accept valid timeout values', () => {
      configManager = new ClaudeConfigManager({ timeout: 300000 });
      expect(configManager.getTimeout()).toBe(300000);
    });

    it('should accept valid maxIterations values', () => {
      configManager = new ClaudeConfigManager({ maxIterations: 5 });
      expect(configManager.getMaxIterations()).toBe(5);
    });
  });

  describe('CLI arguments building', () => {
    it('should build basic CLI arguments', () => {
      configManager = new ClaudeConfigManager({
        model: 'claude-3-sonnet-20240229'
      });

      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--model');
      expect(args).toContain('claude-3-sonnet-20240229');
      expect(args).toContain('--dangerously-skip-permissions');
    });

    it('should include allowed tools', () => {
      configManager = new ClaudeConfigManager({
        allowedTools: ['Read', 'Edit', 'Bash']
      });

      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--allowed-tools');
      expect(args).toContain('Read,Edit,Bash');
    });

    it('should include custom arguments', () => {
      configManager = new ClaudeConfigManager({
        customArgs: ['--debug', '--timeout', '60']
      });

      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--debug');
      expect(args).toContain('--timeout');
      expect(args).toContain('60');
    });

    it('should build complete CLI arguments with all options', () => {
      configManager = new ClaudeConfigManager({
        model: 'claude-3-opus-20240229',
        allowedTools: ['Read', 'Edit'],
        customArgs: ['--debug']
      });

      const args = configManager.buildCliArguments();
      
      expect(args).toEqual([
        '--model', 'claude-3-opus-20240229',
        '--allowed-tools', 'Read,Edit',
        '--debug',
        '--dangerously-skip-permissions'
      ]);
    });
  });

  describe('getter methods', () => {
    beforeEach(() => {
      configManager = new ClaudeConfigManager({
        enabled: true,
        maxIterations: 5,
        timeout: 300000,
        model: 'claude-3-opus-20240229',
        verbose: true,
        streaming: true,
        allowedTools: ['Read', 'Edit', 'Bash'],
        customArgs: ['--debug']
      });
    });

    it('should return correct configuration values', () => {
      expect(configManager.isEnabled()).toBe(true);
      expect(configManager.getMaxIterations()).toBe(5);
      expect(configManager.getTimeout()).toBe(300000);
      expect(configManager.getModel()).toBe('claude-3-opus-20240229');
      expect(configManager.isVerbose()).toBe(true);
      expect(configManager.isStreaming()).toBe(true);
    });

    it('should return full configuration', () => {
      const config = configManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.maxIterations).toBe(5);
      expect(config.timeout).toBe(300000);
      expect(config.model).toBe('claude-3-opus-20240229');
      expect(config.verbose).toBe(true);
      expect(config.streaming).toBe(true);
      expect(config.allowedTools).toEqual(['Read', 'Edit', 'Bash']);
      expect(config.customArgs).toEqual(['--debug']);
    });
  });

  describe('Claude path detection', () => {
    it('should use custom path if provided and valid', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);

      configManager = new ClaudeConfigManager({
        claudePath: '/custom/path/claude'
      });

      const path = await configManager.detectClaudePath();
      expect(path).toBe('/custom/path/claude');
      expect(execa).toHaveBeenCalledWith('/custom/path/claude', ['--version'], { timeout: 5000 });
    });

    it('should fall back to PATH search if custom path fails', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa)
        .mockRejectedValueOnce(new Error('Custom path failed'))
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);

      configManager = new ClaudeConfigManager({
        claudePath: '/invalid/path/claude'
      });

      const path = await configManager.detectClaudePath();
      expect(path).toBe('claude');
    });

    it('should return null if no Claude CLI found', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      configManager = new ClaudeConfigManager();

      const path = await configManager.detectClaudePath();
      expect(path).toBeNull();
    });

    it('should cache detected path', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue({ stdout: 'Claude CLI v1.0.0' } as any);

      configManager = new ClaudeConfigManager();

      const path1 = await configManager.detectClaudePath();
      const path2 = await configManager.detectClaudePath();
      
      expect(path1).toBe(path2);
      expect(execa).toHaveBeenCalledTimes(1); // Should only call once due to caching
    });
  });

  describe('getClaudePath', () => {
    it('should return detected path when available', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValue({ stdout: 'Claude CLI v1.0.0' } as any);

      configManager = new ClaudeConfigManager();

      const path = await configManager.getClaudePath();
      expect(path).toBe('claude');
    });

    it('should throw error when Claude CLI not found', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      configManager = new ClaudeConfigManager();

      await expect(configManager.getClaudePath()).rejects.toThrow(
        'Claude CLI not found. Please ensure Claude is installed and available in PATH.'
      );
    });
  });
});