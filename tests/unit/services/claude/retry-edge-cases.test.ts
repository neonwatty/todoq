import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeService } from '../../../../src/services/claude/claude-service.js';
import { execa } from 'execa';
import type { TaskContext, TodoqConfig } from '../../../../src/core/types.js';

vi.mock('execa');
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn()
}));

describe('Claude Service Retry Edge Cases', () => {
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

  describe('Mixed error scenarios', () => {
    it('should stop retrying when encountering non-retryable error after retryable ones', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 5,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      // Mock Claude path detection
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const retryableError = new Error('Temporary failure') as any;
      retryableError.exitCode = 1;
      
      const nonRetryableError = new Error('Command not found') as any;
      nonRetryableError.exitCode = 127;
      
      mockExeca
        .mockRejectedValueOnce(retryableError)  // First attempt - retryable
        .mockRejectedValueOnce(retryableError)  // Second attempt - retryable
        .mockRejectedValueOnce(nonRetryableError); // Third attempt - not retryable
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('code 127');
      expect(result.retryAttempts).toBe(2); // Two retries before hitting non-retryable
      expect(mockExeca).toHaveBeenCalledTimes(4); // Path + 3 attempts
    });

    it('should handle timeout error with timedOut flag', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const timeoutError = new Error('Operation timed out') as any;
      timeoutError.timedOut = true;
      timeoutError.signal = 'SIGTERM';
      
      mockExeca
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Success after timeout',
          stderr: ''
        } as any);
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
    });
  });

  describe('Backoff calculations', () => {
    it('should calculate correct delays with multiplier of 1 (no backoff)', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3,
          retryDelay: 1000,
          retryBackoffMultiplier: 1, // No exponential growth
          verbose: true
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Error') as any;
      error.exitCode = 1;
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      // All delays should be 1000ms with multiplier of 1
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      
      await resultPromise;
      
      // Verify retry messages were logged with 1000ms delay
      const retryCalls = consoleSpy.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('Retrying in')
      );
      
      expect(retryCalls.length).toBeGreaterThan(0);
      retryCalls.forEach(call => {
        expect(call[0]).toContain('1000ms');
      });
    });

    it('should handle fractional backoff multipliers', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3,
          retryDelay: 1000,
          retryBackoffMultiplier: 1.5,
          verbose: true
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Error') as any;
      error.exitCode = 1;
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: 'Success',
          stderr: ''
        } as any);
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      // Expected delays: 1000, 1500, 2250
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1500);
      await vi.advanceTimersByTimeAsync(2250);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 1000ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 1500ms'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Retrying in 2250ms'));
    });
  });

  describe('Output preservation', () => {
    it('should preserve output from failed attempts', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 2,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error1 = new Error('First failure') as any;
      error1.exitCode = 1;
      error1.stdout = 'Output from first attempt';
      
      const error2 = new Error('Second failure') as any;
      error2.exitCode = 1;
      error2.stdout = 'Output from second attempt';
      
      const error3 = new Error('Final failure') as any;
      error3.exitCode = 1;
      error3.stdout = 'Output from final attempt';
      
      mockExeca
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockRejectedValueOnce(error3);
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.output).toBe('Output from final attempt');
      expect(result.retryAttempts).toBe(2);
    });

    it('should handle stderr output in errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 1,
          retryDelay: 100
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Error with stderr') as any;
      error.exitCode = 1;
      error.stderr = 'Error details from stderr';
      error.stdout = ''; // No stdout
      
      mockExeca
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error); // Will retry once due to exit code 1
      
      const resultPromise = claudeService.executeTodoqNextPrompt(mockContext);
      
      await vi.advanceTimersByTimeAsync(100); // Advance for the retry
      
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.output).toBe('Error details from stderr');
      expect(result.retryAttempts).toBe(1);
    });
  });

  describe('Immediate success scenarios', () => {
    it('should not retry on immediate success', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 5,
          retryDelay: 1000
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      mockExeca.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'Immediate success',
        stderr: ''
      } as any);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(0);
      expect(result.output).toBe('Immediate success');
      expect(mockExeca).toHaveBeenCalledTimes(2); // Path + 1 successful attempt
    });
  });

  describe('Permission error variations', () => {
    it('should not retry on stderr permission denied', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('Failed') as any;
      error.stderr = 'Error: Permission denied while accessing file';
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.retryAttempts).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });

    it('should handle case-insensitive permission errors', async () => {
      const config: TodoqConfig = {
        claude: {
          enabled: true,
          maxRetries: 3
        }
      };
      
      claudeService = new ClaudeService(undefined, undefined, config);
      
      mockExeca.mockResolvedValueOnce({ stdout: 'Claude CLI v1.0.0' } as any);
      
      const error = new Error('PERMISSION DENIED') as any;
      
      mockExeca.mockRejectedValueOnce(error);
      
      const result = await claudeService.executeTodoqNextPrompt(mockContext);
      
      expect(result.success).toBe(false);
      expect(result.retryAttempts).toBe(0);
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });
});