import { execSync } from 'child_process';

export class GitFileTracker {
    private taskStartStates = new Map<string, string>();

    // Check if we're in a git repository
    isGitRepo(): boolean {
        try {
            execSync('git rev-parse --git-dir', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    // Capture git state when task starts
    onTaskStart(taskNumber: string): void {
        if (!this.isGitRepo()) return;

        try {
            const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            this.taskStartStates.set(taskNumber, currentCommit);
        } catch (error) {
            // Ignore errors - might be initial commit or other issues
        }
    }

    // Detect changed files when task completes
    onTaskComplete(taskNumber: string): string[] {
        if (!this.isGitRepo()) return [];

        try {
            const startCommit = this.taskStartStates.get(taskNumber);
            const changedFiles = new Set<string>();

            // Get uncommitted changes
            const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
            gitStatus.split('\n').forEach(line => {
                const file = line.substring(3).trim();
                if (file) changedFiles.add(file);
            });

            // Get committed changes since task started
            if (startCommit) {
                try {
                    const gitDiff = execSync(
                        `git diff --name-only ${startCommit} HEAD`,
                        { encoding: 'utf8' }
                    );
                    gitDiff.split('\n').filter(Boolean).forEach(file => changedFiles.add(file));
                } catch {
                    // Ignore errors - might be if startCommit doesn't exist anymore
                }
            }

            // Clean up
            this.taskStartStates.delete(taskNumber);

            return Array.from(changedFiles).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    // Get current branch
    getCurrentBranch(): string | null {
        if (!this.isGitRepo()) return null;

        try {
            return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        } catch {
            return null;
        }
    }

    // Get last commit info
    getLastCommitInfo(): { hash: string; message: string; date: Date } | null {
        if (!this.isGitRepo()) return null;

        try {
            const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            const message = execSync('git log -1 --pretty=format:%s', { encoding: 'utf8' }).trim();
            const dateStr = execSync('git log -1 --pretty=format:%ci', { encoding: 'utf8' }).trim();
            
            return {
                hash: hash.substring(0, 7),
                message,
                date: new Date(dateStr)
            };
        } catch {
            return null;
        }
    }

    // Check if there are uncommitted changes
    hasUncommittedChanges(): boolean {
        if (!this.isGitRepo()) return false;

        try {
            const status = execSync('git status --porcelain', { encoding: 'utf8' });
            return status.trim().length > 0;
        } catch {
            return false;
        }
    }


    // Get repository root
    getRepoRoot(): string | null {
        if (!this.isGitRepo()) return null;

        try {
            return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
        } catch {
            return null;
        }
    }
}

// Integration functions for task completion
export async function completeTaskWithGit(
    taskService: any,
    taskNumber: string,
    notes?: string
): Promise<void> {
    const tracker = new GitFileTracker();
    
    // Track files before completion
    const files = tracker.onTaskComplete(taskNumber);
    
    // Update task with completion and files
    const updates: any = { 
        status: 'completed',
        files: files.length > 0 ? files : undefined
    };
    
    if (notes) {
        updates.completion_notes = notes;
    }
    
    await taskService.update(taskNumber, updates);
}

export async function startTaskWithGit(
    taskService: any,
    taskNumber: string
): Promise<void> {
    const tracker = new GitFileTracker();
    
    // Start tracking
    tracker.onTaskStart(taskNumber);
    
    // Update task status
    await taskService.update(taskNumber, { status: 'in_progress' });
}