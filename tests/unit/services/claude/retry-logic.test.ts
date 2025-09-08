import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeService } from '../../../../src/services/claude/claude-service.js';
import { execa } from 'execa';
import type { TaskContext, TodoqConfig } from '../../../../src/core/types.js';

vi.mock('execa');
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn()
}));

describe('Claude Service Retry Logic', () => {
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Retry on transient errors', () => {
    it('should retry on exit code 1 with exponential backoff', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3,
          retryDelay: 1000,
          retryBackoffMultiplier: 2,
          verbose: true
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection (called once and cached)
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      // Mock failures then success
      const error1 = new Error('Claude failed') as any;
      error1.exitCode = 1;
      error1.stdout = 'Attempt 1 output';
      
      const error2 = new Error('Claude failed') as any;
      error2.exitCode = 1;
      error2.stdout = 'Attempt 2 output';
      
      mockExeca
        .mockRejectedValueOnce(error1) // First attempt fails
        .mockRejectedValueOnce(error2) // Second attempt fails
        .mockResolvedValueOnce({       // Third attempt succeeds
          exitCode: 0,
          stdout: 'Success output',
          stderr: ''
        } as any);
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      
      // Second retry after 2000ms (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(2);
      expect(result.output).toBe('Success output');
      
      // Verify retry messages were logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('attempt 1/4'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('attempt 2/4'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 1000ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 2000ms'));
      
      // Verify Claude was called 3 times (after path detection)
      expect(mockExeca).toHaveBeenCalledTimes(4); // 1 for path detection + 3 attempts
    });

    it('should retry on timeout errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 2,
          retryDelay: 500
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const timeoutError = new Error('Timeout') as any;
      timeoutError.timedOut = true;
      timeoutError.stdout = 'Partial output';
      
      mockExeca
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Complete output',
          stderr: ''
        } as any);
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(500);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
    });

    it('should respect max retry delay cap', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 5,
          retryDelay: 1000,
          retryBackoffMultiplier: 10, // Aggressive backoff
          maxRetryDelay: 5000, // Cap at 5 seconds
          verbose: true
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Claude failed') as any;
      error.exitCode = 1;
      
      mockExeca
        .mockRejectedValueOnce(error) // Attempt 1 fails
        .mockRejectedValueOnce(error) // Attempt 2 fails
        .mockRejectedValueOnce(error) // Attempt 3 fails
        .mockResolvedValueOnce({      // Attempt 4 succeeds
          exitCode: 0,
          stdout: 'Success',
          stderr: ''
        } as any);
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      
      // Second retry: should be 10000ms but capped at 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      
      // Third retry: also capped at 5000ms
      await vi.advanceTimersByTimeAsync(5000);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(3);
      
      // Verify delay capping
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 1000ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 5000ms'));
    });
  });

  describe('Non-retryable errors', () => {
    it('should not retry on exit code 127 (command not found)', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Command not found') as any;
      error.exitCode = 127;
      error.stderr = 'claude: command not found';
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('code 127');
      expect(result.retryAttempts).toBe(0);
      
      // Should only be called twice: once for path detection, once for execution
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permission denied errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Permission denied') as any;
      error.message = 'Permission denied accessing file';
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      expect(result.retryAttempts).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });

    it('should not retry on ENOENT errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.retryAttempts).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });

  describe('Exhausted retries', () => {
    it('should fail after max retries are exhausted', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 2,
          retryDelay: 100,
          verbose: true
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Persistent error') as any;
      error.exitCode = 1;
      error.stdout = 'Error output';
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('code 1');
      expect(result.retryAttempts).toBe(2);
      expect(result.output).toBe('Error output');
      
      // Verify all retry attempts were logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('attempt 1/3'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('attempt 2/3'));
      
      // Should be called 3 times after path detection
      expect(mockExeca).toHaveBeenCalledTimes(4);
    });
  });

  describe('Backward compatibility', () => {
    it('should not retry when maxRetries is explicitly set to 0', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 0 // Explicitly disable retries
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Error') as any;
      error.exitCode = 1;
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.retryAttempts).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(2); // Path detection + 1 attempt
    });

    it('should work with default retry config', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true
          // Uses new defaults: maxRetries: 3, retryDelay: 2000, etc.
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      mockExeca.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Success',
        stderr: ''
      } as any);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(0);
    });
  });

  describe('Exit code 2 retries', () => {
    it('should retry on exit code 2', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Claude error') as any;
      error.exitCode = 2;
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Success after retry',
          stderr: ''
        } as any);
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
      expect(result.output).toBe('Success after retry');
    });
  });

  describe('ETIMEDOUT retries', () => {
    it('should retry on ETIMEDOUT error code', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Request timeout') as any;
      error.code = 'ETIMEDOUT';
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Success after timeout retry',
          stderr: ''
        } as any);
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
    });
  });
});