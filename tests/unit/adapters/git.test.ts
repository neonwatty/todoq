import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { GitFileTracker, completeTaskWithGit, startTaskWithGit } from '../../../src/adapters/git/index.js';

// Mock child_process
vi.mock('child_process', () => ({
    execSync: vi.fn()
}));

const mockExecSync = vi.mocked(execSync);

describe('GitFileTracker', () => {
    let tracker: GitFileTracker;

    beforeEach(() => {
        tracker = new GitFileTracker();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isGitRepo', () => {
        it('should return true when in git repository', () => {
            mockExecSync.mockReturnValueOnce('.git' as any);

            const result = tracker.isGitRepo();

            expect(result).toBe(true);
            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'ignore' });
        });

        it('should return false when not in git repository', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const result = tracker.isGitRepo();

            expect(result).toBe(false);
        });

        it('should handle execSync errors gracefully', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Command failed');
            });

            const result = tracker.isGitRepo();

            expect(result).toBe(false);
        });
    });

    describe('onTaskStart', () => {
        it('should capture current commit when in git repo', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce('abc123def456' as any); // git rev-parse HEAD

            tracker.onTaskStart('1.0');

            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'ignore' });
            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', { encoding: 'utf8' });
        });

        it('should do nothing when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            tracker.onTaskStart('1.0');

            expect(mockExecSync).toHaveBeenCalledTimes(1); // Only the isGitRepo check
        });

        it('should handle git rev-parse errors gracefully', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Not a git repository');
                });

            expect(() => tracker.onTaskStart('1.0')).not.toThrow();
        });
    });

    describe('onTaskComplete', () => {
        it('should return empty array when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const files = tracker.onTaskComplete('1.0');

            expect(files).toEqual([]);
        });

        it('should detect uncommitted changes', () => {
            const gitStatusOutput = ' M src/file1.ts\n A src/file2.ts\n?? src/file3.ts\n';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any); // git status --porcelain

            const files = tracker.onTaskComplete('1.0');

            expect(files).toContain('src/file1.ts');
            expect(files).toContain('src/file2.ts');
            expect(files).toContain('src/file3.ts');
            expect(mockExecSync).toHaveBeenCalledWith('git status --porcelain', { encoding: 'utf8' });
        });

        it('should detect changes since task start', () => {
            const startCommit = 'abc123def456';
            const gitStatusOutput = ' M src/file1.ts\n';
            const gitDiffOutput = 'src/file2.ts\nsrc/file3.ts\n';

            // Mock task start first
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check for onTaskStart
                .mockReturnValueOnce(`${startCommit}\n` as any); // git rev-parse HEAD for onTaskStart
            
            tracker.onTaskStart('1.0');

            // Now mock onTaskComplete
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any) // git status --porcelain
                .mockReturnValueOnce(gitDiffOutput as any); // git diff --name-only

            const files = tracker.onTaskComplete('1.0');

            expect(files).toContain('src/file1.ts');
            expect(files).toContain('src/file2.ts');
            expect(files).toContain('src/file3.ts');
            expect(mockExecSync).toHaveBeenCalledWith(
                `git diff --name-only ${startCommit} HEAD`,
                { encoding: 'utf8' }
            );
        });

        it('should handle git diff errors gracefully', () => {
            const startCommit = 'abc123def456';
            const gitStatusOutput = ' M src/file1.ts\n';

            // Mock task start
            mockExecSync
                .mockReturnValueOnce('.git' as any)
                .mockReturnValueOnce(`${startCommit}\n` as any);
            
            tracker.onTaskStart('1.0');

            // Mock onTaskComplete with git diff failing
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any) // git status --porcelain
                .mockImplementationOnce(() => { // git diff --name-only fails
                    throw new Error('Git diff failed');
                });

            const files = tracker.onTaskComplete('1.0');

            expect(files).toEqual(['src/file1.ts']); // Should still return status files
        });

        it('should filter out empty lines', () => {
            const gitStatusOutput = ' M src/file1.ts\n\n A src/file2.ts\n\n';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any)
                .mockReturnValueOnce(gitStatusOutput as any);

            const files = tracker.onTaskComplete('1.0');

            expect(files).toEqual(['src/file1.ts', 'src/file2.ts']);
        });

        it('should handle general errors gracefully', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('General git error');
                });

            const files = tracker.onTaskComplete('1.0');

            expect(files).toEqual([]);
        });
    });

    describe('getCurrentBranch', () => {
        it('should return current branch name', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce('main\n' as any); // git branch --show-current

            const branch = tracker.getCurrentBranch();

            expect(branch).toBe('main');
            expect(mockExecSync).toHaveBeenCalledWith('git branch --show-current', { encoding: 'utf8' });
        });

        it('should return null when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const branch = tracker.getCurrentBranch();

            expect(branch).toBeNull();
        });

        it('should return null when git command fails', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Git command failed');
                });

            const branch = tracker.getCurrentBranch();

            expect(branch).toBeNull();
        });
    });

    describe('getLastCommitInfo', () => {
        it('should return commit information', () => {
            const commitHash = 'abc123def456789';
            const commitMessage = 'Add new feature';
            const commitDate = '2024-01-01 12:00:00 +0000';

            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(`${commitHash}\n` as any) // git rev-parse HEAD
                .mockReturnValueOnce(`${commitMessage}\n` as any) // git log message
                .mockReturnValueOnce(`${commitDate}\n` as any); // git log date

            const info = tracker.getLastCommitInfo();

            expect(info).toEqual({
                hash: 'abc123d', // First 7 characters
                message: commitMessage,
                date: new Date(commitDate)
            });
        });

        it('should return null when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const info = tracker.getLastCommitInfo();

            expect(info).toBeNull();
        });

        it('should return null when git commands fail', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Git command failed');
                });

            const info = tracker.getLastCommitInfo();

            expect(info).toBeNull();
        });
    });

    describe('hasUncommittedChanges', () => {
        it('should return true when there are uncommitted changes', () => {
            const gitStatusOutput = ' M src/file1.ts\n A src/file2.ts\n';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any); // git status --porcelain

            const hasChanges = tracker.hasUncommittedChanges();

            expect(hasChanges).toBe(true);
        });

        it('should return false when there are no uncommitted changes', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce('   \n' as any); // git status --porcelain (empty)

            const hasChanges = tracker.hasUncommittedChanges();

            expect(hasChanges).toBe(false);
        });

        it('should return false when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const hasChanges = tracker.hasUncommittedChanges();

            expect(hasChanges).toBe(false);
        });

        it('should return false when git command fails', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Git command failed');
                });

            const hasChanges = tracker.hasUncommittedChanges();

            expect(hasChanges).toBe(false);
        });
    });

    describe('getRepoRoot', () => {
        it('should return repository root path', () => {
            const repoRoot = '/home/user/project';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(`${repoRoot}\n` as any); // git rev-parse --show-toplevel

            const root = tracker.getRepoRoot();

            expect(root).toBe(repoRoot);
            expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --show-toplevel', { encoding: 'utf8' });
        });

        it('should return null when not in git repo', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            const root = tracker.getRepoRoot();

            expect(root).toBeNull();
        });

        it('should return null when git command fails', () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Git command failed');
                });

            const root = tracker.getRepoRoot();

            expect(root).toBeNull();
        });
    });
});

describe('Git Integration Functions', () => {
    let mockTaskService: any;

    beforeEach(() => {
        mockTaskService = {
            update: vi.fn()
        };
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('completeTaskWithGit', () => {
        it('should complete task with git file tracking', async () => {
            const gitStatusOutput = ' M src/file1.ts\n A src/file2.ts\n';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any); // git status --porcelain

            await completeTaskWithGit(mockTaskService, '1.0', 'Task completed');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'completed',
                files: ['src/file1.ts', 'src/file2.ts'],
                completion_notes: 'Task completed'
            });
        });

        it('should complete task without files when none changed', async () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce('   \n' as any); // git status --porcelain (empty)

            await completeTaskWithGit(mockTaskService, '1.0');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'completed',
                files: undefined
            });
        });

        it('should handle task completion without notes', async () => {
            const gitStatusOutput = ' M src/file1.ts\n';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(gitStatusOutput as any); // git status --porcelain

            await completeTaskWithGit(mockTaskService, '1.0');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'completed',
                files: ['src/file1.ts']
            });
        });

        it('should handle non-git repositories', async () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            await completeTaskWithGit(mockTaskService, '1.0', 'Task completed');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'completed',
                files: undefined,
                completion_notes: 'Task completed'
            });
        });
    });

    describe('startTaskWithGit', () => {
        it('should start task with git tracking', async () => {
            const commitHash = 'abc123def456';
            
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockReturnValueOnce(`${commitHash}\n` as any); // git rev-parse HEAD

            await startTaskWithGit(mockTaskService, '1.0');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'in_progress'
            });
        });

        it('should handle non-git repositories', async () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('Not a git repository');
            });

            await startTaskWithGit(mockTaskService, '1.0');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'in_progress'
            });
        });

        it('should handle git errors gracefully', async () => {
            mockExecSync
                .mockReturnValueOnce('.git' as any) // isGitRepo check
                .mockImplementationOnce(() => {
                    throw new Error('Git rev-parse failed');
                });

            await startTaskWithGit(mockTaskService, '1.0');

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
                status: 'in_progress'
            });
        });
    });
});