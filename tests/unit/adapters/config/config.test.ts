import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, getDefaultConfig } from '../../../../src/adapters/config/index.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

describe('Config Loading and Merging', () => {
  const testConfigPath = path.join(os.tmpdir(), 'test-todoqrc.json');

  afterEach(() => {
    // Clean up test config file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('appendSystemPrompt override behavior', () => {
    it('should use default appendSystemPrompt when not specified', async () => {
      const config = await loadConfig();
      const defaultConfig = getDefaultConfig();
      
      expect(config.claude?.appendSystemPrompt).toBe(defaultConfig.claude?.appendSystemPrompt);
      expect(config.claude?.appendSystemPrompt).toContain('TodoQ Task Execution Guidelines');
    });

    it('should override appendSystemPrompt when user provides custom value', async () => {
      const customPrompt = 'My custom instructions for Claude';
      const customConfig = {
        claude: {
          appendSystemPrompt: customPrompt
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      
      expect(config.claude?.appendSystemPrompt).toBe(customPrompt);
      expect(config.claude?.appendSystemPrompt).not.toContain('TodoQ Task Execution Guidelines');
    });

    it('should allow empty appendSystemPrompt', async () => {
      const customConfig = {
        claude: {
          appendSystemPrompt: ''
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      
      expect(config.claude?.appendSystemPrompt).toBe('');
    });

    it('should preserve other claude settings when overriding appendSystemPrompt', async () => {
      const customConfig = {
        claude: {
          appendSystemPrompt: 'Custom prompt',
          maxIterations: 20,
          verbose: true
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      const defaultConfig = getDefaultConfig();
      
      // Custom values should be used
      expect(config.claude?.appendSystemPrompt).toBe('Custom prompt');
      expect(config.claude?.maxIterations).toBe(20);
      expect(config.claude?.verbose).toBe(true);
      
      // Other defaults should be preserved
      expect(config.claude?.model).toBe(defaultConfig.claude?.model);
      expect(config.claude?.timeout).toBe(defaultConfig.claude?.timeout);
      expect(config.claude?.allowedTools).toEqual(defaultConfig.claude?.allowedTools);
    });

    it('should handle multi-line custom appendSystemPrompt', async () => {
      const multiLinePrompt = `Line 1: Custom instructions
Line 2: More instructions
Line 3: Final instructions`;
      
      const customConfig = {
        claude: {
          appendSystemPrompt: multiLinePrompt
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      
      expect(config.claude?.appendSystemPrompt).toBe(multiLinePrompt);
      expect(config.claude?.appendSystemPrompt.split('\n')).toHaveLength(3);
    });
  });

  describe('deepMerge behavior', () => {
    it('should merge nested objects deeply', async () => {
      const customConfig = {
        database: {
          path: '/custom/path/todoq.db'
          // autoMigrate and walMode should use defaults
        },
        claude: {
          verbose: true
          // other claude settings should use defaults
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      const defaultConfig = getDefaultConfig();
      
      // Custom values
      expect(config.database.path).toBe('/custom/path/todoq.db');
      expect(config.claude?.verbose).toBe(true);
      
      // Defaults preserved in nested objects
      expect(config.database.autoMigrate).toBe(defaultConfig.database.autoMigrate);
      expect(config.database.walMode).toBe(defaultConfig.database.walMode);
      expect(config.claude?.model).toBe(defaultConfig.claude?.model);
      expect(config.claude?.timeout).toBe(defaultConfig.claude?.timeout);
    });

    it('should replace arrays entirely, not merge them', async () => {
      const customConfig = {
        claude: {
          allowedTools: ['Read', 'Write'],  // Shorter list than default
          customArgs: ['--custom-flag']
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      
      // Arrays should be replaced, not merged
      expect(config.claude?.allowedTools).toEqual(['Read', 'Write']);
      expect(config.claude?.allowedTools).not.toContain('TodoWrite');
      expect(config.claude?.customArgs).toEqual(['--custom-flag']);
    });

    it('should handle null and undefined values appropriately', async () => {
      const customConfig = {
        claude: {
          appendSystemPrompt: null,  // Explicitly set to null
          verbose: undefined  // Undefined should be ignored
        }
      };

      writeFileSync(testConfigPath, JSON.stringify(customConfig));
      const config = await loadConfig(testConfigPath);
      const defaultConfig = getDefaultConfig();
      
      // null should override the default
      expect(config.claude?.appendSystemPrompt).toBe(null);
      
      // undefined is not serialized in JSON, so default should be used
      expect(config.claude?.verbose).toBe(defaultConfig.claude?.verbose);
    });
  });
});