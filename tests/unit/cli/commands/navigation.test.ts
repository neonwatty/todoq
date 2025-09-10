import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerNavigationCommands } from '../../../../src/cli/commands/navigation.js';
import { NavigationService } from '../../../../src/core/navigation.js';
import { TaskService } from '../../../../src/core/task.js';
import { TodoqConfig } from '../../../../src/core/types.js';
import { Task } from '../../../../src/core/types.js';
import { setupCommand, addGlobalOptions } from './test-helpers.js';

// Mock chalk
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        cyan: (text: string) => text,
        white: (text: string) => text,
        bold: (text: string) => text,
        dim: (text: string) => text
    }
}));

// Mock formatters
vi.mock('../../../../src/cli/formatters.js', () => ({
    formatTask: vi.fn((task: Task) => `Task ${task.taskNumber}: ${task.name}`)
}));

describe('Navigation Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    let mockNavigationService: Partial<NavigationService>;
    let mockTaskService: Partial<TaskService>;
    let mockConfig: TodoqConfig;

    const createMockTask = (number: string, name: string, status: string = 'pending'): Task => ({
        id: number,
        taskNumber: number,
        name,
        description: `Description for ${name}`,
        status: status as any,
        priority: 1,
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dependencies: [],
        files: [],
        docsReferences: [],
        testingStrategy: null,
        notes: null,
        completionNotes: null
    });

    beforeEach(() => {
        program = new Command();
        program.exitOverride();
        
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        mockConfig = {
            database: { path: '/test/path.db' },
            display: { showFileLinks: true, showDependencies: false, relativePaths: true, compactMode: false },
            defaults: { priority: 1, status: 'pending' }
        };

        mockNavigationService = {
            getCurrentTask: vi.fn(),
            getNextTask: vi.fn(),
            getPreviousTask: vi.fn(),
            getRemainingTaskCount: vi.fn(),
            getTaskProgress: vi.fn(),
            searchTasks: vi.fn()
        };

        mockTaskService = {
            update: vi.fn(),
            completeTask: vi.fn()
        };

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('current command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'current', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should display current task', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);

            await program.parseAsync(['node', 'test', 'current']);

            expect(mockNavigationService.getCurrentTask).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task 1.0: Current Task'));
        });

        it('should show message when no current task exists', async () => {
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);

            await program.parseAsync(['node', 'test', 'current']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No current task found'));
        });

        it('should output task number only with --number flag', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--number'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith('1.0');
        });

        it('should output JSON format when requested', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--json'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(currentTask, null, 2));
        });

        it('should mark current task as completed', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const completedTask = { ...currentTask, status: 'completed' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.completeTask as Mock).mockReturnValue({ 
                task: completedTask, 
                autoCompleted: [] 
            });

            await program.parseAsync(
                ['node', 'test', 'current', '--complete'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', undefined);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Completed task 1.0: Current Task'));
        });

        it('should mark current task as completed with notes', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const completedTask = { ...currentTask, status: 'completed', completionNotes: 'Task done' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.completeTask as Mock).mockReturnValue({ 
                task: completedTask, 
                autoCompleted: [] 
            });

            await program.parseAsync(
                ['node', 'test', 'current', '--complete', '--notes', 'Task done'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', 'Task done');
        });

        it('should show auto-completed parent tasks', async () => {
            const currentTask = createMockTask('1.1', 'Child Task');
            const completedTask = { ...currentTask, status: 'completed' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.completeTask as Mock).mockReturnValue({ 
                task: completedTask, 
                autoCompleted: ['1.0'] 
            });

            await program.parseAsync(
                ['node', 'test', 'current', '--complete'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-completed parent tasks: 1.0'));
        });

        it('should force complete without dependency checks', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const completedTask = { ...currentTask, status: 'completed' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.update as Mock).mockReturnValue(completedTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--complete', '--force'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'completed' });
            expect(mockTaskService.completeTask).not.toHaveBeenCalled();
        });

        it('should mark current task as in progress', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const inProgressTask = { ...currentTask, status: 'in_progress' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.update as Mock).mockReturnValue(inProgressTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--start'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'in_progress' });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('→ Started task 1.0: Current Task'));
        });

        it('should reopen current task', async () => {
            const currentTask = createMockTask('1.0', 'Current Task', 'completed');
            const reopenedTask = { ...currentTask, status: 'pending' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.update as Mock).mockReturnValue(reopenedTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--reopen'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'pending' });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('○ Reopened task 1.0: Current Task'));
        });

        it('should cancel current task', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const cancelledTask = { ...currentTask, status: 'cancelled' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.update as Mock).mockReturnValue(cancelledTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--cancel'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'cancelled' });
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✗ Cancelled task 1.0: Current Task'));
        });

        it('should cancel current task with notes', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            const cancelledTask = { ...currentTask, status: 'cancelled', completionNotes: 'Not needed' };
            
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockTaskService.update as Mock).mockReturnValue(cancelledTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--cancel', '--notes', 'Not needed'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { 
                status: 'cancelled',
                completion_notes: 'Not needed'
            });
        });

        it('should reject multiple status flags', async () => {
            const currentTask = createMockTask('1.0', 'Current Task');
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);

            await program.parseAsync(
                ['node', 'test', 'current', '--complete', '--start'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Only one status flag can be used at a time')
            );
            expect(mockTaskService.update).not.toHaveBeenCalled();
            expect(mockTaskService.completeTask).not.toHaveBeenCalled();
        });

        it('should show error when trying to update non-existent task', async () => {
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);

            await program.parseAsync(
                ['node', 'test', 'current', '--complete'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('No current task found to update status')
            );
            expect(mockTaskService.completeTask).not.toHaveBeenCalled();
        });
    });

    describe('next command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'next', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should display next task', async () => {
            const nextTask = createMockTask('2.0', 'Next Task');
            (mockNavigationService.getNextTask as Mock).mockReturnValue(nextTask);

            await program.parseAsync(
                ['node', 'test', 'next'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.getNextTask).toHaveBeenCalledWith(undefined);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task 2.0: Next Task'));
        });

        it('should display next task from specified current', async () => {
            const nextTask = createMockTask('2.0', 'Next Task');
            (mockNavigationService.getNextTask as Mock).mockReturnValue(nextTask);

            await program.parseAsync(
                ['node', 'test', 'next', '1.0'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.getNextTask).toHaveBeenCalledWith('1.0');
        });

        it('should show message when no next task exists', async () => {
            (mockNavigationService.getNextTask as Mock).mockReturnValue(null);

            await program.parseAsync(
                ['node', 'test', 'next'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No next task found'));
        });

        it('should output task number only with --number flag', async () => {
            const nextTask = createMockTask('2.0', 'Next Task');
            (mockNavigationService.getNextTask as Mock).mockReturnValue(nextTask);

            await program.parseAsync(
                ['node', 'test', 'next', '--number'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith('2.0');
        });

        it('should output JSON format when requested', async () => {
            const nextTask = createMockTask('2.0', 'Next Task');
            (mockNavigationService.getNextTask as Mock).mockReturnValue(nextTask);

            await program.parseAsync(
                ['node', 'test', 'next', '--json'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(nextTask, null, 2));
        });
    });

    describe('prev command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'prev', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should display previous task', async () => {
            const prevTask = createMockTask('1.0', 'Previous Task');
            (mockNavigationService.getPreviousTask as Mock).mockReturnValue(prevTask);

            await program.parseAsync(
                ['node', 'test', 'prev', '2.0'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.getPreviousTask).toHaveBeenCalledWith('2.0');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task 1.0: Previous Task'));
        });

        it('should require current task number', async () => {
            await program.parseAsync(
                ['node', 'test', 'prev'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Please provide current task number'));
            expect(mockNavigationService.getPreviousTask).not.toHaveBeenCalled();
        });

        it('should show message when no previous task exists', async () => {
            (mockNavigationService.getPreviousTask as Mock).mockReturnValue(null);

            await program.parseAsync(
                ['node', 'test', 'prev', '1.0'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No previous task found'));
        });

        it('should work with previous alias', async () => {
            const prevTask = createMockTask('1.0', 'Previous Task');
            (mockNavigationService.getPreviousTask as Mock).mockReturnValue(prevTask);

            await program.parseAsync(
                ['node', 'test', 'previous', '2.0'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.getPreviousTask).toHaveBeenCalledWith('2.0');
        });
    });

    describe('remaining command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'remaining', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should display remaining task count', async () => {
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(5);

            await program.parseAsync(
                ['node', 'test', 'remaining'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('5 tasks remaining'));
        });

        it('should output count only with --count flag', async () => {
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(5);

            await program.parseAsync(
                ['node', 'test', 'remaining', '--count'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(5);
        });

        it('should output JSON format when requested', async () => {
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(5);

            await program.parseAsync(
                ['node', 'test', 'remaining', '--json'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ remaining: 5 }));
        });
    });

    describe('progress command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'progress', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should display task progress tree', async () => {
            const progress = [
                {
                    taskNumber: '1.0',
                    name: 'Parent Task',
                    status: 'in_progress',
                    totalChildren: 2,
                    completedChildren: 1,
                    completionPercentage: 50
                },
                {
                    taskNumber: '1.1',
                    name: 'Child 1',
                    status: 'completed',
                    totalChildren: 0,
                    completedChildren: 0,
                    completionPercentage: 100
                },
                {
                    taskNumber: '1.2',
                    name: 'Child 2',
                    status: 'pending',
                    totalChildren: 0,
                    completedChildren: 0,
                    completionPercentage: 0
                }
            ];

            (mockNavigationService.getTaskProgress as Mock).mockReturnValue(progress);

            await program.parseAsync(
                ['node', 'test', 'progress'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task Progress:'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('→ 1.0 Parent Task [50%]'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ 1.1 Child 1'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('○ 1.2 Child 2'));
        });

        it('should output JSON format when requested', async () => {
            const progress = [
                {
                    taskNumber: '1.0',
                    name: 'Parent Task',
                    status: 'pending',
                    totalChildren: 0,
                    completedChildren: 0,
                    completionPercentage: 0
                }
            ];

            (mockNavigationService.getTaskProgress as Mock).mockReturnValue(progress);

            await program.parseAsync(
                ['node', 'test', 'progress', '--json'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(progress, null, 2));
        });
    });

    describe('search command', () => {
        beforeEach(() => {
            registerNavigationCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'search', {
                _config: mockConfig,
                _navigationService: mockNavigationService,
                _taskService: mockTaskService
            });
        });

        it('should search and display matching tasks', async () => {
            const results = [
                createMockTask('1.0', 'Matching Task'),
                createMockTask('2.0', 'Another Match')
            ];

            (mockNavigationService.searchTasks as Mock).mockReturnValue(results);

            await program.parseAsync(
                ['node', 'test', 'search', 'match'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.searchTasks).toHaveBeenCalledWith('match');
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Search results for "match"'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task 1.0: Matching Task'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task 2.0: Another Match'));
        });

        it('should show message when no matches found', async () => {
            (mockNavigationService.searchTasks as Mock).mockReturnValue([]);

            await program.parseAsync(
                ['node', 'test', 'search', 'nonexistent'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No tasks found matching "nonexistent"'));
        });

        it('should output JSON format when requested', async () => {
            const results = [createMockTask('1.0', 'Matching Task')];
            (mockNavigationService.searchTasks as Mock).mockReturnValue(results);

            await program.parseAsync(
                ['node', 'test', 'search', 'match', '--json'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(results, null, 2));
        });

        it('should work with find alias', async () => {
            const results = [createMockTask('1.0', 'Found Task')];
            (mockNavigationService.searchTasks as Mock).mockReturnValue(results);

            await program.parseAsync(
                ['node', 'test', 'find', 'task'],
                { 
                    _config: mockConfig, 
                    _navigationService: mockNavigationService,
                    _taskService: mockTaskService
                }
            );

            expect(mockNavigationService.searchTasks).toHaveBeenCalledWith('task');
        });
    });
});