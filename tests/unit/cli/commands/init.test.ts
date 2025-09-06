import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Command } from 'commander';
import { registerInitCommands } from '../../../../src/cli/commands/init.js';
import * as fs from 'fs';
import path from 'path';

// Mock modules
vi.mock('fs');
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        bold: {
            blue: (text: string) => text
        }
    }
}));

vi.mock('inquirer', () => ({
    default: {
        prompt: vi.fn()
    }
}));

vi.mock('../../../../src/adapters/config/index.js', () => ({
    getDefaultConfig: vi.fn(() => ({
        database: {
            path: '~/.todoq/tasks.db',
            autoMigrate: true,
            walMode: true
        },
        display: {
            format: 'list',
            colors: true,
            showCompleted: false
        },
        defaults: {
            priority: 1,
            status: 'pending'
        }
    }))
}));

describe('Init Commands', () => {
    let program: Command;
    let consoleLogSpy: Mock;
    let consoleErrorSpy: Mock;
    const mockFs = fs as any;
    let inquirerMock: any;

    beforeEach(async () => {
        program = new Command();
        program.exitOverride();
        
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        inquirerMock = await import('inquirer');

        vi.clearAllMocks();
        
        // Setup default fs mock behaviors
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => {});
        mockFs.writeFileSync.mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('init command', () => {
        beforeEach(() => {
            registerInitCommands(program);
        });

        it('should initialize with default settings', async () => {
            await program.parseAsync(['node', 'test', 'init']);

            // Check database directory creation
            expect(mockFs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('.todoq'),
                expect.objectContaining({ recursive: true })
            );

            // Check config file creation
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('.todoqrc'),
                expect.stringContaining('"database"')
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Initializing TodoQ...'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Database initialized successfully!'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('TodoQ is ready to use!'));
        });

        it('should skip directory creation if it exists', async () => {
            mockFs.existsSync.mockImplementation((path: string) => {
                return path.includes('.todoq'); // Directory exists
            });

            await program.parseAsync(['node', 'test', 'init']);

            expect(mockFs.mkdirSync).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Created directory:'));
        });

        it('should skip config creation if it exists', async () => {
            mockFs.existsSync.mockImplementation((path: string) => {
                return path.includes('.todoqrc'); // Config file exists
            });

            await program.parseAsync(['node', 'test', 'init']);

            expect(mockFs.writeFileSync).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Created config file:'));
        });

        it('should show import hint when --from-json is provided', async () => {
            await program.parseAsync(['node', 'test', 'init', '--from-json', 'tasks.json']);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('To import tasks, run: todoq import tasks.json'));
        });

        it.skip('should use interactive setup when --interactive flag is used', async () => {
            inquirerMock.default.prompt.mockResolvedValue({
                databasePath: '/custom/path.db',
                displayFormat: 'tree',
                showColors: false,
                showCompleted: true,
                defaultStatus: 'in_progress',
                defaultPriority: 2
            });

            await program.parseAsync(['node', 'test', 'init', '--interactive']);

            expect(inquirerMock.default.prompt).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'databasePath',
                        message: 'Database path:'
                    }),
                    expect.objectContaining({
                        name: 'displayFormat',
                        choices: ['tree', 'list', 'table']
                    })
                ])
            );

            // Check that custom config was written
            const writtenConfig = mockFs.writeFileSync.mock.calls[0][1];
            expect(writtenConfig).toContain('/custom/path.db');
            expect(writtenConfig).toContain('"format":"tree"');
        });

        it('should validate database path in interactive mode', async () => {
            const promptCall = vi.fn().mockResolvedValue({
                databasePath: '/test/path.db',
                displayFormat: 'list',
                showColors: true,
                showCompleted: false,
                defaultStatus: 'pending',
                defaultPriority: 1
            });
            inquirerMock.default.prompt = promptCall;

            await program.parseAsync(['node', 'test', 'init', '--interactive']);

            const databasePathQuestion = promptCall.mock.calls[0][0].find(
                (q: any) => q.name === 'databasePath'
            );
            
            expect(databasePathQuestion.validate('')).toBe('Database path is required');
            expect(databasePathQuestion.validate('/valid/path')).toBe(true);
        });

        it('should validate priority in interactive mode', async () => {
            const promptCall = vi.fn().mockResolvedValue({
                databasePath: '/test/path.db',
                displayFormat: 'list',
                showColors: true,
                showCompleted: false,
                defaultStatus: 'pending',
                defaultPriority: 1
            });
            inquirerMock.default.prompt = promptCall;

            await program.parseAsync(['node', 'test', 'init', '--interactive']);

            const priorityQuestion = promptCall.mock.calls[0][0].find(
                (q: any) => q.name === 'defaultPriority'
            );
            
            expect(priorityQuestion.validate(-1)).toBe('Priority must be between 0 and 10');
            expect(priorityQuestion.validate(11)).toBe('Priority must be between 0 and 10');
            expect(priorityQuestion.validate(5)).toBe(true);
        });
    });

    describe('template command', () => {
        beforeEach(() => {
            registerInitCommands(program);
        });

        it('should generate default template to stdout', async () => {
            await program.parseAsync(['node', 'test', 'template']);

            const output = consoleLogSpy.mock.calls[0][0];
            const template = JSON.parse(output);
            
            expect(template.tasks).toBeDefined();
            expect(template.tasks.length).toBeGreaterThan(0);
            expect(template.tasks[0]).toMatchObject({
                number: '1.0',
                name: expect.any(String),
                status: 'pending'
            });
        });

        it('should write template to file when --output is provided', async () => {
            await program.parseAsync(['node', 'test', 'template', '--output', 'template.json']);

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                'template.json',
                expect.stringContaining('"tasks"')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Template written to template.json'));
        });

        it.skip('should create interactive template when --interactive flag is used', async () => {
            // Mock project setup prompts
            inquirerMock.default.prompt
                .mockResolvedValueOnce({
                    projectName: 'My Test Project',
                    taskCount: 2
                })
                // Mock first task prompts
                .mockResolvedValueOnce({
                    name: 'First Task',
                    description: 'First task description',
                    priority: 1
                })
                // Mock second task prompts
                .mockResolvedValueOnce({
                    name: 'Second Task',
                    description: 'Second task description',
                    priority: 2
                });

            await program.parseAsync(['node', 'test', 'template', '--interactive']);

            expect(inquirerMock.default.prompt).toHaveBeenCalledTimes(3); // Project + 2 tasks
            
            const output = consoleLogSpy.mock.calls[0][0];
            const template = JSON.parse(output);
            
            expect(template.tasks).toHaveLength(2);
            expect(template.tasks[0]).toMatchObject({
                number: '1.0',
                name: 'First Task',
                description: 'First task description',
                priority: 1
            });
            expect(template.tasks[1]).toMatchObject({
                number: '2.0',
                name: 'Second Task',
                description: 'Second task description',
                priority: 2
            });
        });

        it('should validate task count in interactive mode', async () => {
            const promptCall = vi.fn()
                .mockResolvedValueOnce({
                    projectName: 'Test',
                    taskCount: 1
                })
                .mockResolvedValueOnce({
                    name: 'Task',
                    description: '',
                    priority: 0
                });
            inquirerMock.default.prompt = promptCall;

            await program.parseAsync(['node', 'test', 'template', '--interactive']);

            const taskCountQuestion = promptCall.mock.calls[0][0].find(
                (q: any) => q.name === 'taskCount'
            );
            
            expect(taskCountQuestion.validate(0)).toBe('Must create at least 1 task');
            expect(taskCountQuestion.validate(1)).toBe(true);
        });

        it('should generate template with parent-child relationships', async () => {
            await program.parseAsync(['node', 'test', 'template']);

            const output = consoleLogSpy.mock.calls[0][0];
            const template = JSON.parse(output);
            
            // Check for parent-child relationships in default template
            const childTask = template.tasks.find((t: any) => t.parent);
            expect(childTask).toBeDefined();
            expect(childTask.parent).toBe('1.0');
            expect(childTask.number).toMatch(/^1\.\d+$/);
        });

        it('should generate template with dependencies', async () => {
            await program.parseAsync(['node', 'test', 'template']);

            const output = consoleLogSpy.mock.calls[0][0];
            const template = JSON.parse(output);
            
            // Check for dependencies in default template
            const taskWithDeps = template.tasks.find((t: any) => t.dependencies && t.dependencies.length > 0);
            expect(taskWithDeps).toBeDefined();
        });

        it.skip('should handle empty description in interactive mode', async () => {
            inquirerMock.default.prompt
                .mockResolvedValueOnce({
                    projectName: 'Test',
                    taskCount: 1
                })
                .mockResolvedValueOnce({
                    name: 'Task',
                    description: '', // Empty description
                    priority: 0
                });

            await program.parseAsync(['node', 'test', 'template', '--interactive']);

            const output = consoleLogSpy.mock.calls[0][0];
            const template = JSON.parse(output);
            
            // Empty description should be undefined in output
            expect(template.tasks[0].description).toBeUndefined();
        });

        it('should combine interactive template with output file', async () => {
            inquirerMock.default.prompt
                .mockResolvedValueOnce({
                    projectName: 'Test',
                    taskCount: 1
                })
                .mockResolvedValueOnce({
                    name: 'Task',
                    description: 'Description',
                    priority: 1
                });

            await program.parseAsync(['node', 'test', 'template', '--interactive', '--output', 'custom.json']);

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                'custom.json',
                expect.stringContaining('"Task"')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Template written to custom.json'));
        });
    });
});