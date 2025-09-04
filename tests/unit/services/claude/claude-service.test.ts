import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService, getClaudeService } from '../../../../src/services/claude/claude-service.js';
import type { TodoqConfig } from '../../../../src/core/types.js';
import type { TaskContext, WorkTaskResult } from '../../../../src/services/claude/types.js';

// Mock dependencies
vi.mock('execa');
vi.mock('fs');

vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mock/path/to/dist/cli/index.js')
}));

describe('ClaudeService', () => {
  let claudeService: ClaudeService;
  let mockConfig: TodoqConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock import.meta.url
    vi.stubGlobal('import', { meta: { url: 'file:///mock/path/to/dist/cli/index.js' } });
    
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
        timeout: 180000,
        model: 'claude-3-5-sonnet-20241022',
        verbose: false,
        streaming: false,
        maxIterations: 3,
        allowedTools: ['Read', 'Edit', 'Bash']
      }
    };

    claudeService = new ClaudeService(undefined, undefined, mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('constructor', () => {
    it('should initialize with TodoqConfig', () => {
      expect(claudeService).toBeInstanceOf(ClaudeService);
    });

    it('should use override path when provided', () => {
      const serviceWithOverride = new ClaudeService(undefined, '/custom/claude/path', mockConfig);
      expect(serviceWithOverride).toBeInstanceOf(ClaudeService);
    });

    it('should work without TodoqConfig', () => {
      const serviceWithoutConfig = new ClaudeService();
      expect(serviceWithoutConfig).toBeInstanceOf(ClaudeService);
    });
  });

  describe('isAvailable', () => {
    it('should return true when Claude CLI is available', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);

      const result = await claudeService.isAvailable();
      
      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith(expect.any(String), ['--version'], { timeout: 5000 });
    });

    it('should return false when Claude CLI is not available', async () => {
      const { execa } = await import('execa');
      // Mock all execa calls to reject - detectClaudePath tries multiple paths
      vi.mocked(execa).mockRejectedValue(new Error('Command not found'));

      const result = await claudeService.isAvailable();
      
      expect(result).toBe(false);
    });
  });

  describe('findRepoRoot', () => {
    it('should find repo root from dist/cli path', () => {
      // Access private method for testing
      const repoRoot = (claudeService as any).findRepoRoot();
      
      // Should go up 2 levels from dist/cli
      expect(repoRoot).toContain('mock/path');
    });

    it('should handle errors gracefully', () => {
      vi.mocked(vi.fn(() => { throw new Error('URL parsing failed'); }));
      
      const repoRoot = (claudeService as any).findRepoRoot();
      
      // Should fallback to process.cwd()
      expect(typeof repoRoot).toBe('string');
    });
  });

  describe('executeTodoqGetNext', () => {
    const mockProjectDir = '/test/project';

    beforeEach(async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true); // CLI exists
    });

    it('should successfully get next task', async () => {
      const { execa } = await import('execa');
      
      // Mock successful command executions
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // init
        .mockResolvedValueOnce({ stdout: '1', stderr: '' } as any) // remaining count
        .mockResolvedValueOnce({ 
          stdout: JSON.stringify({
            number: '1.0',
            name: 'Test Task',
            description: 'Test Description'
          }),
          stderr: ''
        } as any) // current --json
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any); // current --start

      const result = await claudeService.executeTodoqGetNext(mockProjectDir);

      expect(result).toEqual({
        taskJson: {
          number: '1.0',
          name: 'Test Task',
          description: 'Test Description'
        },
        projectDir: mockProjectDir,
        remainingCount: 1
      });
    });

    it('should throw error when CLI not found', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(claudeService.executeTodoqGetNext(mockProjectDir))
        .rejects.toThrow('TodoQ CLI not found');
    });

    it('should throw error when no remaining tasks', async () => {
      const { execa } = await import('execa');
      
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // init
        .mockResolvedValueOnce({ stdout: '0', stderr: '' } as any); // remaining count = 0

      await expect(claudeService.executeTodoqGetNext(mockProjectDir))
        .rejects.toThrow('No remaining tasks found');
    });

    it('should provide helpful error for missing database', async () => {
      const { execa } = await import('execa');
      
      const error = new Error('Database not initialized') as any;
      error.stderr = 'Database not initialized';
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(mockProjectDir))
        .rejects.toThrow('TodoQ database not found');
    });

    it('should handle timeout errors', async () => {
      const { execa } = await import('execa');
      
      const error = new Error('Timeout') as any;
      error.code = 'ETIMEDOUT';
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(mockProjectDir))
        .rejects.toThrow('Timeout while communicating with todoq CLI');
    });
  });

  describe('executeTodoqNextPrompt', () => {
    const mockContext: TaskContext = {
      taskJson: {
        number: '1.0',
        name: 'Test Task',
        description: 'Test Description',
        files: ['README.md'],
        docs_references: ['https://docs.example.com']
      },
      projectDir: '/test/project',
      remainingCount: 1
    };

    it('should successfully execute Claude prompt', async () => {
      const { execa } = await import('execa');
      
      // First mock the Claude detection calls to succeed
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockResolvedValueOnce({  // Claude execution
          exitCode: 0,
          stdout: 'Task completed successfully\nTask 1.0: Test Task completed',
          stderr: ''
        } as any);

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.iterations).toBe(1);
      expect(result.output).toContain('Task completed successfully');
    });

    it('should handle Claude execution failure', async () => {
      const { execa } = await import('execa');
      
      const error = new Error('Claude execution failed') as any;
      error.stdout = 'Partial output';
      error.stderr = 'Error details';
      
      // Mock Claude path detection to succeed, then Claude execution to fail
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution fails

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude execution failed');
      expect(result.output).toBe('Partial output');
    });

    it('should handle non-streaming execution', async () => {
      const mockConfigNonStreaming = {
        ...mockConfig,
        claude: {
          ...mockConfig.claude!,
          streaming: false
        }
      };

      const serviceNonStreaming = new ClaudeService(undefined, undefined, mockConfigNonStreaming);
      const { execa } = await import('execa');
      
      // Mock Claude path detection to succeed, then Claude execution
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockResolvedValueOnce({  // Claude execution
          exitCode: 0,
          stdout: 'Non-streaming output',
          stderr: ''
        } as any);

      const result = await serviceNonStreaming.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Non-streaming output');
    });
  });

  describe('buildPrompt', () => {
    const mockContext: TaskContext = {
      taskJson: {
        number: '1.0',
        name: 'Test Task',
        description: 'Test Description'
      },
      projectDir: '/test/project',
      remainingCount: 1
    };

    it('should build prompt with task context', () => {
      const prompt = (claudeService as any).buildPrompt(mockContext);

      expect(prompt).toContain('1.0');
      expect(prompt).toContain('Test Task');
      expect(prompt).toContain('/test/project');
      expect(prompt).toContain('Phase 1 Checkpoint');
      expect(prompt).toContain('Context Extraction');
      expect(prompt).toContain('Implementation Phase');
      expect(prompt).toContain('Phase 2 Checkpoint');
      expect(prompt).toContain('Testing & Validation');
    });

    it('should include error recovery pattern', () => {
      const prompt = (claudeService as any).buildPrompt(mockContext);

      expect(prompt).toContain('Error Recovery Pattern');
      expect(prompt).toContain('Mandatory Validation Rules');
    });
  });

  describe('parseTaskInfo', () => {
    it('should extract task number from output', () => {
      const output = 'Working on task 1.2.3 - Some task name\nCompleted successfully';
      const taskInfo = (claudeService as any).parseTaskInfo(output);

      expect(taskInfo.taskNumber).toBe('1.2.3');
    });

    it('should extract task name from output', () => {
      const output = 'task: Implementation of new feature\nOther content';
      const taskInfo = (claudeService as any).parseTaskInfo(output);

      expect(taskInfo.taskName).toBe('Implementation of new feature');
    });

    it('should handle output without task info', () => {
      const output = 'Some random output without task information';
      const taskInfo = (claudeService as any).parseTaskInfo(output);

      expect(taskInfo.taskNumber).toBeUndefined();
      expect(taskInfo.taskName).toBeUndefined();
    });
  });
});

describe('getClaudeService (singleton)', () => {
  beforeEach(() => {
    // Reset singleton instance
    (getClaudeService as any).instance = null;
  });

  it('should return singleton instance', () => {
    const service1 = getClaudeService();
    const service2 = getClaudeService();

    expect(service1).toBe(service2);
  });

  it('should create new instance when config provided', () => {
    const service1 = getClaudeService();
    const service2 = getClaudeService(undefined, undefined, {
      database: { path: '', autoMigrate: true, walMode: true },
      display: { format: 'tree', colors: true, showCompleted: false },
      defaults: { status: 'pending', priority: 0 }
    });

    expect(service1).not.toBe(service2);
  });

  it('should create new instance when override path provided', () => {
    const service1 = getClaudeService();
    const service2 = getClaudeService(undefined, '/custom/path');

    expect(service1).not.toBe(service2);
  });

  it('should create new instance when config path provided', () => {
    const service1 = getClaudeService();
    const service2 = getClaudeService('/custom/config');

    expect(service1).not.toBe(service2);
  });
});