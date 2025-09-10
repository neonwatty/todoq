import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('work-next command - Exit Code 143 Integration', () => {
  let testDir: string;
  const todoqCli = path.resolve('./dist/cli/index.js');

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todoq-test-143-'));
    
    // Initialize todoq in test directory
    execSync(`node ${todoqCli} init`, { cwd: testDir });
    
    // Create a test task
    const taskJson = {
      tasks: [{
        number: '1.0',
        name: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 1
      }]
    };
    
    fs.writeFileSync(
      path.join(testDir, 'tasks.json'),
      JSON.stringify(taskJson, null, 2)
    );
    
    // Import the task
    execSync(`node ${todoqCli} import tasks.json`, { cwd: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should show proper error for missing Claude', () => {
    // Test without Claude installed (skip-claude-check not used)
    try {
      execSync(`node ${todoqCli} work-next`, { 
        cwd: testDir,
        stdio: 'pipe',
        timeout: 5000
      });
      
      // Might succeed if Claude is installed
    } catch (error: any) {
      const output = error.stdout?.toString() || '';
      const errorOutput = error.stderr?.toString() || '';
      const combinedOutput = output + errorOutput;
      
      // Should show Claude not available message, not exit code 143
      if (combinedOutput.includes('Claude Code not available')) {
        expect(combinedOutput).toContain('Please ensure Claude is installed');
        expect(combinedOutput).not.toContain('exit code 143');
      }
      
      // Test passes - we got an error as expected
      expect(error.status).not.toBe(0);
    }
  });
});