import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerImportExportCommands } from '../../../../src/cli/commands/import-export.js';
import { TaskService } from '../../../../src/core/task.js';
import { TaskValidator } from '../../../../src/core/validation.js';
import { TodoqConfig, Task } from '../../../../src/core/types.js';
import * as fs from 'fs';
import { setupCommand, addGlobalOptions } from './test-helpers.js';

// Mock modules
vi.mock('fs');
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        bold: (text: string) => text
    }
}));

vi.mock('ora', () => ({
    default: () => ({
        start: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis()
    })
}));

// Create a mock validator instance that will be returned by the constructor
const mockValidatorInstance = {
    validateImport: vi.fn()
};

vi.mock('../../../../src/core/validation.js', () => ({
    TaskValidator: vi.fn(() => mockValidatorInstance),
    BulkTaskInputSchema: {
        safeParse: vi.fn()
    }
}));

describe('Import/Export Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    let processExitSpy: Mock;
    let mockTaskService: Partial<TaskService>;
    let mockConfig: TodoqConfig;
    const mockFs = fs as any;

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
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('Process exit');
        });

        mockConfig = {
            database: { path: '/test/path.db' },
            display: { 
                showFileLinks: true, 
                showDependencies: false, 
                relativePaths: true, 
                compactMode: false,
                showCompleted: false
            },
            defaults: { priority: 1, status: 'pending' }
        };

        mockTaskService = {
            bulkInsert: vi.fn(),
            list: vi.fn()
        };

        // Reset the mock validator for each test
        mockValidatorInstance.validateImport.mockReset();
        mockValidatorInstance.validateImport.mockReturnValue({ 
            valid: true, 
            errors: [],
            summary: { total: 0, valid: 0, invalid: 0 }
        });

        vi.clearAllMocks();
        
        // Setup default mock behaviors
        mockFs.readFileSync.mockReturnValue('{}');
        mockFs.writeFileSync.mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('import command', () => {
        beforeEach(() => {
            registerImportExportCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'import', {
                _taskService: mockTaskService
            });
        });

        it('should import tasks from JSON file', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Task 1' },
                    { number: '2.0', name: 'Task 2' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            // The mock is already set up in beforeEach with default valid response
            
            (mockTaskService.bulkInsert as Mock).mockReturnValue({
                success: true,
                summary: { successful: 2, skipped: 0, failed: 0, total: 2 },
                errors: [],
                skipped: []
            });

            await program.parseAsync(['import', 'tasks.json'], { from: 'user' });

            expect(mockFs.readFileSync).toHaveBeenCalledWith('tasks.json', 'utf-8');
            expect(mockValidatorInstance.validateImport).toHaveBeenCalledWith(taskData.tasks);
            expect(mockTaskService.bulkInsert).toHaveBeenCalledWith(taskData.tasks);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Import completed successfully!'));
        });

        it('should skip errors when --skip-errors flag is used', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Valid Task' },
                    { number: 'invalid', name: 'Invalid Task' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            mockValidatorInstance.validateImport.mockReturnValue({ 
                valid: false, 
                errors: [{ task: 'invalid', field: 'number', error: 'Invalid format' }]
            });
            
            (mockTaskService.bulkInsert as Mock).mockReturnValue({
                success: false,
                summary: { successful: 1, skipped: 0, failed: 1, total: 2 },
                errors: [{ task: { number: 'invalid' }, error: 'Invalid format' }],
                skipped: []
            });

            await program.parseAsync(['import', 'tasks.json', '--skip-errors'], { from: 'user' });

            expect(mockTaskService.bulkInsert).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠ Import completed with some errors'));
        });

        it('should validate only when --validate-only flag is used', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Task 1' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            // Mock is already set with valid: true in beforeEach

            await program.parseAsync(['import', 'tasks.json', '--validate-only'], { from: 'user' });

            expect(mockValidatorInstance.validateImport).toHaveBeenCalledWith(taskData.tasks);
            expect(mockTaskService.bulkInsert).not.toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ All tasks are valid!'));
        });

        it.skip('should read from stdin when file is -', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Task 1' }
                ]
            };

            // Mock the readStdin function
            const importExportModule = await import('../../../../src/cli/commands/import-export.js');
            vi.spyOn(importExportModule, 'readStdin').mockResolvedValue(JSON.stringify(taskData));

            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            (mockTaskService.bulkInsert as Mock).mockReturnValue({
                success: true,
                summary: { successful: 1, skipped: 0, failed: 0, total: 1 },
                errors: [],
                skipped: []
            });

            await program.parseAsync(['import', '-'], { from: 'user' });

            expect(mockValidatorInstance.validateImport).toHaveBeenCalledWith(taskData.tasks);
            expect(mockTaskService.bulkInsert).toHaveBeenCalledWith(taskData.tasks);
        });

        it('should handle import with errors and skipped tasks', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Task 1' },
                    { number: '2.0', name: 'Task 2' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            (mockTaskService.bulkInsert as Mock).mockReturnValue({
                success: false,
                summary: { successful: 0, skipped: 1, failed: 1, total: 2 },
                errors: [{ task: { number: '1.0' }, error: 'Database error' }],
                skipped: [{ task: { number: '2.0' }, reason: 'Already exists' }]
            });

            await program.parseAsync(['import', 'tasks.json', '--skip-errors'], { from: 'user' });

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Database error'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Already exists'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠ Import completed with some errors'));
        });

        it('should handle task validation errors', async () => {
            const taskData = {
                tasks: [{ number: 'invalid', name: 'Task' }]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            mockValidatorInstance.validateImport.mockReturnValue({ 
                valid: false, 
                errors: [{ task: 'invalid', field: 'number', error: 'Invalid task number format' }]
            });

            await expect(
                program.parseAsync(
                    ['import', 'tasks.json'],
                    { from: 'user' }
                )
            ).rejects.toThrow('Process exit');

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid task number format'));
        });

        it('should work with add-json alias', async () => {
            const taskData = {
                tasks: [{ number: '1.0', name: 'Task 1' }]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            (mockTaskService.bulkInsert as Mock).mockReturnValue({
                success: true,
                summary: { successful: 1, skipped: 0, failed: 0, total: 1 },
                errors: [],
                skipped: []
            });

            await program.parseAsync(['add-json', 'tasks.json'], { from: 'user' });

            expect(mockTaskService.bulkInsert).toHaveBeenCalledWith(taskData.tasks);
        });
    });

    describe('export command', () => {
        beforeEach(() => {
            registerImportExportCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'export', {
                _taskService: mockTaskService,
                _config: mockConfig
            });
        });

        it('should export tasks to JSON', async () => {
            const tasks = [
                createMockTask('1.0', 'Task 1'),
                createMockTask('2.0', 'Task 2')
            ];

            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['export'], { from: 'user' });

            expect(mockTaskService.list).toHaveBeenCalledWith({});
            
            // Check that the output is the transformed export format
            const expectedExport = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task 1',
                        description: 'Description for Task 1',
                        parent: null,
                        status: 'pending',
                        priority: 1
                    },
                    {
                        number: '2.0',
                        name: 'Task 2',
                        description: 'Description for Task 2',
                        parent: null,
                        status: 'pending',
                        priority: 1
                    }
                ]
            };
            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(expectedExport));
        });

        it('should write to file when filename is provided', async () => {
            const tasks = [createMockTask('1.0', 'Task 1')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['export', 'output.json'], { from: 'user' });

            const expectedExport = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task 1',
                        description: 'Description for Task 1',
                        parent: null,
                        status: 'pending',
                        priority: 1
                    }
                ]
            };
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                'output.json',
                JSON.stringify(expectedExport)
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Exported 1 tasks to output.json'));
        });

        it('should format output when --pretty flag is used', async () => {
            const tasks = [createMockTask('1.0', 'Task 1')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['export', '--pretty'], { from: 'user' });

            const expectedExport = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task 1',
                        description: 'Description for Task 1',
                        parent: null,
                        status: 'pending',
                        priority: 1
                    }
                ]
            };
            expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(expectedExport, null, 2));
        });

        it('should include completed tasks when flag is set', async () => {
            const tasks = [createMockTask('1.0', 'Task 1')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['export', '--include-completed'], { from: 'user' });

            expect(mockTaskService.list).toHaveBeenCalledWith({ includeCompleted: true });
        });

        it('should filter by parent when specified', async () => {
            const tasks = [createMockTask('1.1', 'Subtask')];
            (mockTaskService.list as Mock).mockReturnValue(tasks);

            await program.parseAsync(['export', '--parent', '1.0'], { from: 'user' });

            expect(mockTaskService.list).toHaveBeenCalledWith({ parentNumber: '1.0' });
        });
    });

    describe('bulk-validate command', () => {
        beforeEach(() => {
            registerImportExportCommands(program);
            addGlobalOptions(program);
            setupCommand(program, 'bulk-validate', {});
        });

        it('should validate JSON file without importing', async () => {
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Task 1' },
                    { number: '2.0', name: 'Task 2' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            // Update the mock to return proper summary for this test
            mockValidatorInstance.validateImport.mockReturnValue({ 
                valid: true, 
                errors: [],
                summary: { total: 2, valid: 2, invalid: 0 }
            });

            await expect(
                program.parseAsync(
                    ['bulk-validate', 'tasks.json'],
                    { from: 'user' }
                )
            ).rejects.toThrow('Process exit');

            expect(mockValidatorInstance.validateImport).toHaveBeenCalledWith(taskData.tasks);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ All 2 tasks are valid!'));
        });

        it('should show validation errors', async () => {
            const taskData = {
                tasks: [
                    { number: 'invalid', name: 'Task' }
                ]
            };

            mockFs.readFileSync.mockReturnValue(JSON.stringify(taskData));
            
            const { BulkTaskInputSchema } = await import('../../../../src/core/validation.js');
            (BulkTaskInputSchema.safeParse as Mock).mockReturnValue({ success: true });
            
            mockValidatorInstance.validateImport.mockReturnValue({ 
                valid: false, 
                errors: [{ task: 'invalid', field: 'number', error: 'Invalid format' }]
            });

            await expect(
                program.parseAsync(
                    ['bulk-validate', 'tasks.json'],
                    { from: 'user' }
                )
            ).rejects.toThrow('Process exit');

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });
});