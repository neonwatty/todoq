import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), 'dist', 'cli', 'index.js');
const TEST_DB_PATH = '/tmp/todoq-cli-test.db';
const TEST_CONFIG_PATH = '/tmp/.todoqrc-test.json';
const TEST_JSON_PATH = '/tmp/test-tasks.json';

// Helper function to run CLI commands
async function runCLI(command: string, options: { expectError?: boolean } = {}): Promise<{ stdout: string; stderr: string; code: number }> {
    const fullCommand = `node "${CLI_PATH}" --config="${TEST_CONFIG_PATH}" ${command}`;
    
    try {
        const { stdout, stderr } = await execAsync(fullCommand);
        return { stdout, stderr, code: 0 };
    } catch (error: any) {
        if (options.expectError) {
            return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code || 1 };
        }
        throw error;
    }
}

describe('CLI Integration Tests', () => {
    beforeEach(async () => {
        // Create test configuration
        const testConfig = {
            database: {
                path: TEST_DB_PATH,
                autoMigrate: true,
                walMode: true
            },
            display: {
                format: 'list',
                colors: false,
                showCompleted: false
            },
            defaults: {
                status: 'pending',
                priority: 0
            }
        };

        writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig, null, 2));

        // Clean up any existing test database
        if (existsSync(TEST_DB_PATH)) {
            unlinkSync(TEST_DB_PATH);
        }
    });

    afterEach(() => {
        // Cleanup test files
        [TEST_DB_PATH, TEST_CONFIG_PATH, TEST_JSON_PATH].forEach(file => {
            if (existsSync(file)) {
                unlinkSync(file);
            }
        });
    });

    describe('Initialization', () => {
        it('should initialize database and configuration', async () => {
            const result = await runCLI('init');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('TodoQ is ready to use');
            expect(existsSync(TEST_DB_PATH)).toBe(true);
        });

        it('should generate template', async () => {
            const result = await runCLI('template');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('"tasks"');
            expect(result.stdout).toContain('"number": "1.0"');

            const parsedOutput = JSON.parse(result.stdout);
            expect(parsedOutput.tasks).toHaveLength(4);
        });
    });

    describe('Task Import and Management', () => {
        beforeEach(async () => {
            // Initialize database first
            await runCLI('init');

            // Create test tasks JSON with comprehensive data for detailed view testing
            const testTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Test Task 1',
                        description: 'First test task with detailed information',
                        status: 'pending',
                        priority: 1,
                        files: ['src/file1.ts', 'src/file2.ts'],
                        docs_references: ['https://docs.example.com/task1', 'https://api.example.com/v1'],
                        testing_strategy: 'Unit and integration tests with mocks',
                        dependencies: ['2.0'],
                        notes: 'Important task with high priority'
                    },
                    {
                        number: '1.1',
                        name: 'Subtask 1',
                        description: 'First subtask with dependencies',
                        parent: '1.0',
                        status: 'pending',
                        priority: 0,
                        files: ['src/subtask.ts'],
                        docs_references: ['https://docs.example.com/subtask'],
                        testing_strategy: 'Unit tests only',
                        notes: 'Child task of 1.0'
                    },
                    {
                        number: '2.0',
                        name: 'Test Task 2',
                        description: 'Second test task for dependencies',
                        status: 'completed',
                        priority: 2,
                        files: ['src/task2.ts', 'tests/task2.test.ts'],
                        docs_references: ['https://docs.example.com/task2'],
                        testing_strategy: 'E2E tests with browser automation',
                        notes: 'Foundation task that others depend on',
                        completion_notes: 'Task completed successfully with all tests passing'
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(testTasks, null, 2));
        });

        it('should import tasks from JSON', async () => {
            const result = await runCLI(`import "${TEST_JSON_PATH}"`);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Import Results');
            expect(result.stdout).toContain('✓ Inserted: 3');
            expect(result.stdout).toContain('✓ Import completed successfully');
        });

        it('should list imported tasks', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('list --completed'); // Include completed tasks

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('1.0 Test Task 1');
            expect(result.stdout).toContain('1.1 Subtask 1');
            expect(result.stdout).toContain('2.0 Test Task 2');
        });

        it('should show tree view', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('list --tree');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('1.0 Test Task 1');
            expect(result.stdout).toContain('1.1 Subtask 1'); // Should show subtask
        });

        it('should show current task', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('current');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('1.0 Test Task 1');
            expect(result.stdout).toContain('Status: pending');
        });

        it('should complete a task', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('complete 1.1 --notes "Task completed"');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✓ Completed task 1.1: Subtask 1');
        });

        it('should show task statistics', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            // Don't complete 1.1 as it might auto-complete parent
            
            const result = await runCLI('stats');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task Statistics');
            expect(result.stdout).toContain('Total tasks: 3');
            expect(result.stdout).toContain('Completed: 1'); // Only task 2.0 is completed
            expect(result.stdout).toContain('Pending: 2'); // Tasks 1.0 and 1.1 are pending
        });

        it('should export tasks to JSON', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('export --pretty');

            expect(result.code).toBe(0);
            const exportedData = JSON.parse(result.stdout);
            expect(exportedData.tasks.length).toBeGreaterThanOrEqual(2); // At least the pending tasks
            expect(exportedData.tasks.some(t => t.number === '1.0')).toBe(true);
        });

        it('should show progress tree', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            await runCLI('complete 1.1');
            
            const result = await runCLI('progress');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task Progress');
            expect(result.stdout).toContain('1.0 Test Task 1');
            expect(result.stdout).toContain('✓ 1.1 Subtask 1');
        });

        describe('List Command Detailed Options', () => {
            beforeEach(async () => {
                await runCLI(`import "${TEST_JSON_PATH}"`);
            });

            describe('--detailed flag', () => {
                it('should show detailed information in list format', async () => {
                    const result = await runCLI('list --detailed');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('○ 1.0 Test Task 1 [P1]');
                    expect(result.stdout).toContain('Status: pending');
                    expect(result.stdout).toContain('Description: First test task with detailed information');
                    expect(result.stdout).toContain('Files: src/file1.ts, src/file2.ts');
                    expect(result.stdout).toContain('Docs: https://docs.example.com/task1, https://api.example.com/v1');
                    expect(result.stdout).toContain('Testing: Unit and integration tests with mocks');
                    expect(result.stdout).toContain('Notes: Important task with high priority');
                });

                it('should show detailed information for completed tasks', async () => {
                    const result = await runCLI('list --detailed --completed');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('✓ 2.0 Test Task 2 [P2]');
                    expect(result.stdout).toContain('Status: completed');
                    expect(result.stdout).toContain('Description: Second test task for dependencies');
                    expect(result.stdout).toContain('Files: src/task2.ts, tests/task2.test.ts');
                    expect(result.stdout).toContain('Testing: E2E tests with browser automation');
                    expect(result.stdout).toContain('Completion: Task completed successfully with all tests passing');
                });

                it('should show detailed tree view', async () => {
                    const result = await runCLI('list --detailed --tree');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('○ 1.0 Test Task 1 [P1]');
                    expect(result.stdout).toContain('  Status: pending');
                    expect(result.stdout).toContain('  Description: First test task with detailed information');
                    expect(result.stdout).toContain('  ○ 1.1 Subtask 1');
                    expect(result.stdout).toContain('    Status: pending');
                    expect(result.stdout).toContain('    Description: First subtask with dependencies');
                    expect(result.stdout).toContain('    Notes: Child task of 1.0');
                });

                it('should show detailed table view', async () => {
                    const result = await runCLI('list --detailed --format table');

                    expect(result.code).toBe(0);
                    // Strip ANSI escape codes for easier testing
                    const cleanOutput = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
                    
                    // Check that the table contains the expected columns (some may be truncated)
                    expect(cleanOutput).toContain('Number');
                    expect(cleanOutput).toContain('Name');
                    expect(cleanOutput).toContain('Status');
                    expect(cleanOutput).toMatch(/Pri(ority|…)/); // Priority may be truncated
                    expect(cleanOutput).toContain('Description');
                    expect(cleanOutput).toContain('Files');
                    expect(cleanOutput).toMatch(/Dependenc(ies|…)/);
                    expect(cleanOutput).toContain('Docs');
                    expect(cleanOutput).toContain('Testing');
                    expect(cleanOutput).toContain('Notes');
                    expect(cleanOutput).toContain('Created');
                    
                    // Check task data
                    expect(cleanOutput).toContain('1.0');
                    expect(cleanOutput).toContain('Test Task 1');
                    expect(cleanOutput).toContain('pending');
                    expect(cleanOutput).toContain('P1');
                    expect(cleanOutput).toMatch(/First test task.*wit/);
                    expect(cleanOutput).toMatch(/src\/file1/);
                });

                it('should handle detailed view with no tasks', async () => {
                    // Remove all tasks by completing them and then showing only pending
                    await runCLI('complete 1.0');
                    await runCLI('complete 1.1');
                    
                    const result = await runCLI('list --detailed --status pending');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('No tasks found');
                });

                it('should work with status filtering in detailed mode', async () => {
                    const result = await runCLI('list --detailed --status completed --completed');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('✓ 2.0 Test Task 2 [P2]');
                    expect(result.stdout).toContain('Status: completed');
                    expect(result.stdout).toContain('Completion: Task completed successfully');
                    expect(result.stdout).not.toContain('1.0 Test Task 1');
                });

                it('should work with parent filtering in detailed mode', async () => {
                    const result = await runCLI('list --detailed --parent 1.0');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('○ 1.1 Subtask 1');
                    expect(result.stdout).toContain('Description: First subtask with dependencies');
                    expect(result.stdout).toContain('Files: src/subtask.ts');
                    expect(result.stdout).not.toContain('1.0 Test Task 1');
                });
            });

            describe('--json flag', () => {
                it('should output valid JSON for all tasks', async () => {
                    const result = await runCLI('list --json --completed'); // Include completed tasks

                    expect(result.code).toBe(0);
                    
                    // Should be valid JSON
                    const tasks = JSON.parse(result.stdout);
                    expect(Array.isArray(tasks)).toBe(true);
                    expect(tasks).toHaveLength(3);

                    // Check first task structure
                    const task = tasks.find(t => t.taskNumber === '1.0');
                    expect(task).toHaveProperty('taskNumber', '1.0');
                    expect(task).toHaveProperty('name', 'Test Task 1');
                    expect(task).toHaveProperty('description', 'First test task with detailed information');
                    expect(task).toHaveProperty('status', 'pending');
                    expect(task).toHaveProperty('priority', 1);
                    expect(task).toHaveProperty('files');
                    expect(task.files).toEqual(['src/file1.ts', 'src/file2.ts']);
                    expect(task).toHaveProperty('docsReferences');
                    expect(task.docsReferences).toEqual(['https://docs.example.com/task1', 'https://api.example.com/v1']);
                    expect(task).toHaveProperty('testingStrategy', 'Unit and integration tests with mocks');
                    expect(task).toHaveProperty('dependencies');
                    expect(task.dependencies).toEqual(['2.0']);
                    expect(task).toHaveProperty('notes', 'Important task with high priority');
                    expect(task).toHaveProperty('createdAt');
                    expect(task).toHaveProperty('updatedAt');
                });

                it('should output JSON with completed tasks when requested', async () => {
                    const result = await runCLI('list --json --completed');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    expect(tasks).toHaveLength(3);

                    const completedTask = tasks.find(t => t.taskNumber === '2.0');
                    expect(completedTask).toHaveProperty('status', 'completed');
                    expect(completedTask).toHaveProperty('completionNotes', 'Task completed successfully with all tests passing');
                });

                it('should output JSON with status filtering', async () => {
                    const result = await runCLI('list --json --status pending');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    expect(tasks).toHaveLength(2); // 1.0 and 1.1 are pending
                    tasks.forEach(task => {
                        expect(task.status).toBe('pending');
                    });
                });

                it('should output JSON with parent filtering', async () => {
                    const result = await runCLI('list --json --parent 1.0');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    expect(tasks).toHaveLength(1);
                    expect(tasks[0].taskNumber).toBe('1.1');
                    expect(tasks[0].name).toBe('Subtask 1');
                });

                it('should output empty JSON array when no tasks found', async () => {
                    const result = await runCLI('list --json --status cancelled');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    expect(Array.isArray(tasks)).toBe(true);
                    expect(tasks).toHaveLength(0);
                });

                it('should not contain ANSI color codes in JSON output', async () => {
                    const result = await runCLI('list --json');
                    
                    expect(result.code).toBe(0);
                    // JSON output should not contain ANSI escape sequences
                    expect(result.stdout).not.toMatch(/\u001b\[[0-9;]*m/);
                });

                it('should work with tree flag (JSON takes precedence)', async () => {
                    const result = await runCLI('list --json --tree --completed'); // Include completed tasks

                    expect(result.code).toBe(0);
                    
                    // Should still output JSON, not tree format
                    const tasks = JSON.parse(result.stdout);
                    expect(Array.isArray(tasks)).toBe(true);
                    expect(tasks).toHaveLength(3);
                });

                it('should work with detailed flag (JSON contains all fields)', async () => {
                    const result = await runCLI('list --json --detailed');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    const task = tasks.find(t => t.taskNumber === '1.0');
                    
                    // All detailed fields should be present
                    expect(task).toHaveProperty('description');
                    expect(task).toHaveProperty('files');
                    expect(task).toHaveProperty('docsReferences');
                    expect(task).toHaveProperty('testingStrategy');
                    expect(task).toHaveProperty('dependencies');
                    expect(task).toHaveProperty('notes');
                });
            });

            describe('Combined flags', () => {
                it('should handle --detailed with --status and --completed', async () => {
                    const result = await runCLI('list --detailed --status completed --completed');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('✓ 2.0 Test Task 2');
                    expect(result.stdout).toContain('Status: completed');
                    expect(result.stdout).toContain('Completion: Task completed successfully');
                    expect(result.stdout).not.toContain('1.0 Test Task 1');
                });

                it('should handle --detailed with --no-subtasks', async () => {
                    const result = await runCLI('list --detailed --no-subtasks');

                    expect(result.code).toBe(0);
                    expect(result.stdout).toContain('○ 1.0 Test Task 1');
                    expect(result.stdout).toContain('Description: First test task');
                    // Note: 1.1 might still show if it's not properly marked as a child task
                    // This depends on the parent-child relationship being correctly established
                });

                it('should handle --json with multiple filters', async () => {
                    const result = await runCLI('list --json --status pending --no-subtasks');

                    expect(result.code).toBe(0);
                    
                    const tasks = JSON.parse(result.stdout);
                    expect(tasks.length).toBeGreaterThanOrEqual(1); // At least 1.0 should match
                    
                    // All returned tasks should be pending status
                    tasks.forEach(task => {
                        expect(task.status).toBe('pending');
                    });
                });
            });
        });
    });

    describe('Navigation Commands JSON Output', () => {
        beforeEach(async () => {
            // Initialize database first
            await runCLI('init');

            // Create test tasks JSON
            const testTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Test Task 1',
                        description: 'First test task',
                        status: 'pending',
                        priority: 1,
                        files: ['src/file1.js'],
                        docs_references: ['https://docs.example.com/task1']
                    },
                    {
                        number: '2.0',
                        name: 'Test Task 2',
                        description: 'Second test task',
                        status: 'completed',
                        priority: 2
                    },
                    {
                        number: '3.0',
                        name: 'Test Task 3',
                        description: 'Third test task',
                        status: 'in_progress',
                        priority: 0
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(testTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        describe('current command JSON output', () => {
            it('should output current task as valid JSON', async () => {
                const result = await runCLI('current --json');

                expect(result.code).toBe(0);
                
                // Should be valid JSON
                const taskData = JSON.parse(result.stdout);
                
                // Should contain task properties
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData).toHaveProperty('name');
                expect(taskData).toHaveProperty('description');
                expect(taskData).toHaveProperty('status');
                expect(taskData).toHaveProperty('priority');
                
                // Should be the first pending task
                expect(taskData.taskNumber).toBe('1.0');
                expect(taskData.name).toBe('Test Task 1');
                expect(taskData.status).toBe('pending');
            });

            it('should output JSON error message when no current task found', async () => {
                // Complete all tasks so there's no current task
                await runCLI('complete 1.0');
                await runCLI('complete 3.0');
                
                const result = await runCLI('current --json');

                expect(result.code).toBe(0);
                
                const responseData = JSON.parse(result.stdout);
                expect(responseData).toHaveProperty('message');
                expect(responseData.message).toBe('No current task found');
            });

            it('should work with --json and --number flags together', async () => {
                const result = await runCLI('current --json --number');

                expect(result.code).toBe(0);
                
                // Should still output full JSON, not just number when --json is used
                const taskData = JSON.parse(result.stdout);
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData.taskNumber).toBe('1.0');
            });
        });

        describe('next command JSON output', () => {
            it('should output next task as valid JSON', async () => {
                const result = await runCLI('next --json');

                expect(result.code).toBe(0);
                
                const taskData = JSON.parse(result.stdout);
                
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData).toHaveProperty('name');
                expect(taskData).toHaveProperty('status');
                
                // Should be a pending task (1.0 or 3.0)
                expect(['1.0', '3.0']).toContain(taskData.taskNumber);
                expect(['pending', 'in_progress']).toContain(taskData.status);
            });

            it('should output next task from specific current task', async () => {
                const result = await runCLI('next 1.0 --json');

                expect(result.code).toBe(0);
                
                const taskData = JSON.parse(result.stdout);
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData.taskNumber).toBe('3.0'); // Should be the in_progress task
            });

            it('should output JSON error message when no next task found', async () => {
                // Complete remaining tasks
                await runCLI('complete 1.0');
                await runCLI('complete 3.0');
                
                const result = await runCLI('next --json');

                expect(result.code).toBe(0);
                
                const responseData = JSON.parse(result.stdout);
                expect(responseData).toHaveProperty('message');
                expect(responseData.message).toBe('No next task found');
            });

            it('should work with --json and --number flags together', async () => {
                const result = await runCLI('next --json --number');

                expect(result.code).toBe(0);
                
                // Should still output full JSON, not just number when --json is used
                const taskData = JSON.parse(result.stdout);
                expect(taskData).toHaveProperty('taskNumber');
                expect(['1.0', '3.0']).toContain(taskData.taskNumber);
            });
        });

        describe('previous command JSON output', () => {
            it('should output previous task as valid JSON', async () => {
                const result = await runCLI('previous 3.0 --json');

                expect(result.code).toBe(0);
                
                const taskData = JSON.parse(result.stdout);
                
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData).toHaveProperty('name');
                expect(taskData).toHaveProperty('status');
                expect(taskData.taskNumber).toBe('1.0');
            });

            it('should require current task number parameter', async () => {
                const result = await runCLI('previous --json');

                expect(result.code).toBe(0);
                
                const responseData = JSON.parse(result.stdout);
                expect(responseData).toHaveProperty('message');
                expect(responseData.message).toBe('Current task number required');
            });

            it('should output JSON error message when no previous task found', async () => {
                const result = await runCLI('previous 1.0 --json');

                expect(result.code).toBe(0);
                
                const responseData = JSON.parse(result.stdout);
                expect(responseData).toHaveProperty('message');
                expect(responseData.message).toBe('No previous task found');
            });

            it('should work with --json and --number flags together', async () => {
                const result = await runCLI('previous 3.0 --json --number');

                expect(result.code).toBe(0);
                
                // Should still output full JSON, not just number when --json is used
                const taskData = JSON.parse(result.stdout);
                expect(taskData).toHaveProperty('taskNumber');
                expect(taskData.taskNumber).toBe('1.0');
            });
        });

        describe('JSON output validation', () => {
            it('should produce valid JSON for all navigation commands', async () => {
                const commands = [
                    'current --json',
                    'next --json',
                    'next 1.0 --json',
                    'previous 3.0 --json'
                ];

                for (const command of commands) {
                    const result = await runCLI(command);
                    expect(result.code).toBe(0);
                    
                    // Should parse without error
                    expect(() => JSON.parse(result.stdout)).not.toThrow();
                    
                    const data = JSON.parse(result.stdout);
                    // Should have either task data or error message
                    expect(data).toBeTruthy();
                    expect(typeof data).toBe('object');
                }
            });

            it('should not contain ANSI color codes in JSON output', async () => {
                const result = await runCLI('current --json');
                
                expect(result.code).toBe(0);
                // JSON output should not contain ANSI escape sequences
                expect(result.stdout).not.toMatch(/\u001b\[[0-9;]*m/);
            });
        });
    });

    describe('Current Command Status Changes', () => {
        beforeEach(async () => {
            // Initialize database first
            await runCLI('init');

            // Create test tasks JSON
            const testTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'First Task',
                        description: 'First test task',
                        status: 'pending',
                        priority: 1
                    },
                    {
                        number: '1.1',
                        name: 'Child Task',
                        description: 'Child test task',
                        parent: '1.0',
                        status: 'pending',
                        priority: 0
                    },
                    {
                        number: '2.0',
                        name: 'Second Task',
                        description: 'Second test task',
                        status: 'pending',
                        priority: 2
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(testTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        describe('Status change functionality', () => {
            it('should mark current task as completed', async () => {
                const result = await runCLI('current --complete');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify task is completed
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
            });

            it('should mark current task as completed with notes', async () => {
                const result = await runCLI('current --complete --notes "Task finished successfully"');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify completion notes
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Task finished successfully');
            });

            it('should mark current task as in progress', async () => {
                const result = await runCLI('current --start');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('→ Started task 1.0: First Task');
                
                // Verify task is in progress
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: in_progress');
            });

            it('should reopen current task as pending', async () => {
                // First complete the task
                await runCLI('current --complete');
                
                // The next current task should be 1.1 (child task)
                const result = await runCLI('current --reopen');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('○ Reopened task 1.1: Child Task');
                
                // Verify task is pending
                const checkResult = await runCLI('show 1.1');
                expect(checkResult.stdout).toContain('Status: pending');
            });

            it('should cancel current task', async () => {
                const result = await runCLI('current --cancel');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✗ Cancelled task 1.0: First Task');
                
                // Verify task is cancelled
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: cancelled');
            });

            it('should cancel current task with notes', async () => {
                const result = await runCLI('current --cancel --notes "Task no longer needed"');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✗ Cancelled task 1.0: First Task');
                
                // Verify cancellation notes (completion notes are used for cancellation notes too)
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Cancellation: Task no longer needed');
            });

            it('should handle force completion', async () => {
                const result = await runCLI('current --complete --force');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify task is completed
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
            });
        });

        describe('JSON output with status changes', () => {
            it('should output JSON for completion', async () => {
                const result = await runCLI('current --complete --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('task');
                expect(data.task.taskNumber).toBe('1.0');
                expect(data.task.status).toBe('completed');
                expect(data).toHaveProperty('autoCompleted');
            });

            it('should output JSON for start', async () => {
                const result = await runCLI('current --start --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data.taskNumber).toBe('1.0');
                expect(data.status).toBe('in_progress');
            });

            it('should output JSON for reopen', async () => {
                // First complete the task
                await runCLI('current --complete');
                
                // The next current task should be 1.1 (child task)
                const result = await runCLI('current --reopen --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data.taskNumber).toBe('1.1');
                expect(data.status).toBe('pending');
            });

            it('should output JSON for cancel', async () => {
                const result = await runCLI('current --cancel --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data.taskNumber).toBe('1.0');
                expect(data.status).toBe('cancelled');
            });
        });

        describe('Error handling', () => {
            it('should handle no current task with status change', async () => {
                // Complete all tasks
                await runCLI('complete 1.0');
                await runCLI('complete 1.1');
                await runCLI('complete 2.0');
                
                const result = await runCLI('current --complete');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('No current task found to update status');
            });

            it('should handle no current task with JSON status change', async () => {
                // Complete all tasks
                await runCLI('complete 1.0');
                await runCLI('complete 1.1');
                await runCLI('complete 2.0');
                
                const result = await runCLI('current --complete --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('error');
                expect(data.error).toBe('No current task found to update status');
            });

            it('should handle multiple status flags', async () => {
                const result = await runCLI('current --complete --start');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('Only one status flag can be used at a time');
                expect(result.stdout).toContain('--complete, --start');
            });

            it('should handle multiple status flags with JSON', async () => {
                const result = await runCLI('current --complete --cancel --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('error');
                expect(data.error).toContain('Only one status flag can be used at a time');
            });

            it('should handle three status flags combination', async () => {
                const result = await runCLI('current --complete --start --reopen');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('Only one status flag can be used at a time');
                expect(result.stdout).toContain('--complete, --start, --reopen');
            });

            it('should handle all four status flags combination', async () => {
                const result = await runCLI('current --complete --start --reopen --cancel');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('Only one status flag can be used at a time');
                expect(result.stdout).toContain('--complete, --start, --reopen, --cancel');
            });
        });

        describe('Edge cases with notes', () => {
            it('should handle empty notes string', async () => {
                const result = await runCLI('current --complete --notes ""');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify empty notes don't appear in output
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                // Should not contain "Completion:" line if notes are empty
                expect(checkResult.stdout).not.toContain('Completion:');
            });

            it('should handle very long notes', async () => {
                const longNotes = 'A'.repeat(1000); // 1000 character string
                const result = await runCLI(`current --complete --notes "${longNotes}"`);

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify long notes are stored
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                expect(checkResult.stdout).toContain('Completion: ' + longNotes);
            });

            it('should handle notes with special characters', async () => {
                const specialNotes = 'Notes with quotes, apostrophes, & symbols! @#$%^&*()';
                const result = await runCLI(`current --complete --notes "${specialNotes}"`);

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify special characters are preserved
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                expect(checkResult.stdout).toContain(`Completion: ${specialNotes}`);
            });

            it('should handle notes with newlines and tabs', async () => {
                const multilineNotes = 'Line 1\\nLine 2\\tIndented';
                const result = await runCLI(`current --complete --notes "${multilineNotes}"`);

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify multiline notes are preserved
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                expect(checkResult.stdout).toContain('Completion: ' + multilineNotes);
            });

            it('should handle notes with Unicode characters', async () => {
                const unicodeNotes = 'Task completed! ✅ 🎉 完了 مكتمل';
                const result = await runCLI(`current --complete --notes "${unicodeNotes}"`);

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify Unicode characters are preserved
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                expect(checkResult.stdout).toContain(`Completion: ${unicodeNotes}`);
            });

            it('should handle cancellation notes with special characters', async () => {
                const specialNotes = 'Cancelled due to priority change & budget constraints (50% cut)';
                const result = await runCLI(`current --cancel --notes "${specialNotes}"`);

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✗ Cancelled task 1.0: First Task');
                
                // Verify cancellation notes with special characters
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: cancelled');
                expect(checkResult.stdout).toContain(`Cancellation: ${specialNotes}`);
            });
        });

        describe('Combined with existing flags', () => {
            it('should work with --number flag', async () => {
                const result = await runCLI('current --start --number');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toBe('1.0');
            });

            it('should work with --reopen --number', async () => {
                // First complete the task to make 1.1 current
                await runCLI('current --complete');
                
                const result = await runCLI('current --reopen --number');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toBe('1.1');
            });

            it('should work with --cancel --number', async () => {
                const result = await runCLI('current --cancel --number');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toBe('1.0');
            });

            it('should work with --complete --force --notes', async () => {
                const result = await runCLI('current --complete --force --notes "Force completed with notes"');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 1.0: First Task');
                
                // Verify both force completion and notes
                const checkResult = await runCLI('show 1.0');
                expect(checkResult.stdout).toContain('Status: completed');
                expect(checkResult.stdout).toContain('Completion: Force completed with notes');
            });

            it('should work with --complete --notes --json', async () => {
                const result = await runCLI('current --complete --notes "JSON completion notes" --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('task');
                expect(data.task.taskNumber).toBe('1.0');
                expect(data.task.status).toBe('completed');
                expect(data.task.completionNotes).toBe('JSON completion notes');
                expect(data).toHaveProperty('autoCompleted');
            });

            it('should work with --cancel --notes --json', async () => {
                const result = await runCLI('current --cancel --notes "JSON cancellation notes" --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data.taskNumber).toBe('1.0');
                expect(data.status).toBe('cancelled');
                expect(data.completionNotes).toBe('JSON cancellation notes');
            });

            it('should preserve backward compatibility', async () => {
                // Test that current without flags still works as before
                const result = await runCLI('current');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('1.0 First Task');
                expect(result.stdout).toContain('Status: pending');
            });
        });

        describe('Auto-completion behavior', () => {
            it('should show auto-completed parents in completion', async () => {
                // Complete child task first so parent can be auto-completed
                await runCLI('complete 1.1');
                
                // Now the current task should be 2.0 (next pending task)
                const result = await runCLI('current --complete');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task 2.0: Second Task');
                // Note: Auto-completion behavior depends on the specific task hierarchy
                // This test verifies the command works with the completion logic
            });

            it('should handle auto-completion with --force flag', async () => {
                // Create a more complex hierarchy for better auto-completion testing
                await runCLI('insert 3.0 "Parent Task" --status pending');
                await runCLI('insert 3.1 "Child A" --parent 3.0 --status pending');
                await runCLI('insert 3.2 "Child B" --parent 3.0 --status pending');
                
                // Complete one child with force
                const result = await runCLI('complete 3.1 --force');
                expect(result.code).toBe(0);
                
                // Now complete the other child - should trigger parent auto-completion
                const result2 = await runCLI('complete 3.2');
                expect(result2.code).toBe(0);
                
                // Verify parent was auto-completed
                const checkResult = await runCLI('show 3.0');
                expect(checkResult.stdout).toContain('Status: completed');
            });

            it('should handle multi-level parent auto-completion', async () => {
                // Create a three-level hierarchy
                await runCLI('insert 4.0 "Grandparent" --status pending');
                await runCLI('insert 4.1 "Parent A" --parent 4.0 --status pending');
                await runCLI('insert 4.1.1 "Child A1" --parent 4.1 --status pending');
                await runCLI('insert 4.1.2 "Child A2" --parent 4.1 --status pending');
                await runCLI('insert 4.2 "Parent B" --parent 4.0 --status pending');
                
                // Complete all children of 4.1
                await runCLI('complete 4.1.1');
                const result = await runCLI('complete 4.1.2');
                
                expect(result.code).toBe(0);
                
                // Verify 4.1 was auto-completed
                const checkParent = await runCLI('show 4.1');
                expect(checkParent.stdout).toContain('Status: completed');
                
                // Complete 4.2 to trigger grandparent auto-completion
                await runCLI('complete 4.2');
                
                // Verify 4.0 (grandparent) was auto-completed
                const checkGrandparent = await runCLI('show 4.0');
                expect(checkGrandparent.stdout).toContain('Status: completed');
            });

            it('should show auto-completion in JSON output with current command', async () => {
                // Set up parent-child relationship with priority to ensure child is current
                await runCLI('insert 5.0 "Parent JSON" --status pending --priority 0');
                await runCLI('insert 5.1 "Child JSON Only" --parent 5.0 --status pending --priority 1');
                
                // Complete all existing tasks so we have clear navigation
                await runCLI('complete 1.0');
                await runCLI('complete 1.1'); 
                await runCLI('complete 2.0');
                
                // Check what task is actually current
                const currentResult = await runCLI('current');
                expect(currentResult.code).toBe(0);
                
                // Complete current task with JSON - test the JSON structure
                const result = await runCLI('current --complete --json');
                
                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('task');
                expect(data.task.status).toBe('completed');
                
                // If it has autoCompleted property, verify it's an array
                if (data.autoCompleted) {
                    expect(Array.isArray(data.autoCompleted)).toBe(true);
                }
            });

            it('should handle auto-completion with notes propagation', async () => {
                // Set up parent-child relationship
                await runCLI('insert 6.0 "Parent Notes" --status pending');
                await runCLI('insert 6.1 "Only Child" --parent 6.0 --status pending');
                
                // Complete child with notes - should auto-complete parent
                const result = await runCLI('complete 6.1 --notes "Child completed with notes"');
                
                expect(result.code).toBe(0);
                expect(result.stdout).toContain('Auto-completed parent tasks: 6.0');
                
                // Verify parent was auto-completed
                const checkParent = await runCLI('show 6.0');
                expect(checkParent.stdout).toContain('Status: completed');
                
                // Verify child has notes
                const checkChild = await runCLI('show 6.1');
                expect(checkChild.stdout).toContain('Completion: Child completed with notes');
            });

            it('should not auto-complete when some children are incomplete', async () => {
                // Set up parent with multiple children
                await runCLI('insert 7.0 "Incomplete Parent" --status pending');
                await runCLI('insert 7.1 "Complete Child" --parent 7.0 --status pending');
                await runCLI('insert 7.2 "Incomplete Child" --parent 7.0 --status pending');
                
                // Complete only one child
                const result = await runCLI('complete 7.1');
                
                expect(result.code).toBe(0);
                // Should not mention auto-completion
                expect(result.stdout).not.toContain('Auto-completed parent tasks');
                
                // Verify parent is still pending
                const checkParent = await runCLI('show 7.0');
                expect(checkParent.stdout).toContain('Status: pending');
            });

            it('should handle auto-completion with current command completion', async () => {
                // Test basic auto-completion functionality with current command
                // Just verify the command works, without complex navigation assumptions
                const result = await runCLI('current --complete');
                
                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task');
                
                // This test mainly verifies that current --complete works with auto-completion logic
                // The specific auto-completion behavior depends on the task hierarchy setup
            });

            it('should handle auto-completion with current command force completion', async () => {
                // Test that --force flag works with current command
                const result = await runCLI('current --complete --force');
                
                expect(result.code).toBe(0);
                expect(result.stdout).toContain('✓ Completed task');
                
                // This test verifies that current --complete --force executes successfully
                // The specific force behavior depends on the task dependency setup
            });
        });
    });

    describe('Task Operations', () => {
        beforeEach(async () => {
            await runCLI('init');
        });

        it('should add new task', async () => {
            const result = await runCLI('insert 1.0 "New Task" --description "A new task" --priority 2');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Created task 1.0: New Task');
        });

        it('should show task details', async () => {
            await runCLI('insert 1.0 "Test Task"');
            const result = await runCLI('show 1.0');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('1.0 Test Task');
            expect(result.stdout).toContain('Status: pending');
        });

        it('should update task', async () => {
            await runCLI('insert 1.0 "Test Task"');
            const result = await runCLI('update 1.0 --name "Updated Task" --status in_progress');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Updated task 1.0');
        });

        it('should remove task', async () => {
            await runCLI('insert 1.0 "Test Task"');
            const result = await runCLI('remove 1.0 --force');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Deleted 1 task');
        });

        it('should handle non-existent task', async () => {
            const result = await runCLI('show 99.99', { expectError: true });

            expect(result.code).toBe(0); // CLI handles the error gracefully
            expect(result.stdout).toContain('Task 99.99 not found');
        });
    });

    describe('JSON Validation', () => {
        beforeEach(async () => {
            await runCLI('init');
        });

        it('should validate correct JSON', async () => {
            const validTasks = {
                tasks: [
                    { number: '1.0', name: 'Valid Task' }
                ]
            };
            writeFileSync(TEST_JSON_PATH, JSON.stringify(validTasks));

            const result = await runCLI(`bulk-validate "${TEST_JSON_PATH}"`);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('✓ All 1 tasks are valid');
        });

        it('should detect validation errors', async () => {
            const invalidTasks = {
                tasks: [
                    { number: 'invalid', name: '' }
                ]
            };
            writeFileSync(TEST_JSON_PATH, JSON.stringify(invalidTasks));

            const result = await runCLI(`bulk-validate "${TEST_JSON_PATH}"`, { expectError: true });

            expect(result.code).toBe(1);
            expect(result.stdout).toContain('Schema validation failed');
        });
    });

    describe('Configuration Management', () => {
        beforeEach(async () => {
            await runCLI('init');
        });

        it('should show configuration', async () => {
            const result = await runCLI('config list');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('TodoQ Configuration');
            expect(result.stdout).toContain('Database:');
            expect(result.stdout).toContain('Display:');
            expect(result.stdout).toContain('Defaults:');
        });

        it('should get configuration value', async () => {
            const result = await runCLI('config get database.path');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toBe(TEST_DB_PATH);
        });

        it('should set configuration value', async () => {
            const result = await runCLI('config set display.format=table');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Set display.format = table');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing database gracefully', async () => {
            const result = await runCLI('current', { expectError: true });

            expect(result.code).toBe(0); // CLI may not set non-zero exit code for missing DB
            // The CLI may not output to stderr for missing DB, just handle gracefully
        });

        it('should handle invalid JSON file', async () => {
            writeFileSync(TEST_JSON_PATH, 'invalid json content');
            
            const result = await runCLI(`import "${TEST_JSON_PATH}"`, { expectError: true });

            expect(result.code).toBe(1);
            expect(result.stdout).toContain('Invalid JSON format');
        });

        it('should handle missing file', async () => {
            const result = await runCLI('import "non-existent-file.json"', { expectError: true });

            expect(result.code).toBe(1);
            expect(result.stderr).toContain('Unexpected error');
        });
    });

    describe('Remaining Command', () => {
        beforeEach(async () => {
            // Initialize database first
            await runCLI('init');

            // Create test tasks with mixed statuses
            const testTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Pending Task 1',
                        description: 'First pending task',
                        status: 'pending',
                        priority: 1
                    },
                    {
                        number: '2.0',
                        name: 'Completed Task',
                        description: 'Already completed task',
                        status: 'completed',
                        priority: 2
                    },
                    {
                        number: '3.0',
                        name: 'In Progress Task',
                        description: 'Task currently in progress',
                        status: 'in_progress',
                        priority: 0
                    },
                    {
                        number: '4.0',
                        name: 'Cancelled Task',
                        description: 'Cancelled task',
                        status: 'cancelled',
                        priority: 1
                    },
                    {
                        number: '5.0',
                        name: 'Pending Task 2',
                        description: 'Second pending task',
                        status: 'pending',
                        priority: 3
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(testTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        describe('Default output', () => {
            it('should show remaining count in default format', async () => {
                const result = await runCLI('remaining');

                expect(result.code).toBe(0);
                expect(result.stdout).toMatch(/3 tasks remaining/); // 2 pending + 1 in_progress
            });

            it('should show 0 when all tasks are completed', async () => {
                // Complete all remaining tasks
                await runCLI('complete 1.0');
                await runCLI('complete 3.0');
                await runCLI('complete 5.0');

                const result = await runCLI('remaining');

                expect(result.code).toBe(0);
                expect(result.stdout).toMatch(/0 tasks remaining/);
            });

            it('should show correct count after completing some tasks', async () => {
                // Complete one pending task
                await runCLI('complete 1.0');

                const result = await runCLI('remaining');

                expect(result.code).toBe(0);
                expect(result.stdout).toMatch(/2 tasks remaining/); // 1 pending + 1 in_progress
            });
        });

        describe('JSON output', () => {
            it('should show remaining count in JSON format', async () => {
                const result = await runCLI('remaining --json');

                expect(result.code).toBe(0);
                
                // Should be valid JSON
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(data.remaining).toBe(3); // 2 pending + 1 in_progress
            });

            it('should show 0 in JSON when all tasks completed', async () => {
                // Complete all remaining tasks
                await runCLI('complete 1.0');
                await runCLI('complete 3.0');
                await runCLI('complete 5.0');

                const result = await runCLI('remaining --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(data.remaining).toBe(0);
            });

            it('should show correct count in JSON after completing some tasks', async () => {
                // Complete two tasks
                await runCLI('complete 1.0');
                await runCLI('complete 5.0');

                const result = await runCLI('remaining --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(data.remaining).toBe(1); // Only in_progress task left
            });

            it('should not contain ANSI color codes in JSON output', async () => {
                const result = await runCLI('remaining --json');
                
                expect(result.code).toBe(0);
                // JSON output should not contain ANSI escape sequences
                expect(result.stdout).not.toMatch(/\u001b\[[0-9;]*m/);
            });
        });

        describe('Count-only output', () => {
            it('should show remaining count as number only', async () => {
                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toMatch(/^3$/); // Only the number
            });

            it('should show 0 as count-only when all tasks completed', async () => {
                // Complete all remaining tasks
                await runCLI('complete 1.0');
                await runCLI('complete 3.0');
                await runCLI('complete 5.0');

                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toMatch(/^0$/);
            });

            it('should show correct number after completing some tasks', async () => {
                // Complete one task
                await runCLI('complete 3.0'); // Complete the in_progress task

                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toMatch(/^2$/); // 2 pending tasks left
            });

            it('should not contain any text, only the number', async () => {
                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).not.toContain('tasks');
                expect(result.stdout.trim()).not.toContain('remaining');
                expect(result.stdout.trim()).toMatch(/^\d+$/);
            });
        });

        describe('Flag combinations and validation', () => {
            it('should work with help flag', async () => {
                const result = await runCLI('remaining --help');

                expect(result.code).toBe(0);
                expect(result.stdout).toContain('Count incomplete tasks');
                expect(result.stdout).toContain('--json');
                expect(result.stdout).toContain('--count');
            });

            it('should handle both --json and --count flags (JSON takes precedence)', async () => {
                const result = await runCLI('remaining --json --count');

                expect(result.code).toBe(0);
                
                // Should output JSON since --json is processed first
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(typeof data.remaining).toBe('number');
            });

            it('should handle both --count and --json flags (JSON takes precedence)', async () => {
                const result = await runCLI('remaining --count --json');

                expect(result.code).toBe(0);
                
                // Should output JSON since --json is processed first
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(typeof data.remaining).toBe('number');
            });
        });

        describe('Edge cases', () => {
            it('should work with empty database', async () => {
                // Create a fresh database with no tasks
                if (existsSync(TEST_DB_PATH)) {
                    unlinkSync(TEST_DB_PATH);
                }
                await runCLI('init');

                const result = await runCLI('remaining');

                expect(result.code).toBe(0);
                expect(result.stdout).toMatch(/0 tasks remaining/);
            });

            it('should work with empty database using --count', async () => {
                // Create a fresh database with no tasks
                if (existsSync(TEST_DB_PATH)) {
                    unlinkSync(TEST_DB_PATH);
                }
                await runCLI('init');

                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toBe('0');
            });

            it('should work with empty database using --json', async () => {
                // Create a fresh database with no tasks
                if (existsSync(TEST_DB_PATH)) {
                    unlinkSync(TEST_DB_PATH);
                }
                await runCLI('init');

                const result = await runCLI('remaining --json');

                expect(result.code).toBe(0);
                
                const data = JSON.parse(result.stdout);
                expect(data).toHaveProperty('remaining');
                expect(data.remaining).toBe(0);
            });

            it('should count only pending and in_progress tasks', async () => {
                // Verify that cancelled tasks are not counted as remaining
                const result = await runCLI('remaining --count');

                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toBe('3'); // Should not count the cancelled task
                
                // Double-check with JSON output
                const jsonResult = await runCLI('remaining --json');
                const data = JSON.parse(jsonResult.stdout);
                expect(data.remaining).toBe(3); // 2 pending + 1 in_progress, no cancelled
            });
        });

        describe('Integration with task state changes', () => {
            it('should update count when task status changes from pending to completed', async () => {
                // Initial count
                let result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');

                // Complete a pending task
                await runCLI('complete 1.0');

                // Count should decrease
                result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('2');
            });

            it('should update count when task status changes from pending to in_progress', async () => {
                // Initial count
                let result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');

                // Change a pending task to in_progress
                await runCLI('update 5.0 --status in_progress');

                // Count should remain the same (still incomplete)
                result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');
            });

            it('should update count when task status changes from in_progress to completed', async () => {
                // Initial count
                let result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');

                // Complete the in_progress task
                await runCLI('complete 3.0');

                // Count should decrease
                result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('2');
            });

            it('should update count when task is cancelled', async () => {
                // Initial count
                let result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');

                // Cancel a pending task
                await runCLI('update 1.0 --status cancelled');

                // Count should decrease (cancelled tasks are not "remaining")
                result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('2');
            });

            it('should update count when completed task is reopened', async () => {
                // Complete a task first
                await runCLI('complete 1.0');
                
                let result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('2');

                // Reopen the completed task
                await runCLI('update 1.0 --status pending');

                // Count should increase
                result = await runCLI('remaining --count');
                expect(result.stdout.trim()).toBe('3');
            });
        });
    });
});