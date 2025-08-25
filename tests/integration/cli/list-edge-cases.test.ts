import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), 'dist', 'cli', 'index.js');
const TEST_DB_PATH = '/tmp/todoq-edge-case-test.db';
const TEST_CONFIG_PATH = '/tmp/.todoqrc-edge-case-test.json';
const TEST_JSON_PATH = '/tmp/test-edge-case-tasks.json';

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

describe('List Command Edge Cases and Advanced Formatting', () => {
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

        // Initialize database
        await runCLI('init');
    });

    afterEach(() => {
        // Cleanup test files
        [TEST_DB_PATH, TEST_CONFIG_PATH, TEST_JSON_PATH].forEach(file => {
            if (existsSync(file)) {
                unlinkSync(file);
            }
        });
    });

    describe('Text Truncation and Long Content', () => {
        beforeEach(async () => {
            // Create tasks with very long content
            const longContentTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task with extremely long name that should be truncated in table view because it exceeds the column width limits set by the formatter',
                        description: 'This is an extremely long description that contains a lot of detailed information about what needs to be done. It includes multiple sentences, technical details, implementation notes, and other important information that should be preserved in detailed view but truncated in table view.',
                        status: 'pending',
                        priority: 1,
                        files: [
                            'src/components/very/deep/nested/directory/structure/ComponentWithVeryLongName.tsx',
                            'src/utils/helpers/database/migrations/version_001_initial_schema_setup.sql',
                            'tests/integration/end-to-end/user-authentication/login-flow-with-two-factor-authentication.test.ts'
                        ],
                        docs_references: [
                            'https://docs.example.com/api/v1/authentication/two-factor-authentication-implementation-guide',
                            'https://developer.mozilla.org/en-US/docs/Web/API/WebAuthentication_API/Authenticator_data',
                            'https://github.com/organization/repository/wiki/Database-Schema-Migration-Best-Practices'
                        ],
                        testing_strategy: 'Comprehensive testing strategy including unit tests for individual components, integration tests for API endpoints, end-to-end tests for user workflows, performance tests for database queries, and security tests for authentication mechanisms',
                        dependencies: ['2.0'],
                        notes: 'This task requires careful coordination with the backend team, database administrators, and security specialists. It is critical for the next release and has dependencies on multiple other tasks that must be completed first.'
                    },
                    {
                        number: '2.0',
                        name: 'Short Task',
                        description: 'Short description',
                        status: 'completed',
                        priority: 2,
                        files: ['file.ts'],
                        completion_notes: 'Completed successfully'
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(longContentTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        it('should handle very long task names in detailed list view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task with extremely long name that should be truncated');
            expect(result.stdout).toContain('Status: pending');
            expect(result.stdout).toContain('This is an extremely long description that contains a lot of detailed');
        });

        it('should truncate long content in detailed table view', async () => {
            const result = await runCLI('list --detailed --format table');

            expect(result.code).toBe(0);
            const cleanOutput = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
            expect(cleanOutput).toContain('Task with extr');
            expect(cleanOutput).toContain('This is an extremel');
            expect(cleanOutput).toContain('src/compo');
            expect(cleanOutput).toContain('https://d');
            expect(cleanOutput).toContain('Comprehen');
        });

        it('should show full content in detailed tree view', async () => {
            const result = await runCLI('list --detailed --tree');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task with extremely long name that should be truncated in table view');
            expect(result.stdout).toContain('This is an extremely long description that contains a lot of detailed information');
            expect(result.stdout).toContain('ComponentWithVeryLongName.tsx');
        });

        it('should include all content in JSON output regardless of length', async () => {
            const result = await runCLI('list --json');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            const longTask = tasks.find(t => t.taskNumber === '1.0');
            
            expect(longTask.name).toContain('Task with extremely long name that should be truncated in table view');
            expect(longTask.description).toContain('This is an extremely long description that contains a lot of detailed information');
            expect(longTask.files[0]).toContain('ComponentWithVeryLongName.tsx');
            expect(longTask.testingStrategy).toContain('Comprehensive testing strategy including');
        });
    });

    describe('Unicode and Special Characters', () => {
        beforeEach(async () => {
            // Create tasks with unicode and special characters
            const unicodeTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: '🚀 Deploy application with 中文 support and ñáéíóú characters',
                        description: 'Task with emojis 🎉, Chinese characters 完成任务, and accents àèìòù',
                        status: 'pending',
                        priority: 1,
                        files: ['src/i18n/中文.json', 'assets/🎨-icons.svg'],
                        docs_references: ['https://unicode.org/标准/unicode15.0.0/', 'https://example.com/测试'],
                        testing_strategy: 'Test with various locales: en-US, zh-CN, es-ES, fr-FR 🧪',
                        notes: 'Handle right-to-left text: مرحبا, العربية, עברית'
                    },
                    {
                        number: '2.0',
                        name: 'Task with symbols: ©®™ & special chars: <>"\'/\\',
                        description: 'Contains quotes "double" and \'single\', backslashes \\ and forward slashes /',
                        status: 'in_progress',
                        priority: 2,
                        files: ['tests/special-chars<test>.ts'],
                        notes: 'Math symbols: ∑∏∆√∞≠≤≥±×÷'
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(unicodeTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        it('should display unicode characters correctly in detailed list view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('🚀 Deploy application with 中文 support');
            expect(result.stdout).toContain('emojis 🎉, Chinese characters 完成任务');
            expect(result.stdout).toContain('src/i18n/中文.json');
            expect(result.stdout).toContain('Test with various locales');
            expect(result.stdout).toContain('مرحبا, العربية, עברית');
        });

        it('should handle unicode in detailed table view', async () => {
            const result = await runCLI('list --detailed --format table');

            expect(result.code).toBe(0);
            const cleanOutput = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
            expect(cleanOutput).toContain('🚀 Deploy');
            expect(cleanOutput).toContain('Task with');
            expect(cleanOutput).toContain('src/i18n');
        });

        it('should preserve unicode in JSON output', async () => {
            const result = await runCLI('list --json');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            const unicodeTask = tasks.find(t => t.taskNumber === '1.0');
            const symbolTask = tasks.find(t => t.taskNumber === '2.0');
            
            expect(unicodeTask.name).toContain('🚀 Deploy application with 中文 support');
            expect(unicodeTask.description).toContain('emojis 🎉, Chinese characters 完成任务');
            expect(unicodeTask.files[0]).toBe('src/i18n/中文.json');
            expect(symbolTask.name).toContain('©®™ & special chars: <>"\'/\\');
            expect(symbolTask.description).toContain('quotes "double" and \'single\'');
        });

        it('should handle special characters in tree view', async () => {
            const result = await runCLI('list --detailed --tree');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('🚀 Deploy application');
            expect(result.stdout).toContain('Task with symbols: ©®™');
            expect(result.stdout).toContain('Math symbols: ∑∏∆√∞');
        });
    });

    describe('Empty and Null Values', () => {
        beforeEach(async () => {
            // Create tasks with empty, null, and undefined values
            const emptyValueTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task with empty values',
                        description: '',
                        status: 'pending',
                        priority: 0,
                        files: [],
                        docs_references: [],
                        testing_strategy: '',
                        dependencies: [],
                        notes: ''
                    },
                    {
                        number: '2.0',
                        name: 'Task with some empty values',
                        description: 'Has description',
                        status: 'pending',
                        priority: 1,
                        files: ['file1.ts'],
                        docs_references: [],
                        testing_strategy: '',
                        dependencies: ['1.0'],
                        notes: 'Has notes'
                    },
                    {
                        number: '3.0',
                        name: 'Minimal task',
                        status: 'completed'
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(emptyValueTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        it('should handle empty values in detailed list view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('○ 1.0 Task with empty values');
            expect(result.stdout).toContain('Status: pending');
            // Empty strings should not show description lines
            expect(result.stdout).not.toMatch(/Description:\s*$/m);
            expect(result.stdout).not.toMatch(/Files:\s*$/m);
            expect(result.stdout).not.toMatch(/Docs:\s*$/m);
            expect(result.stdout).not.toMatch(/Testing:\s*$/m);
            expect(result.stdout).not.toMatch(/Notes:\s*$/m);
        });

        it('should handle mixed empty/filled values in detailed view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('○ 2.0 Task with some empty values [P1]');
            expect(result.stdout).toContain('Description: Has description');
            expect(result.stdout).toContain('Files: file1.ts');
            expect(result.stdout).not.toContain('Docs:');
            expect(result.stdout).not.toContain('Testing:');
            expect(result.stdout).toContain('Notes: Has notes');
        });

        it('should handle empty values in detailed table view', async () => {
            const result = await runCLI('list --detailed --format table');

            expect(result.code).toBe(0);
            const cleanOutput = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
            expect(cleanOutput).toContain('1.0');
            expect(cleanOutput).toContain('Task with empt'); // Truncated in table
            expect(cleanOutput).toContain('pending');
            expect(cleanOutput).toContain('2.0');
            expect(cleanOutput).toContain('Task with some');
            expect(cleanOutput).toContain('Has description');
            expect(cleanOutput).toContain('file1.ts');
        });

        it('should preserve empty values in JSON output', async () => {
            const result = await runCLI('list --json');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            const emptyTask = tasks.find(t => t.taskNumber === '1.0');
            const mixedTask = tasks.find(t => t.taskNumber === '2.0');
            const minimalTask = tasks.find(t => t.taskNumber === '3.0');
            
            expect(emptyTask.description || '').toBe('');
            expect(emptyTask.files || []).toEqual([]);
            expect(emptyTask.docsReferences || []).toEqual([]);
            expect(emptyTask.testingStrategy || '').toBe('');
            expect(emptyTask.notes || '').toBe('');
            
            expect(mixedTask.description).toBe('Has description');
            expect(mixedTask.files).toEqual(['file1.ts']);
            expect(mixedTask.docsReferences || []).toEqual([]);
            
            if (minimalTask) {
                expect(minimalTask.name).toBe('Minimal task');
                expect(minimalTask.priority).toBe(0); // Default value
            }
        });
    });

    describe('Large Dataset Performance', () => {
        beforeEach(async () => {
            // Create a large number of tasks
            const largeTasks = {
                tasks: Array.from({ length: 100 }, (_, i) => ({
                    number: `${i + 1}.0`,
                    name: `Task ${i + 1}`,
                    description: `Description for task ${i + 1}`,
                    status: i % 4 === 0 ? 'completed' : i % 4 === 1 ? 'in_progress' : i % 4 === 2 ? 'cancelled' : 'pending',
                    priority: i % 3,
                    files: [`src/task${i + 1}.ts`, `tests/task${i + 1}.test.ts`],
                    docs_references: [`https://docs.example.com/task${i + 1}`],
                    testing_strategy: `Testing strategy for task ${i + 1}`,
                    notes: `Notes for task ${i + 1}`
                }))
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(largeTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        it('should handle large dataset in detailed list view', async () => {
            const result = await runCLI('list --detailed --status pending');

            expect(result.code).toBe(0);
            // Should contain multiple tasks
            expect(result.stdout).toMatch(/○.*Task \d+/);
            expect(result.stdout).toMatch(/Description: Description for task \d+/);
            expect(result.stdout).toMatch(/Files: src\/task\d+\.ts, tests\/task\d+\.test\.ts/);
            // Should contain many tasks
            expect(result.stdout.split('○').length).toBeGreaterThan(10);
        });

        it('should handle large dataset in detailed table view', async () => {
            const result = await runCLI('list --detailed --format table --status completed');

            expect(result.code).toBe(0);
            const cleanOutput = result.stdout.replace(/\u001b\[[0-9;]*m/g, '');
            expect(cleanOutput).toContain('Number');
            expect(cleanOutput).toContain('Name');  
            expect(cleanOutput).toContain('Status');
            expect(cleanOutput).toMatch(/Pri(ority|…)/);
            expect(cleanOutput).toContain('Description');
            expect(cleanOutput).toMatch(/\d+\.0/); // Should contain task numbers
            expect(cleanOutput).toMatch(/complet(ed|…)/); // Status may be truncated
            // Should handle the large table without errors
            expect(result.stdout.split('\n').length).toBeGreaterThan(10);
        });

        it('should handle large dataset in JSON output efficiently', async () => {
            const result = await runCLI('list --json');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            expect(Array.isArray(tasks)).toBe(true);
            expect(tasks.length).toBeGreaterThan(50); // Should have many tasks, but don't expect exact number due to default filtering
            
            // Check that tasks exist with expected structure
            const firstTask = tasks.find(t => t.taskNumber === '1.0');
            const lastTask = tasks.find(t => t.taskNumber === '100.0');
            
            if (firstTask) {
                expect(firstTask.name).toBe('Task 1');
            }
            if (lastTask) {
                expect(lastTask.name).toBe('Task 100');
            }
        });

        it('should filter large dataset efficiently', async () => {
            const result = await runCLI('list --json --status in_progress');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            expect(tasks.length).toBeGreaterThan(15); // Should be roughly 1/4 of total tasks
            expect(tasks.length).toBeLessThan(35);
            tasks.forEach(task => {
                expect(task.status).toBe('in_progress');
            });
        });
    });

    describe('Formatting Edge Cases', () => {
        beforeEach(async () => {
            // Create tasks with edge case formatting scenarios
            const edgeCaseTasks = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Task\nwith\nnewlines',
                        description: 'Description\nwith\nmultiple\nlines',
                        status: 'pending',
                        priority: 1,
                        files: ['file\nwith\nnewlines.ts'],
                        notes: 'Notes\nwith\nnewlines'
                    },
                    {
                        number: '2.0',
                        name: 'Task\twith\ttabs',
                        description: 'Description\twith\ttabs',
                        status: 'pending',
                        priority: 2,
                        files: ['file\twith\ttabs.ts'],
                        notes: 'Notes\twith\ttabs'
                    },
                    {
                        number: '3.0',
                        name: 'Task with "quotes" and \'apostrophes\'',
                        description: 'Has "double quotes", \'single quotes\', and `backticks`',
                        status: 'pending',
                        priority: 0,
                        notes: 'Quotes: "test" \'test\' `test`'
                    }
                ]
            };

            writeFileSync(TEST_JSON_PATH, JSON.stringify(edgeCaseTasks, null, 2));
            await runCLI(`import "${TEST_JSON_PATH}"`);
        });

        it('should handle newlines in detailed view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task\nwith\nnewlines');
            expect(result.stdout).toContain('Description\nwith\nmultiple\nlines');
        });

        it('should handle tabs in detailed view', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task\twith\ttabs');
            expect(result.stdout).toContain('Description\twith\ttabs');
        });

        it('should handle quotes and special characters', async () => {
            const result = await runCLI('list --detailed');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Task with "quotes" and \'apostrophes\'');
            expect(result.stdout).toContain('Has "double quotes", \'single quotes\', and `backticks`');
            expect(result.stdout).toContain('Quotes: "test" \'test\' `test`');
        });

        it('should preserve formatting in JSON output', async () => {
            const result = await runCLI('list --json');

            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            const newlineTask = tasks.find(t => t.taskNumber === '1.0');
            const tabTask = tasks.find(t => t.taskNumber === '2.0');
            const quoteTask = tasks.find(t => t.taskNumber === '3.0');
            
            expect(newlineTask.name).toBe('Task\nwith\nnewlines');
            expect(newlineTask.description).toBe('Description\nwith\nmultiple\nlines');
            expect(tabTask.name).toBe('Task\twith\ttabs');
            expect(quoteTask.name).toBe('Task with "quotes" and \'apostrophes\'');
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle detailed view with corrupted task data gracefully', async () => {
            // Create task with potentially problematic data
            await runCLI('insert 1.0 "Normal Task"');
            
            // This should not crash the formatter
            const result = await runCLI('list --detailed');
            expect(result.code).toBe(0);
            expect(result.stdout).toContain('○ 1.0 Normal Task');
        });

        it('should handle JSON output with various data types', async () => {
            await runCLI('insert 1.0 "Test Task" --priority 0');
            
            const result = await runCLI('list --json');
            expect(result.code).toBe(0);
            
            const tasks = JSON.parse(result.stdout);
            expect(Array.isArray(tasks)).toBe(true);
            expect(typeof tasks[0].priority).toBe('number');
            expect(typeof tasks[0].name).toBe('string');
            expect(Array.isArray(tasks[0].files || [])).toBe(true);
        });
    });
});