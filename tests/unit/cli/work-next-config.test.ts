import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { registerWorkNextCommands } from '../../../src/cli/commands/work-next.js';
import { Command } from 'commander';
import type { TodoqConfig } from '../../../src/core/types.js';

// Mock the Claude service
vi.mock('../../../src/services/claude/index.js', () => ({
  getClaudeService: vi.fn(() => ({
    isAvailable: vi.fn().mockResolvedValue(true),
    executeTodoqGetNext: vi.fn().mockResolvedValue({
      taskJson: {
        number: '1.0',
        name: 'Test Task',
        description: 'Test Description'
      },
      projectDir: '/test/dir',
      remainingCount: 1
    }),
    executeTodoqNextPrompt: vi.fn().mockResolvedValue({
      success: true,
      duration: 5000,
      iterations: 1,
      taskNumber: '1.0',
      taskName: 'Test Task'
    })
  }))
}));

describe('work-next command configuration integration (tfq-style)', () => {
  let program: Command;
  let mockConfig: TodoqConfig;
  let getClaudeServiceMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getClaudeService } = await import('../../../src/services/claude/index.js');
    getClaudeServiceMock = vi.mocked(getClaudeService);

    program = new Command();
    
    mockConfig = {
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
        testTimeout: 180000,
        model: 'sonnet',
        verbose: false,
        outputFormat: 'text',
        maxIterations: 10,
        maxTurns: 5,
        allowedTools: ['Read', 'Edit', 'Bash'],
        permissionMode: 'plan',
        dangerouslySkipPermissions: true,
        continueSession: true
      }
    };

    // Register the work-next command
    registerWorkNextCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass base configuration to Claude service', async () => {
    // Mock console.log to capture output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Set up command with configuration
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    // Parse and execute command
    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          enabled: true,
          testTimeout: 300000, // Uses default since config gets merged
          model: 'sonnet',
          verbose: false,
          outputFormat: 'text',
          allowedTools: ['Read', 'Edit', 'Bash'],
          permissionMode: 'plan'
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should override test timeout from command line', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '--test-timeout', '400000', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          testTimeout: 400000 // Should be overridden
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should override verbose from command line', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '--verbose', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          verbose: true // Should be overridden
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should override output format from command line', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '--output-format', 'stream-json', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          outputFormat: 'stream-json' // Should be overridden
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should override multiple options from command line', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync([
      'node', 'test', 'work-next', 
      '--skip-claude-check', 
      '--test-timeout', '240000',
      '--verbose',
      '--output-format', 'json',
      '--model', 'opus',
      '/test/dir'
    ]);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          testTimeout: 240000,
          verbose: true,
          outputFormat: 'json',
          model: 'opus'
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should create claude config section when none exists', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Config without Claude section
    const configWithoutClaude = {
      database: mockConfig.database,
      display: mockConfig.display,
      defaults: mockConfig.defaults
    };
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', configWithoutClaude);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '--test-timeout', '120000', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        claude: expect.objectContaining({
          testTimeout: 120000
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should preserve other configuration values when overriding', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '--verbose', '/test/dir']);

    expect(getClaudeServiceMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      expect.objectContaining({
        database: mockConfig.database,
        display: mockConfig.display,
        defaults: mockConfig.defaults,
        claude: expect.objectContaining({
          enabled: true, // Preserved
          testTimeout: 300000, // Default applied
          model: 'sonnet', // Preserved
          outputFormat: 'text', // Preserved
          verbose: true // Overridden
        })
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle error when Claude service fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    
    // Make Claude service throw an error
    getClaudeServiceMock.mockReturnValue({
      isAvailable: vi.fn().mockResolvedValue(true),
      executeTodoqGetNext: vi.fn().mockRejectedValue(new Error('Test error')),
      executeTodoqNextPrompt: vi.fn()
    });
    
    const command = program.commands.find(cmd => cmd.name() === 'work-next')!;
    command.setOptionValue('_config', mockConfig);

    await program.parseAsync(['node', 'test', 'work-next', '--skip-claude-check', '/test/dir']);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Unexpected error:/),
      'Test error'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});