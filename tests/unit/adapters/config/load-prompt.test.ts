import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from '../../../../src/adapters/config/index.js';

describe('Config loadDefaultPrompt', () => {
  it('should load a non-empty prompt', () => {
    const config = getDefaultConfig();
    const prompt = config.claude?.appendSystemPrompt || '';
    
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100); // Should have substantial content
  });

  it('should not contain TASK_JSON or PROJECT_DIR placeholders', () => {
    const config = getDefaultConfig();
    const prompt = config.claude?.appendSystemPrompt || '';
    
    // These placeholders should not be in appendSystemPrompt since they won't be replaced
    expect(prompt).not.toContain('{{TASK_JSON}}');
    expect(prompt).not.toContain('{{PROJECT_DIR}}');
  });

  it('should contain TodoQ Task Execution Guidelines header', () => {
    const config = getDefaultConfig();
    const prompt = config.claude?.appendSystemPrompt || '';
    
    // Basic structure check - the prompt should have this header
    expect(prompt).toContain('## TodoQ Task Execution Guidelines');
  });

  it('should contain numbered steps', () => {
    const config = getDefaultConfig();
    const prompt = config.claude?.appendSystemPrompt || '';
    
    // Check that it has some numbered steps (flexible to allow any number)
    expect(prompt).toMatch(/\d+\.\s+\*\*/); // Matches patterns like "1. **"
  });

  it('should mention TodoWrite for tracking', () => {
    const config = getDefaultConfig();
    const prompt = config.claude?.appendSystemPrompt || '';
    
    // Core functionality check - should use TodoWrite for tracking
    expect(prompt.toLowerCase()).toContain('todowrite');
  });
});