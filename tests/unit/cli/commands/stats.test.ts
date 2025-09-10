import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerStatsCommands } from '../../../../src/cli/commands/stats.js';
import { TaskService } from '../../../../src/core/task.js';
import { NavigationService } from '../../../../src/core/navigation.js';
import { Task } from '../../../../src/core/types.js';
import { setupCommand, addGlobalOptions } from './test-helpers.js';

// Mock formatters
vi.mock('../../../../src/cli/formatters.js', () => ({
    formatStats: vi.fn((stats: any) => {
        return `Total: ${stats.total}, Completed: ${stats.completed}, Pending: ${stats.pending}`;
    })
}));

describe('Stats Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    let mockTaskService: Partial<TaskService>;
    let mockNavigationService: Partial<NavigationService>;

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

    const mockStats = {
        total: 10,
        completed: 4,
        pending: 3,
        inProgress: 2,
        cancelled: 1,
        completionRate: 40,
        avgCompletionTime: 120000,
        createdToday: 2,
        completedToday: 1,
        topLevelTasks: 5,
        leafTasks: 5,
        tasksWithDependencies: 3,
        blockedTasks: 1,
        readyTasks: 2
    };

    beforeEach(() => {
        program = new Command();
        program.exitOverride();
        
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        mockTaskService = {
            getStats: vi.fn()
        };

        mockNavigationService = {
            getCurrentTask: vi.fn(),
            getRemainingTaskCount: vi.fn()
        };

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('stats command', () => {
        beforeEach(() => {
            registerStatsCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'stats', {
                _taskService: mockTaskService
            });
        });

        it('should display formatted statistics', async () => {
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);

            await program.parseAsync(['node', 'test', 'stats']);

            expect(mockTaskService.getStats).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Total: 10, Completed: 4, Pending: 3')
            );
        });

        it('should output JSON format when requested', async () => {
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);

            await program.parseAsync(
                ['node', 'test', 'stats', '--json'],
                { 
                    _taskService: mockTaskService,
                    json: true
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockStats, null, 2));
        });

        it('should handle empty statistics', async () => {
            const emptyStats = {
                total: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                cancelled: 0,
                completionRate: 0,
                avgCompletionTime: 0,
                createdToday: 0,
                completedToday: 0,
                topLevelTasks: 0,
                leafTasks: 0,
                tasksWithDependencies: 0,
                blockedTasks: 0,
                readyTasks: 0
            };

            (mockTaskService.getStats as Mock).mockReturnValue(emptyStats);

            await program.parseAsync(['node', 'test', 'stats']);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Total: 0, Completed: 0, Pending: 0')
            );
        });

        it('should calculate correct completion rate', async () => {
            const statsWithHighCompletion = {
                ...mockStats,
                total: 100,
                completed: 75,
                completionRate: 75
            };

            (mockTaskService.getStats as Mock).mockReturnValue(statsWithHighCompletion);

            await program.parseAsync(
                ['node', 'test', 'stats', '--json'],
                { 
                    _taskService: mockTaskService,
                    json: true
                }
            );

            const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
            expect(output.completionRate).toBe(75);
        });
    });

    describe('status command', () => {
        beforeEach(() => {
            registerStatsCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'status', {
                _taskService: mockTaskService,
                _navigationService: mockNavigationService
            });
        });

        it('should display overall project status', async () => {
            const currentTask = createMockTask('2.0', 'Current Task', 'in_progress');
            
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(6);

            await program.parseAsync(['node', 'test', 'status']);

            expect(mockTaskService.getStats).toHaveBeenCalled();
            expect(mockNavigationService.getCurrentTask).toHaveBeenCalled();
            expect(mockNavigationService.getRemainingTaskCount).toHaveBeenCalled();

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Total: 10, Completed: 4, Pending: 3')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Current task: 2.0 Current Task')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Remaining tasks: 6')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Overall progress: 40%')
            );
        });

        it('should handle no current task', async () => {
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(0);

            await program.parseAsync(['node', 'test', 'status']);

            expect(consoleLogSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('Current task:')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Remaining tasks: 0')
            );
        });

        it('should output JSON format when requested', async () => {
            const currentTask = createMockTask('2.0', 'Current Task');
            
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(currentTask);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(6);

            await program.parseAsync(
                ['node', 'test', 'status', '--json'],
                { 
                    _taskService: mockTaskService,
                    _navigationService: mockNavigationService,
                    json: true
                }
            );

            const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
            
            expect(output).toMatchObject({
                stats: mockStats,
                currentTask,
                remaining: 6,
                lastUpdated: expect.any(String)
            });
        });

        it('should handle zero total tasks for progress calculation', async () => {
            const emptyStats = {
                ...mockStats,
                total: 0,
                completed: 0
            };

            (mockTaskService.getStats as Mock).mockReturnValue(emptyStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(0);

            await program.parseAsync(['node', 'test', 'status']);

            // Should not attempt to show progress percentage when no tasks exist
            expect(consoleLogSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('Overall progress:')
            );
        });

        it('should calculate correct progress percentage', async () => {
            const partialStats = {
                ...mockStats,
                total: 8,
                completed: 3,
                completionRate: 37.5
            };

            (mockTaskService.getStats as Mock).mockReturnValue(partialStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(5);

            await program.parseAsync(['node', 'test', 'status']);

            // Math.round(3/8 * 100) = 38
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Overall progress: 38%')
            );
        });

        it('should show 100% progress when all tasks completed', async () => {
            const completedStats = {
                ...mockStats,
                total: 10,
                completed: 10,
                pending: 0,
                inProgress: 0,
                completionRate: 100
            };

            (mockTaskService.getStats as Mock).mockReturnValue(completedStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(0);

            await program.parseAsync(['node', 'test', 'status']);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('Overall progress: 100%')
            );
        });

        it('should include timestamp in JSON output', async () => {
            const beforeTime = new Date().toISOString();
            
            (mockTaskService.getStats as Mock).mockReturnValue(mockStats);
            (mockNavigationService.getCurrentTask as Mock).mockReturnValue(null);
            (mockNavigationService.getRemainingTaskCount as Mock).mockReturnValue(0);

            await program.parseAsync(
                ['node', 'test', 'status', '--json'],
                { 
                    _taskService: mockTaskService,
                    _navigationService: mockNavigationService,
                    json: true
                }
            );

            const afterTime = new Date().toISOString();
            const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
            
            expect(new Date(output.lastUpdated).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
            expect(new Date(output.lastUpdated).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
        });
    });
});