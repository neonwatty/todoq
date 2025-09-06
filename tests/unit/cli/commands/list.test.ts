import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerListCommands } from '../../../../src/cli/commands/list.js';
import { TaskService } from '../../../../src/core/task.js';
import { TodoqConfig, Task } from '../../../../src/core/types.js';
import { setupCommand, addGlobalOptions } from './test-helpers.js';

// Mock formatters
vi.mock('../../../../src/cli/formatters.js', () => ({
    formatTaskList: vi.fn((tasks: Task[], config: TodoqConfig, format: string, detailed: boolean) => {
        if (format === 'tree') {
            return 'Tree view of tasks';
        }
        return `List of ${tasks.length} tasks`;
    })
}));

describe('List Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    let mockTaskService: Partial<TaskService>;
    let mockConfig: TodoqConfig;

    const createMockTask = (number: string, name: string, status: string = 'pending', parentId: string | null = null): Task => ({
        id: number,
        taskNumber: number,
        name,
        description: `Description for ${name}`,
        status: status as any,
        priority: 1,
        parentId,
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
            display: { 
                showFileLinks: true, 
                showDependencies: false, 
                relativePaths: true, 
                compactMode: false,
                showCompleted: false,
                format: 'list'
            },
            defaults: { priority: 1, status: 'pending' }
        };

        mockTaskService = {
            list: vi.fn()
        };

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('list command', () => {
        beforeEach(() => {
            registerListCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'list', {
                _config: mockConfig,
                _taskService: mockTaskService
            });
        });

        it('should list all tasks', async () => {
            const tasks = [
                createMockTask('1.0', 'Task 1'),
                createMockTask('2.0', 'Task 2'),
                createMockTask('3.0', 'Task 3')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['list'], { from: 'user' });

            expect(mockTaskService.list).toHaveBeenCalledWith({});
            expect(consoleLogSpy).toHaveBeenCalledWith('List of 3 tasks');
        });

        it('should work with ls alias', async () => {
            const tasks = [createMockTask('1.0', 'Task 1')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'ls'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalled();
        });

        it('should filter tasks by status', async () => {
            const tasks = [
                createMockTask('1.0', 'Task 1', 'pending'),
                createMockTask('2.0', 'Task 2', 'pending')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--status', 'pending'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalledWith({ status: 'pending' });
        });

        it('should filter by parent task', async () => {
            const tasks = [
                createMockTask('1.1', 'Child 1', 'pending', '1.0'),
                createMockTask('1.2', 'Child 2', 'pending', '1.0')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--parent', '1.0'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalledWith({ parentNumber: '1.0' });
        });

        it('should filter out subtasks with --no-subtasks', async () => {
            const allTasks = [
                createMockTask('1.0', 'Parent', 'pending', null),
                createMockTask('1.1', 'Child', 'pending', '1.0'),
                createMockTask('2.0', 'Another Parent', 'pending', null)
            ];

            (mockTaskService.list as Mock).mockReturnValue(allTasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--no-subtasks'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            // Verify the formatter was called with filtered tasks (only parents)
            const formatTaskListMock = (await import('../../../../src/cli/formatters.js')).formatTaskList as Mock;
            expect(formatTaskListMock).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ taskNumber: '1.0' }),
                    expect.objectContaining({ taskNumber: '2.0' })
                ]),
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
        });

        it('should show tree format', async () => {
            const tasks = [
                createMockTask('1.0', 'Parent'),
                createMockTask('1.1', 'Child', 'pending', '1.0')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--tree'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith('Tree view of tasks');
        });

        it('should use specified format', async () => {
            const tasks = [createMockTask('1.0', 'Task')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--format', 'table'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            const formatTaskListMock = (await import('../../../../src/cli/formatters.js')).formatTaskList as Mock;
            expect(formatTaskListMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                'table',
                false
            );
        });

        it('should include completed tasks with --completed flag', async () => {
            const tasks = [
                createMockTask('1.0', 'Task 1', 'completed'),
                createMockTask('2.0', 'Task 2', 'pending')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--completed'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalledWith({ includeCompleted: true });
        });

        it('should include completed tasks when config showCompleted is true', async () => {
            const configWithCompleted = {
                ...mockConfig,
                display: { ...mockConfig.display, showCompleted: true }
            };

            const tasks = [createMockTask('1.0', 'Task', 'completed')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            // Update the command with the new config
            setupCommand(program, 'list', {
                _config: configWithCompleted,
                _taskService: mockTaskService
            });

            await program.parseAsync(['node', 'test', 'list']);

            expect(mockTaskService.list).toHaveBeenCalledWith({ includeCompleted: true });
        });

        it('should show detailed view', async () => {
            const tasks = [createMockTask('1.0', 'Task')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--detailed'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            const formatTaskListMock = (await import('../../../../src/cli/formatters.js')).formatTaskList as Mock;
            expect(formatTaskListMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.anything(),
                true // detailed flag
            );
        });

        it('should output JSON format', async () => {
            const tasks = [
                createMockTask('1.0', 'Task 1'),
                createMockTask('2.0', 'Task 2')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--json'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(tasks, null, 2));
        });

        it('should combine multiple filters', async () => {
            const tasks = [createMockTask('1.1', 'Child Task', 'in_progress', '1.0')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--status', 'in_progress', '--parent', '1.0', '--completed'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalledWith({
                status: 'in_progress',
                parentNumber: '1.0',
                includeCompleted: true
            });
        });

        it('should use config format as default', async () => {
            const configWithTreeFormat = {
                ...mockConfig,
                display: { ...mockConfig.display, format: 'tree' }
            };

            const tasks = [createMockTask('1.0', 'Task')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            // Update the command with the new config
            setupCommand(program, 'list', {
                _config: configWithTreeFormat,
                _taskService: mockTaskService
            });

            await program.parseAsync(['node', 'test', 'list']);

            // Check that formatTaskList was called with tree format
            const formatTaskListMock = (await import('../../../../src/cli/formatters.js')).formatTaskList as Mock;
            expect(formatTaskListMock).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                'tree',
                expect.anything()
            );
        });

        it('should handle empty task list', async () => {
            (mockTaskService.list as Mock).mockReturnValue([]);

            await program.parseAsync(['list'], { from: 'user' });

            expect(consoleLogSpy).toHaveBeenCalledWith('List of 0 tasks');
        });

        it('should handle cancelled status filter', async () => {
            const tasks = [createMockTask('1.0', 'Cancelled Task', 'cancelled')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(
                ['node', 'test', 'list', '--status', 'cancelled'],
                { 
                    _config: mockConfig, 
                    _taskService: mockTaskService
                }
            );

            expect(mockTaskService.list).toHaveBeenCalledWith({ status: 'cancelled' });
        });
    });
});