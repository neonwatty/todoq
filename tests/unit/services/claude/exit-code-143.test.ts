import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeService } from '../../../../src/services/claude/claude-service.js';
import { execa } from 'execa';
import type { TaskContext, TodoqConfig } from '../../../../src/core/types.js';

vi.mock('execa');
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn()
}));

describe('Claude Service - Exit Code 143 Handling', () => {
  let claudeService: ClaudeService;
  const mockExeca = vi.mocked(execa);
  
  const mockContext: TaskContext = {
    taskJson: {
      number: '1.0',
      name: 'Test Task',
      description: 'Test Description',
      taskNumber: '1.0'
    },
    projectDir: '/test/project',
    remainingCount: 5
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error message formatting', () => {
    it('should return specific message for exit code 143', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 0 // No retries to test immediate error response
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      // Mock error with exit code 143
      const sigtermError = new Error('Process terminated') as any;
      sigtermError.exitCode = 143;
      sigtermError.stdout = 'Partial output before termination';
      
      mockExeca.mockRejectedValueOnce(sigtermError);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude Code terminated with SIGTERM (exit code 143). This usually means the process exceeded the timeout limit or was interrupted by the system.');
      expect(result.output).toBe('Partial output before termination');
    });

    it('should return generic message for other exit codes', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 0
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const genericError = new Error('Generic error') as any;
      genericError.exitCode = 1;
      
      mockExeca.mockRejectedValueOnce(genericError);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Claude Code exited with code 1. This is a Claude execution error, not a TodoQ error.');
    });
  });

  describe('Exit code 143 during execution', () => {
    it('should throw specific error for exit code 143 from executeClaudeOnce', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 0
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      // Mock successful execution but with exit code 143
      mockExeca.mockResolvedValueOnce({
        exitCode: 143,
        stdout: 'Output before SIGTERM',
        stderr: ''
      } as any);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('SIGTERM');
      expect(result.error).toContain('exit code 143');
    });

    it('should not retry exit code 143 (as it is not currently retryable)', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 2,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const sigtermError = new Error('SIGTERM received') as any;
      sigtermError.exitCode = 143;
      
      // Exit code 143 is not retryable, so it should fail immediately
      mockExeca.mockRejectedValueOnce(sigtermError);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('SIGTERM');
      expect(result.error).toContain('143');
      expect(result.retryAttempts).toBe(0); // No retries for non-retryable errors
      expect(mockExeca).toHaveBeenCalledTimes(2); // Path check + 1 attempt
    });
  });

  describe('SIGTERM signal handling', () => {
    it('should handle SIGTERM signal in error', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 0
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const sigtermError = new Error('Received SIGTERM signal') as any;
      sigtermError.signal = 'SIGTERM';
      sigtermError.exitCode = 143;
      
      mockExeca.mockRejectedValueOnce(sigtermError);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      // The error message should contain SIGTERM info
      expect(result.error).toContain('SIGTERM');
      expect(result.error).toContain('143');
    });
  });

  describe('Timeout scenarios', () => {
    it('should handle timeout with exit code 143', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100,
          timeout: 5000
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const timeoutError = new Error('Operation timed out') as any;
      timeoutError.timedOut = true;
      timeoutError.exitCode = 143;
      timeoutError.signal = 'SIGTERM';
      
      mockExeca
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Success after timeout retry',
          stderr: ''
        } as any);
      
      vi.useFakeTimers();
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await resultPromise;
      
      vi.useRealTimers();
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
    });
  });

  describe('Output preservation with exit code 143', () => {
    it('should preserve partial output from exit code 143 errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error1 = new Error('First SIGTERM') as any;
      error1.exitCode = 143;
      error1.stdout = 'Partial output from first attempt before SIGTERM';
      
      // Exit code 143 is not retryable, so only one attempt will be made
      mockExeca.mockRejectedValueOnce(error1);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('SIGTERM');
      expect(result.error).toContain('143');
      expect(result.output).toBe('Partial output from first attempt before SIGTERM');
      expect(result.retryAttempts).toBe(0); // No retries for exit code 143
    });
  });
});