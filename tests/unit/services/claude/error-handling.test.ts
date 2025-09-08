import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClaudeService } from '../../../../src/services/claude/claude-service.js';
import type { TodoqConfig } from '../../../../src/core/types.js';
import type { TaskContext } from '../../../../src/services/claude/types.js';

// Mock dependencies
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/mock/path/to/dist/cli/index.js')
}));

describe('ClaudeService Error Handling', () => {
  let claudeService: ClaudeService;
  let mockConfig: TodoqConfig;

  beforeEach(() => {
    vi.clearAllMocks();
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
        maxRetries: 0 // Disable retries for error handling tests
      }
    };

    claudeService = new ClaudeService(undefined, undefined, mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('executeTodoqGetNext error scenarios', () => {
    const testDir = '/test/project';

    beforeEach(async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true); // CLI exists by default
    });

    it('should handle CLI not found error', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('TodoQ CLI not found at');
    });

    it('should handle database not initialized error', async () => {
      const { execa } = await import('execa');
      const error = new Error('Init failed') as any;
      error.stderr = 'Database not initialized';
      
      // Mock the init command to fail
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('TodoQ database not found in /test/project. Please run \'todoq init\' in the project directory first.');
    });

    it('should handle ENOENT error (missing CLI)', async () => {
      const { execa } = await import('execa');
      const error = new Error('ENOENT') as any;
      error.message = 'spawn ENOENT';
      
      // Mock the init command to fail with ENOENT
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('TodoQ database not found in /test/project. Please run \'todoq init\' in the project directory first.');
    });

    it('should handle no remaining tasks error', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // init success
        .mockResolvedValueOnce({ stdout: '0', stderr: '' } as any); // remaining count = 0

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('No remaining tasks found');
    });

    it('should handle timeout error', async () => {
      const { execa } = await import('execa');
      const error = new Error('Timeout') as any;
      error.code = 'ETIMEDOUT';
      
      // Mock the init command to timeout
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('Timeout while communicating with todoq CLI. Please check if the database is accessible.');
    });

    it('should handle stderr with no remaining tasks message', async () => {
      const { execa } = await import('execa');
      const error = new Error('CLI error') as any;
      error.stderr = 'No remaining tasks found in database';
      
      // Mock the init command to fail with no remaining tasks message
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('No remaining tasks found in /test/project. Add tasks using \'todoq import\' or \'todoq insert\' first.');
    });

    it('should handle stdout with zero count', async () => {
      const { execa } = await import('execa');
      const error = new Error('CLI error') as any;
      error.stdout = '0';
      
      // Mock the init command to fail with zero count in stdout
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('No remaining tasks found in /test/project. Add tasks using \'todoq import\' or \'todoq insert\' first.');
    });

    it('should handle generic error with context', async () => {
      const { execa } = await import('execa');
      const error = new Error('Generic error') as any;
      error.stderr = 'Some generic error message';
      
      // Mock the init command to fail with generic error
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('Failed to get next task from /test/project: Some generic error message');
    });

    it('should handle error with stdout fallback', async () => {
      const { execa } = await import('execa');
      const error = new Error('Generic error') as any;
      error.stdout = 'Stdout error message';
      
      // Mock the init command to fail with stdout error message
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('Failed to get next task from /test/project: Stdout error message');
    });

    it('should handle error with message fallback', async () => {
      const { execa } = await import('execa');
      const error = new Error('Message only error') as any;
      
      // Mock the init command to fail with message only
      vi.mocked(execa).mockRejectedValueOnce(error);

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('Failed to get next task from /test/project: Message only error');
    });

    it('should handle invalid JSON in task result', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // init
        .mockResolvedValueOnce({ stdout: '1', stderr: '' } as any) // remaining count
        .mockResolvedValueOnce({ stdout: 'invalid json', stderr: '' } as any); // invalid JSON

      await expect(claudeService.executeTodoqGetNext(testDir))
        .rejects.toThrow('Failed to get next task from /test/project:');
    });
  });

  describe('executeTodoqNextPrompt error scenarios', () => {
    const mockContext: TaskContext = {
      taskJson: {
        number: '1.0',
        name: 'Test Task',
        description: 'Test Description'
      },
      projectDir: '/test/project',
      remainingCount: 1
    };

    it('should handle Claude execution timeout', async () => {
      const { execa } = await import('execa');
      const error = new Error('Timeout') as any;
      error.code = 'ETIMEDOUT';
      
      // Mock Claude path detection to succeed, then Claude execution to timeout
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution times out

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle Claude execution failure with stderr', async () => {
      const { execa } = await import('execa');
      const error = new Error('Claude failed') as any;
      error.stderr = 'Detailed error from Claude';
      
      // Mock Claude path detection to succeed, then Claude execution to fail
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution fails

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude failed');
      expect(result.output).toBe('Detailed error from Claude');
    });

    it('should handle Claude execution failure with stdout', async () => {
      const { execa } = await import('execa');
      const error = new Error('Claude failed') as any;
      error.stdout = 'Partial output from Claude';
      
      // Mock Claude path detection to succeed, then Claude execution to fail
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution fails

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude failed');
      expect(result.output).toBe('Partial output from Claude');
    });

    it('should handle Claude execution failure without specific error info', async () => {
      const { execa } = await import('execa');
      const error = {} as any; // Minimal error object
      
      // Mock Claude path detection to succeed, then Claude execution to fail
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution fails

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.output).toBe('');
    });

    it('should handle non-zero exit code', async () => {
      const { execa } = await import('execa');
      
      // Mock Claude path detection to succeed, then Claude execution returns non-zero exit code
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockResolvedValueOnce({ // Claude execution
          exitCode: 1,
          stdout: 'Partial success output',
          stderr: 'Warning messages'
        } as any);

      const result = await claudeService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.output).toBe('Partial success output');
    });

    it('should handle streaming mode errors', async () => {
      const streamingConfig = {
        ...mockConfig,
        claude: {
          ...mockConfig.claude!,
          streaming: true
        }
      };

      const streamingService = new ClaudeService(undefined, undefined, streamingConfig);
      const { execa } = await import('execa');
      
      const error = new Error('Stream failed') as any;
      error.stdout = 'Partial stream output';
      
      // Mock Claude path detection to succeed, then Claude execution to fail
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any) // detectClaudePath
        .mockRejectedValueOnce(error); // Claude execution fails

      const result = await streamingService.executeTodoqNextPrompt(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stream failed');
    });
  });

  describe('Claude availability error scenarios', () => {
    it('should handle Claude path detection failure', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Claude not found'));

      const result = await claudeService.isAvailable();

      expect(result).toBe(false);
    });

    it('should handle Claude version check timeout', async () => {
      const { execa } = await import('execa');
      const timeoutError = new Error('Timeout') as any;
      timeoutError.code = 'ETIMEDOUT';
      vi.mocked(execa).mockRejectedValue(timeoutError);

      const result = await claudeService.isAvailable();

      expect(result).toBe(false);
    });

    it('should handle partial Claude installation', async () => {
      const { execa } = await import('execa');
      vi.mocked(execa).mockRejectedValue(new Error('Permission denied'));

      const result = await claudeService.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('Path resolution error scenarios', () => {
    it('should handle import.meta.url parsing failure', () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('import', { meta: { url: null } });

      const service = new ClaudeService();
      const repoRoot = (service as any).findRepoRoot();

      // Should fallback to process.cwd()
      expect(typeof repoRoot).toBe('string');
    });

    it('should handle fileURLToPath failure', async () => {
      // Mock the url module to throw an error when fileURLToPath is called
      vi.doMock('url', () => ({
        fileURLToPath: vi.fn(() => {
          throw new Error('URL parsing failed');
        })
      }));

      const service = new ClaudeService();
      const repoRoot = (service as any).findRepoRoot();

      // Should fallback to process.cwd()
      expect(typeof repoRoot).toBe('string');
      
      vi.doUnmock('url');
    });
  });

  describe('Configuration error scenarios', () => {
    it('should handle malformed TodoqConfig', () => {
      const malformedConfig = {
        claude: {
          enabled: 'not a boolean' as any,
          timeout: 'not a number' as any
        }
      } as TodoqConfig;

      // Should not throw during construction
      const service = new ClaudeService(undefined, undefined, malformedConfig);
      expect(service).toBeInstanceOf(ClaudeService);
    });

    it('should handle empty Claude configuration', () => {
      const emptyClaudeConfig = {
        ...mockConfig,
        claude: {} as any
      };

      const service = new ClaudeService(undefined, undefined, emptyClaudeConfig);
      expect(service).toBeInstanceOf(ClaudeService);
    });

    it('should handle missing Claude configuration section', () => {
      const noClaudeConfig = {
        database: mockConfig.database,
        display: mockConfig.display,
        defaults: mockConfig.defaults
      };

      const service = new ClaudeService(undefined, undefined, noClaudeConfig);
      expect(service).toBeInstanceOf(ClaudeService);
    });
  });

  describe('Claude exit code error reporting', () => {
    it('should report Claude exit code 1 with clear error message', async () => {
      const { execa } = await import('execa');
      const mockExeca = vi.mocked(execa);
      const { existsSync } = await import('fs');
      const mockExistsSync = vi.mocked(existsSync);

      mockExistsSync.mockReturnValue(true);

      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '', exitCode: 0 } as any); // --version check

      // Mock successful todoq CLI calls
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // init
      mockExeca.mockResolvedValueOnce({ stdout: '1', stderr: '', exitCode: 0 } as any); // remaining count
      mockExeca.mockResolvedValueOnce({ 
        stdout: JSON.stringify({ taskNumber: '1.0', name: 'Test Task' }), 
        stderr: '', 
        exitCode: 0 
      } as any); // current --json
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // current --start

      // Mock Claude execution with exit code 1
      mockExeca.mockResolvedValueOnce({ 
        stdout: 'Claude output before error', 
        stderr: 'Claude error output', 
        exitCode: 1 
      } as any);

      const service = new ClaudeService(undefined, undefined, mockConfig);
      const context = await service.executeTodoqGetNext('/test/project');
      const result = await service.executeTodoqNextPrompt(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude Code exited with code 1. This is a Claude execution error, not a TodoQ error.');
      expect(result.output).toContain('Claude output before error');
    });

    it('should report Claude exit code 2 with clear error message', async () => {
      const { execa } = await import('execa');
      const mockExeca = vi.mocked(execa);
      const { existsSync } = await import('fs');
      const mockExistsSync = vi.mocked(existsSync);

      mockExistsSync.mockReturnValue(true);

      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '', exitCode: 0 } as any); // --version check

      // Mock successful todoq CLI calls
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // init
      mockExeca.mockResolvedValueOnce({ stdout: '1', stderr: '', exitCode: 0 } as any); // remaining count
      mockExeca.mockResolvedValueOnce({ 
        stdout: JSON.stringify({ taskNumber: '1.0', name: 'Test Task' }), 
        stderr: '', 
        exitCode: 0 
      } as any); // current --json
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // current --start

      // Mock Claude execution with exit code 2
      mockExeca.mockResolvedValueOnce({ 
        stdout: '', 
        stderr: 'Claude fatal error', 
        exitCode: 2 
      } as any);

      const service = new ClaudeService(undefined, undefined, mockConfig);
      const context = await service.executeTodoqGetNext('/test/project');
      const result = await service.executeTodoqNextPrompt(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude Code exited with code 2. This is a Claude execution error, not a TodoQ error.');
    });

    it('should handle Claude execution throwing error with exit code', async () => {
      const { execa } = await import('execa');
      const mockExeca = vi.mocked(execa);
      const { existsSync } = await import('fs');
      const mockExistsSync = vi.mocked(existsSync);

      mockExistsSync.mockReturnValue(true);

      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '', exitCode: 0 } as any); // --version check

      // Mock successful todoq CLI calls
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // init
      mockExeca.mockResolvedValueOnce({ stdout: '1', stderr: '', exitCode: 0 } as any); // remaining count
      mockExeca.mockResolvedValueOnce({ 
        stdout: JSON.stringify({ taskNumber: '1.0', name: 'Test Task' }), 
        stderr: '', 
        exitCode: 0 
      } as any); // current --json
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // current --start

      // Mock Claude execution throwing error with exit code
      const error = new Error('Command failed') as any;
      error.exitCode = 127;
      error.stdout = 'Partial output';
      error.stderr = 'Command not found';
      mockExeca.mockRejectedValueOnce(error);

      const service = new ClaudeService(undefined, undefined, mockConfig);
      const context = await service.executeTodoqGetNext('/test/project');
      const result = await service.executeTodoqNextPrompt(context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude Code exited with code 127. This is a Claude execution error, not a TodoQ error.');
      expect(result.output).toContain('Partial output');
    });

    it('should handle successful Claude execution (exit code 0)', async () => {
      const { execa } = await import('execa');
      const mockExeca = vi.mocked(execa);
      const { existsSync } = await import('fs');
      const mockExistsSync = vi.mocked(existsSync);

      mockExistsSync.mockReturnValue(true);

      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0', stderr: '', exitCode: 0 } as any); // --version check

      // Mock successful todoq CLI calls
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // init
      mockExeca.mockResolvedValueOnce({ stdout: '1', stderr: '', exitCode: 0 } as any); // remaining count
      mockExeca.mockResolvedValueOnce({ 
        stdout: JSON.stringify({ taskNumber: '1.0', name: 'Test Task' }), 
        stderr: '', 
        exitCode: 0 
      } as any); // current --json
      mockExeca.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any); // current --start

      // Mock successful Claude execution
      mockExeca.mockResolvedValueOnce({ 
        stdout: 'Task completed successfully', 
        stderr: '', 
        exitCode: 0 
      } as any);

      const service = new ClaudeService(undefined, undefined, mockConfig);
      const context = await service.executeTodoqGetNext('/test/project');
      const result = await service.executeTodoqNextPrompt(context);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.output).toContain('Task completed successfully');
    });
  });
});