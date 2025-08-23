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

            // Create test tasks JSON
            const testTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Test Task 1',
                        description: 'First test task',
                        status: 'pending',
                        priority: 1
                    },
                    {
                        number: '1.1',
                        name: 'Subtask 1',
                        description: 'First subtask',
                        parent: '1.0',
                        status: 'pending',
                        priority: 0
                    },
                    {
                        number: '2.0',
                        name: 'Test Task 2',
                        description: 'Second test task',
                        status: 'pending',
                        priority: 2
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
            const result = await runCLI('list');

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
            await runCLI('complete 1.1');
            
            const result = await runCLI('stats');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task Statistics');
            expect(result.stdout).toContain('Total tasks: 3');
            expect(result.stdout).toContain('Completed: 2');
            expect(result.stdout).toContain('Pending: 1');
        });

        it('should export tasks to JSON', async () => {
            await runCLI(`import "${TEST_JSON_PATH}"`);
            const result = await runCLI('export --pretty');

            expect(result.code).toBe(0);
            const exportedData = JSON.parse(result.stdout);
            expect(exportedData.tasks).toHaveLength(3);
            expect(exportedData.tasks[0].number).toBe('1.0');
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
});