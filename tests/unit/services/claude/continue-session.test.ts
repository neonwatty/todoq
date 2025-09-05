import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeConfigManager } from '../../../../src/services/claude/config.js';
import { ClaudeService } from '../../../../src/services/claude/claude-service.js';
import type { TodoqConfig } from '../../../../src/core/types.js';

describe('continueSession Configuration', () => {
  describe('ClaudeConfigManager continueSession handling', () => {
    it('should default continueSession to true', () => {
      const configManager = new ClaudeConfigManager();
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--continue');
    });

    it('should include --continue when continueSession is true', () => {
      const configManager = new ClaudeConfigManager({
        continueSession: true
      });
      
      const args = configManager.buildCliArguments();
      expect(args).toContain('--continue');
    });

    it('should not include --continue when continueSession is false', () => {
      const configManager = new ClaudeConfigManager({
        continueSession: false
      });
      
      const args = configManager.buildCliArguments();
      expect(args).not.toContain('--continue');
    });

    it('should respect continueSession setting in complex configuration', () => {
      const configManager = new ClaudeConfigManager({
        model: 'claude-3-opus-20240229',
        continueSession: false,
        verbose: true,
        maxTurns: 10
      });
      
      const args = configManager.buildCliArguments();
      
      // Should contain other options
      expect(args).toContain('--model');
      expect(args).toContain('claude-3-opus-20240229');
      expect(args).toContain('--verbose');
      // max-turns is not passed to Claude CLI (TodoQ internal config)
      expect(args).not.toContain('--max-turns');
      
      // But not --continue
      expect(args).not.toContain('--continue');
    });
  });

  describe('ClaudeService continueSession integration', () => {
    it('should pass continueSession from TodoqConfig to Claude service', () => {
      const todoqConfig: TodoqConfig = {
        database: {
          path: './.todoq/todoq.db',
          autoMigrate: true,
          walMode: true
        },
        display: {
          format: 'tree',
          colors: true,
          showCompleted: false
        },
        defaults: {
          status: 'pending',
          priority: 0
        },
        claude: {
          enabled: true,
          continueSession: false // Explicitly disable
        }
      };

      const claudeService = new ClaudeService(undefined, undefined, todoqConfig);
      
      // Access the configManager to verify the setting was passed through
      const config = (claudeService as any).configManager;
      const args = config.buildCliArguments();
      
      expect(args).not.toContain('--continue');
    });

    it('should use default continueSession when not specified in TodoqConfig', () => {
      const todoqConfig: TodoqConfig = {
        database: {
          path: './.todoq/todoq.db',
          autoMigrate: true,
          walMode: true
        },
        display: {
          format: 'tree',
          colors: true,
          showCompleted: false
        },
        defaults: {
          status: 'pending',
          priority: 0
        },
        claude: {
          enabled: true
          // continueSession not specified - should use default (true)
        }
      };

      const claudeService = new ClaudeService(undefined, undefined, todoqConfig);
      
      // Access the configManager to verify default was used
      const config = (claudeService as any).configManager;
      const args = config.buildCliArguments();
      
      expect(args).toContain('--continue');
    });

    it('should handle undefined claude config gracefully', () => {
      const todoqConfig: TodoqConfig = {
        database: {
          path: './.todoq/todoq.db',
          autoMigrate: true,
          walMode: true
        },
        display: {
          format: 'tree',
          colors: true,
          showCompleted: false
        },
        defaults: {
          status: 'pending',
          priority: 0
        }
        // claude config not provided
      };

      const claudeService = new ClaudeService(undefined, undefined, todoqConfig);
      
      // Should still work with default configuration
      const config = (claudeService as any).configManager;
      const args = config.buildCliArguments();
      
      // Should use the default value (true)
      expect(args).toContain('--continue');
    });
  });

  describe('Configuration validation', () => {
    it('should accept boolean values for continueSession', () => {
      const configManager1 = new ClaudeConfigManager({ continueSession: true });
      const configManager2 = new ClaudeConfigManager({ continueSession: false });
      
      expect(() => configManager1.buildCliArguments()).not.toThrow();
      expect(() => configManager2.buildCliArguments()).not.toThrow();
    });

    it('should handle undefined continueSession gracefully', () => {
      const configManager = new ClaudeConfigManager({ continueSession: undefined });
      
      expect(() => configManager.buildCliArguments()).not.toThrow();
      
      const args = configManager.buildCliArguments();
      // Should use default behavior (true)
      expect(args).toContain('--continue');
    });
  });

  describe('Real-world configuration scenarios', () => {
    it('should work correctly for multi-turn task completion (continueSession: true)', () => {
      const configManager = new ClaudeConfigManager({
        continueSession: true,
        maxTurns: 5,
        testTimeout: 300000
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).toContain('--continue');
      // max-turns is not passed to Claude CLI (TodoQ internal config)
      expect(args).not.toContain('--max-turns');
    });

    it('should work correctly for fresh sessions (continueSession: false)', () => {
      const configManager = new ClaudeConfigManager({
        continueSession: false,
        maxTurns: 1,  // Single turn when not continuing
        testTimeout: 180000
      });
      
      const args = configManager.buildCliArguments();
      
      expect(args).not.toContain('--continue');
      // max-turns is not passed to Claude CLI (TodoQ internal config)
      expect(args).not.toContain('--max-turns');
    });
  });
});