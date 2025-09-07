import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execaNode } from 'execa';
import path from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

describe('JSON Formatter Integration', () => {
  const testDir = path.join(process.cwd(), 'test-formatter-integration');
  const cliPath = path.join(process.cwd(), 'dist', 'cli', 'index.js');
  
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.env.CI || !process.env.TEST_CLAUDE_INTEGRATION)(
    'should format verbose output when work-next is run', 
    async () => {

    // Create a simple task file
    const taskFile = path.join(testDir, 'tasks.json');
    writeFileSync(taskFile, JSON.stringify({
      tasks: [{
        number: '1.0',
        name: 'Test Task',
        description: 'Test the JSON formatter',
        status: 'pending',
        priority: 1
      }]
    }));

    // Initialize todoq in test directory
    await execaNode(cliPath, ['init'], { cwd: testDir });
    await execaNode(cliPath, ['import', 'tasks.json'], { cwd: testDir });

    // Run work-next with verbose output
    const result = await execaNode(cliPath, [
      'work-next',
      '--verbose',
      '--output-format', 'stream-json',
      '--skip-claude-check',
      '--max-iterations', '1'
    ], { 
      cwd: testDir,
      reject: false,
      timeout: 30000
    });

    // Check that formatted output is present
    expect(result.stdout).toContain('🔧 Using');
    
    // Check for formatted TodoWrite output
    if (result.stdout.includes('TodoWrite')) {
      expect(result.stdout).toMatch(/📝 Todos \(\d+ items\)/);
    }
    
    // Check that it's not the old unformatted JSON
    expect(result.stdout).not.toMatch(/🔧 Using TodoWrite: \{"todos":\[/);
  });

  it('should handle formatter errors gracefully', async () => {
    // Build the CLI if not already built
    if (!existsSync(cliPath)) {
      await execaNode('npm', ['run', 'build']);
    }

    // Initialize todoq
    await execaNode(cliPath, ['init'], { cwd: testDir });

    // Create a config that might trigger edge cases
    const configPath = path.join(testDir, '.todoqrc');
    writeFileSync(configPath, JSON.stringify({
      database: { path: path.join(testDir, '.todoq', 'tasks.db') },
      display: { format: 'tree', colors: true, showCompleted: false },
      defaults: { status: 'pending', priority: 1 },
      claude: {
        enabled: true,
        verbose: true,
        outputFormat: 'stream-json'
      }
    }));

    // Even if formatter has issues, the CLI should not crash
    const result = await execaNode(cliPath, ['list'], { 
      cwd: testDir,
      reject: false 
    });
    
    expect(result.exitCode).toBe(0);
  });
});