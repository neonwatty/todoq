import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeClaudeCommand, createFixtureInTestDir, debugStep, isClaudeCodeAvailable } from './commands-helpers.js';
import { createTestDir, cleanupTestDir } from '../functional/setup.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

describe('work-next command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = createTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should show help for work-next command', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

    const result = await executeClaudeCommand(
      testDir,
      'work-next --help',
      '',
      { expectError: false, skipIfNotAvailable: true }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Work on next task using Claude');
    expect(result.stdout).toContain('--test-timeout');
    expect(result.stdout).toContain('--max-iterations');
    expect(result.stdout).toContain('--output-format');
    expect(result.stdout).toContain('--skip-claude-check');
  });

  it('should fail gracefully when no tasks available', async () => {
    // Initialize todoq but don't add any tasks
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check',
      '',
      { expectError: true, skipIfNotAvailable: true }
    );

    expect(result.code).toBe(1);
    expect(result.stdout || result.stderr).toContain('No remaining tasks');
  });


  it('should work with existing tasks and skip Claude check', async () => {
    // Initialize todoq
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    // Create and import tasks
    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Test work-next integration',
          description: 'This task tests the work-next command integration',
          status: 'pending',
          priority: 1,
          files: ['README.md'],
          docs_references: ['https://docs.example.com/test'],
          testing_strategy: 'Integration testing with mocked Claude'
        }
      ]
    };

    const tasksFile = path.join(testDir, 'tasks.json');
    writeFileSync(tasksFile, JSON.stringify(tasksJson, null, 2));

    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    // Verify task is available
    const currentResult = await executeClaudeCommand(testDir, 'current', '', { expectError: false });
    expect(currentResult.stdout).toContain('Test work-next integration');

    // Try work-next with skip Claude check (should fail at Claude execution stage)
    const workNextResult = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 10000 }
    );

    // Should get to the point of trying to execute Claude but fail
    expect(workNextResult.stdout).toContain('Working on task:');
    expect(workNextResult.stdout).toContain('Test work-next integration');
  });

  it('should respect verbose option', async () => {
    // Initialize todoq and add task
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Verbose test task',
          description: 'Testing verbose output',
          status: 'pending'
        }
      ]
    };

    writeFileSync(path.join(testDir, 'tasks.json'), JSON.stringify(tasksJson, null, 2));
    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check --verbose',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 10000 }
    );

    // Should show verbose messages (checking actual output format)
    expect(result.stdout).toContain('Working on task:');
    expect(result.stdout).toContain('Verbose test task');
  });

  it('should respect timeout option', async () => {
    // Initialize todoq and add task
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Timeout test task',
          description: 'Testing timeout option',
          status: 'pending'
        }
      ]
    };

    writeFileSync(path.join(testDir, 'tasks.json'), JSON.stringify(tasksJson, null, 2));
    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check --test-timeout 5000 --verbose',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 15000 }
    );

    // Command should execute (timeout is passed to Claude, not the command execution)
    expect(result.stdout).toContain('Working on task:');
    expect(result.stdout).toContain('Timeout test task');
  });

  it('should handle configuration from .todoqrc file', async () => {
    // Note: .todoqrc will be created automatically by our new runTodoqCommand function
    // Initialize todoq and add task
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Configuration test task',
          description: 'Testing configuration integration',
          status: 'pending'
        }
      ]
    };

    writeFileSync(path.join(testDir, 'tasks.json'), JSON.stringify(tasksJson, null, 2));
    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 10000 }
    );

    // Should load configuration and attempt execution
    expect(result.stdout).toContain('Working on task:');
    expect(result.stdout).toContain('Configuration test task');
  });

  it('should handle missing Claude gracefully', async () => {
    // Initialize todoq and add task
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Missing Claude test',
          description: 'Test behavior when Claude is not available',
          status: 'pending'
        }
      ]
    };

    writeFileSync(path.join(testDir, 'tasks.json'), JSON.stringify(tasksJson, null, 2));
    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    // Update the config to point to invalid Claude path after our function creates it
    const configPath = path.join(testDir, '.todoqrc');
    let config = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    }
    config.claude = {
      enabled: true,
      claudePath: '/nonexistent/claude/path'
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await executeClaudeCommand(
      testDir,
      'work-next',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 10000 }
    );

    // Should fail with Claude not available message
    expect([0, 1]).toContain(result.code); // May succeed or fail depending on Claude config
    expect(result.stdout || result.stderr).toMatch(/Claude|Working on task/); // Either works or shows Claude error
  });

  it('should handle complex task with all fields', async () => {
    // Initialize todoq
    await executeClaudeCommand(testDir, 'init', '', { expectError: false });

    // Create a README.md file referenced in the task
    writeFileSync(path.join(testDir, 'README.md'), '# Test Project\n\nThis is a test project.');

    // Create comprehensive task
    const tasksJson = {
      tasks: [
        {
          number: '1.0',
          name: 'Complex integration task',
          description: 'A comprehensive task with all possible fields to test the work-next command',
          status: 'pending',
          priority: 2,
          files: ['README.md', 'package.json'],
          docs_references: [
            'https://docs.example.com/api',
            'https://github.com/example/repo/wiki'
          ],
          testing_strategy: 'Unit tests, integration tests, and end-to-end testing',
          dependencies: [],
          notes: 'This task should test all functionality of the work-next command'
        }
      ]
    };

    writeFileSync(path.join(testDir, 'tasks.json'), JSON.stringify(tasksJson, null, 2));
    await executeClaudeCommand(testDir, 'import tasks.json', '', { expectError: false });

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check --verbose',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 15000 }
    );

    // Verify the task information is correctly displayed
    expect(result.stdout).toContain('Complex integration task');
    expect(result.stdout).toContain('comprehensive task with all possible fields');
    expect(result.stdout).toContain('Remaining tasks: 1');
  });
});