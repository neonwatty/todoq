import { describe, it, expect, vi } from 'vitest';
import { ClaudeConfigManager } from '../../../../src/services/claude/config.js';
import type { ClaudeConfig } from '../../../../src/services/claude/types.js';

describe('ClaudeConfigManager Retry Configuration', () => {
  describe('retry configuration defaults', () => {
    it('should have correct default retry values', () => {
      const manager = new ClaudeConfigManager();
      const config = manager.getConfig();
      
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(2000);
      expect(config.retryBackoffMultiplier).toBe(2);
      expect(config.maxRetryDelay).toBe(15000);
    });

    it('should use getter methods correctly', () => {
      const manager = new ClaudeConfigManager();
      
      expect(manager.getMaxRetries()).toBe(3);
      expect(manager.getRetryDelay()).toBe(2000);
      expect(manager.getRetryBackoffMultiplier()).toBe(2);
      expect(manager.getMaxRetryDelay()).toBe(15000);
    });
  });

  describe('retry configuration validation', () => {
    it('should enforce minimum maxRetries of 0', () => {
      const manager = new ClaudeConfigManager({ maxRetries: -5 });
      expect(manager.getMaxRetries()).toBe(0);
    });

    it('should enforce maximum maxRetries of 10', () => {
      const manager = new ClaudeConfigManager({ maxRetries: 20 });
      expect(manager.getMaxRetries()).toBe(10);
    });

    it('should accept valid maxRetries values', () => {
      const manager1 = new ClaudeConfigManager({ maxRetries: 0 });
      expect(manager1.getMaxRetries()).toBe(0);
      
      const manager2 = new ClaudeConfigManager({ maxRetries: 5 });
      expect(manager2.getMaxRetries()).toBe(5);
      
      const manager3 = new ClaudeConfigManager({ maxRetries: 10 });
      expect(manager3.getMaxRetries()).toBe(10);
    });

    it('should enforce minimum retryDelay of 100ms', () => {
      const manager = new ClaudeConfigManager({ retryDelay: 50 });
      expect(manager.getRetryDelay()).toBe(100);
    });

    it('should accept valid retryDelay values', () => {
      const manager1 = new ClaudeConfigManager({ retryDelay: 100 });
      expect(manager1.getRetryDelay()).toBe(100);
      
      const manager2 = new ClaudeConfigManager({ retryDelay: 5000 });
      expect(manager2.getRetryDelay()).toBe(5000);
    });

    it('should enforce minimum retryBackoffMultiplier of 1', () => {
      const manager = new ClaudeConfigManager({ retryBackoffMultiplier: 0.5 });
      expect(manager.getRetryBackoffMultiplier()).toBe(1);
    });

    it('should accept valid retryBackoffMultiplier values', () => {
      const manager1 = new ClaudeConfigManager({ retryBackoffMultiplier: 1 });
      expect(manager1.getRetryBackoffMultiplier()).toBe(1);
      
      const manager2 = new ClaudeConfigManager({ retryBackoffMultiplier: 1.5 });
      expect(manager2.getRetryBackoffMultiplier()).toBe(1.5);
      
      const manager3 = new ClaudeConfigManager({ retryBackoffMultiplier: 3 });
      expect(manager3.getRetryBackoffMultiplier()).toBe(3);
    });

    it('should ensure maxRetryDelay is at least retryDelay', () => {
      const manager = new ClaudeConfigManager({ 
        retryDelay: 5000,
        maxRetryDelay: 2000 
      });
      expect(manager.getMaxRetryDelay()).toBe(5000);
    });

    it('should accept valid maxRetryDelay values', () => {
      const manager1 = new ClaudeConfigManager({ maxRetryDelay: 10000 });
      expect(manager1.getMaxRetryDelay()).toBe(10000);
      
      const manager2 = new ClaudeConfigManager({ 
        retryDelay: 1000,
        maxRetryDelay: 60000 
      });
      expect(manager2.getMaxRetryDelay()).toBe(60000);
    });
  });

  describe('retry configuration merging', () => {
    it('should properly merge partial retry config with defaults', () => {
      const manager = new ClaudeConfigManager({
        maxRetries: 5,
        retryDelay: 2000
        // retryBackoffMultiplier and maxRetryDelay should use defaults
      });
      
      expect(manager.getMaxRetries()).toBe(5);
      expect(manager.getRetryDelay()).toBe(2000);
      expect(manager.getRetryBackoffMultiplier()).toBe(2); // default
      expect(manager.getMaxRetryDelay()).toBe(15000); // default
    });

    it('should handle all retry config options together', () => {
      const config: Partial<ClaudeConfig> = {
        maxRetries: 7,
        retryDelay: 1500,
        retryBackoffMultiplier: 1.8,
        maxRetryDelay: 20000
      };
      
      const manager = new ClaudeConfigManager(config);
      
      expect(manager.getMaxRetries()).toBe(7);
      expect(manager.getRetryDelay()).toBe(1500);
      expect(manager.getRetryBackoffMultiplier()).toBe(1.8);
      expect(manager.getMaxRetryDelay()).toBe(20000);
    });
  });

  describe('edge cases and boundaries', () => {
    it('should handle undefined retry config gracefully', () => {
      const manager = new ClaudeConfigManager({
        maxRetries: undefined,
        retryDelay: undefined,
        retryBackoffMultiplier: undefined,
        maxRetryDelay: undefined
      });
      
      // Should use defaults when undefined
      expect(manager.getMaxRetries()).toBe(3);
      expect(manager.getRetryDelay()).toBe(2000);
      expect(manager.getRetryBackoffMultiplier()).toBe(2);
      expect(manager.getMaxRetryDelay()).toBe(15000);
    });

    it('should handle zero values appropriately', () => {
      const manager = new ClaudeConfigManager({
        maxRetries: 0,
        retryBackoffMultiplier: 0 // Should be corrected to 1
      });
      
      expect(manager.getMaxRetries()).toBe(0); // 0 is valid for no retries
      expect(manager.getRetryBackoffMultiplier()).toBe(1); // 0 corrected to 1
    });

    it('should handle very large delay values', () => {
      const manager = new ClaudeConfigManager({
        retryDelay: 1000000,
        maxRetryDelay: 5000000
      });
      
      expect(manager.getRetryDelay()).toBe(1000000);
      expect(manager.getMaxRetryDelay()).toBe(5000000);
    });
  });

  describe('integration with other config options', () => {
    it('should work alongside other Claude config options', () => {
      const config: Partial<ClaudeConfig> = {
        enabled: true,
        model: 'opus',
        verbose: true,
        dangerouslySkipPermissions: true,
        maxRetries: 3,
        retryDelay: 2000
      };
      
      const manager = new ClaudeConfigManager(config);
      const fullConfig = manager.getConfig();
      
      // Check other options are preserved
      expect(fullConfig.enabled).toBe(true);
      expect(fullConfig.model).toBe('opus');
      expect(fullConfig.verbose).toBe(true);
      expect(fullConfig.dangerouslySkipPermissions).toBe(true);
      
      // Check retry options
      expect(fullConfig.maxRetries).toBe(3);
      expect(fullConfig.retryDelay).toBe(2000);
    });
  });
});