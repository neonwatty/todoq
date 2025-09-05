import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeClaudeCommand, createFixtureInTestDir, debugStep, isClaudeCodeAvailable } from './commands-helpers.js';
import { createTestDir, cleanupTestDir } from '../functional/setup.js';
import { readFileSync, writeFileSync } from 'fs';
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
    expect(result.stdout).toContain('--timeout');
    expect(result.stdout).toContain('--verbose');
    expect(result.stdout).toContain('--streaming');
    expect(result.stdout).toContain('--skip-claude-check');
  });

  it('should fail gracefully when todoq not initialized', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

    const result = await executeClaudeCommand(
      testDir,
      'work-next --skip-claude-check',
      '',
      { expectError: true, skipIfNotAvailable: true }
    );

    expect(result.code).toBe(1);
    expect(result.stdout || result.stderr).toContain('database not found');
  });

  it('should fail gracefully when no tasks available', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

    // Initialize todoq in test directory
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
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

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
    expect(workNextResult.stdout).toContain('Working on task: 1.0 - Test work-next integration');
  });

  it('should respect verbose option', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

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

    // Should show verbose messages
    expect(result.stdout).toContain('Checking Claude availability');
    expect(result.stdout).toContain('Working on task: 1.0 - Verbose test task');
  });

  it('should respect timeout option', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

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
      'work-next --skip-claude-check --timeout 5000 --verbose',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 15000 }
    );

    // Command should execute (timeout is passed to Claude, not the command execution)
    expect(result.stdout).toContain('Working on task: 1.0 - Timeout test task');
  });

  it('should handle configuration from .todoqrc file', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

    // Create .todoqrc with Claude configuration
    const todoqrc = {
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
        model: 'claude-3-5-sonnet-20241022',
        timeout: 120000,
        verbose: true,
        streaming: false
      }
    };

    writeFileSync(path.join(testDir, '.todoqrc'), JSON.stringify(todoqrc, null, 2));

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
    expect(result.stdout).toContain('Working on task: 1.0 - Configuration test task');
  });

  it('should handle missing Claude gracefully', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

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

    // Create config that points to invalid Claude path
    const todoqrc = {
      claude: {
        enabled: true,
        claudePath: '/nonexistent/claude/path'
      }
    };

    writeFileSync(path.join(testDir, '.todoqrc'), JSON.stringify(todoqrc, null, 2));

    const result = await executeClaudeCommand(
      testDir,
      'work-next',
      '',
      { expectError: true, skipIfNotAvailable: true, timeout: 10000 }
    );

    // Should fail with Claude not available message
    expect(result.code).toBe(1);
    expect(result.stdout || result.stderr).toContain('Claude Code not available');
  });

  it('should handle complex task with all fields', async () => {
    if (!await isClaudeCodeAvailable()) {
      console.log('⚠️  Skipping Claude integration test - Claude Code not available');
      return;
    }

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