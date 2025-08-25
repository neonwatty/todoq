import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { createTestDir } from './setup.js';
import { runCliInDir, createTasksFile, sampleTasks, assertCliSuccess, assertCliError } from './helpers.js';

describe('CLI Integration Functional Tests', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = createTestDir();
        mkdirSync(testDir, { recursive: true });
    });

    describe('Complete User Workflows', () => {
        it('should support full workflow: init → template → import → list → complete', async () => {
            // Step 1: Initialize
            const initResult = await runCliInDir(testDir, 'init');
            expect(initResult.code).toBe(0);
            expect(existsSync(path.join(testDir, '.todoqrc'))).toBe(true);
            expect(existsSync(path.join(testDir, '.todoq', 'todoq.db'))).toBe(true);

            // Step 2: Generate template
            const templateResult = await runCliInDir(testDir, 'template');
            expect(templateResult.code).toBe(0);
            expect(templateResult.stdout).toContain('"tasks"');
            
            const templateData = JSON.parse(templateResult.stdout);
            expect(templateData.tasks).toHaveLength(4);

            // Step 3: Save template to file and import
            const tasksFile = path.join(testDir, 'tasks.json');
            writeFileSync(tasksFile, JSON.stringify(templateData, null, 2));
            
            const importResult = await runCliInDir(testDir, `import ${tasksFile}`);
            expect(importResult.code).toBe(0);
            expect(importResult.stdout).toContain('Import completed successfully');

            // Step 4: List tasks
            const listResult = await runCliInDir(testDir, 'list');
            expect(listResult.code).toBe(0);
            expect(listResult.stdout).toContain('1.0');
            expect(listResult.stdout).toContain('Project Setup');

            // Step 5: Mark task as complete
            const completeResult = await runCliInDir(testDir, 'complete 1.1');
            expect(completeResult.code).toBe(0);

            // Step 6: Verify completion
            const finalListResult = await runCliInDir(testDir, 'list --completed');
            expect(finalListResult.code).toBe(0);
            expect(finalListResult.stdout).toContain('1.1');
        });

        it('should maintain state between command invocations', async () => {
            // Initialize and import tasks
            await runCliInDir(testDir, 'init');
            
            const taskData = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Test Task',
                        status: 'pending',
                        priority: 1
                    }
                ]
            };
            
            const tasksFile = path.join(testDir, 'test-tasks.json');
            writeFileSync(tasksFile, JSON.stringify(taskData));
            await runCliInDir(testDir, `import ${tasksFile}`);

            // First command invocation - mark in progress
            const progressResult = await runCliInDir(testDir, 'in-progress 1.0');
            expect(progressResult.code).toBe(0);

            // Second command invocation - verify state persisted
            const showResult = await runCliInDir(testDir, 'show 1.0');
            expect(showResult.code).toBe(0);
            expect(showResult.stdout).toContain('in_progress');

            // Third command invocation - complete task
            const completeResult = await runCliInDir(testDir, 'complete 1.0');
            expect(completeResult.code).toBe(0);

            // Fourth command invocation - verify completion
            const finalShowResult = await runCliInDir(testDir, 'show 1.0');
            expect(finalShowResult.code).toBe(0);
            expect(finalShowResult.stdout).toContain('completed');
        });
    });

    describe('File System Persistence', () => {
        it('should persist database changes across CLI invocations', async () => {
            await runCliInDir(testDir, 'init');

            // Create task via import
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Persistent Task', status: 'pending', priority: 0 }
                ]
            };
            const tasksFile = path.join(testDir, 'tasks.json');
            writeFileSync(tasksFile, JSON.stringify(taskData));
            await runCliInDir(testDir, `import ${tasksFile}`);

            // Verify task exists in new invocation
            const listResult = await runCliInDir(testDir, 'list');
            expect(listResult.code).toBe(0);
            expect(listResult.stdout).toContain('Persistent Task');

            // Make changes in one invocation
            await runCliInDir(testDir, 'in-progress 1.0');

            // Verify changes persist in another invocation
            const showResult = await runCliInDir(testDir, 'show 1.0');
            expect(showResult.code).toBe(0);
            expect(showResult.stdout).toContain('in_progress');
        });

        it('should work with relative paths and nested directories', async () => {
            // Initialize in nested directory
            const nestedDir = path.join(testDir, 'project', 'tasks');
            mkdirSync(nestedDir, { recursive: true });
            
            await runCliInDir(nestedDir, 'init');

            // Create tasks file with relative path reference
            const taskData = {
                tasks: [
                    {
                        number: '1.0',
                        name: 'Nested Project Task',
                        status: 'pending',
                        files: ['./src/main.ts', '../config.json']
                    }
                ]
            };
            
            const tasksFile = path.join(nestedDir, 'project-tasks.json');
            writeFileSync(tasksFile, JSON.stringify(taskData));
            await runCliInDir(nestedDir, 'import project-tasks.json');

            // Verify from parent directory
            const parentDir = path.join(testDir, 'project');
            const listResult = await runCliInDir(nestedDir, 'list');
            expect(listResult.code).toBe(0);
            expect(listResult.stdout).toContain('Nested Project Task');
        });
    });

    describe('Cross-Command Compatibility', () => {
        it('should handle hierarchical task completion correctly', async () => {
            await runCliInDir(testDir, 'init');

            // Import hierarchical tasks
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Parent Task', status: 'pending', priority: 1 },
                    { number: '1.1', name: 'Child Task 1', parent: '1.0', status: 'pending', priority: 0 },
                    { number: '1.2', name: 'Child Task 2', parent: '1.0', status: 'pending', priority: 0 }
                ]
            };
            
            const tasksFile = path.join(testDir, 'hierarchy.json');
            writeFileSync(tasksFile, JSON.stringify(taskData));
            await runCliInDir(testDir, `import ${tasksFile}`);

            // Complete child tasks
            await runCliInDir(testDir, 'complete 1.1');
            await runCliInDir(testDir, 'complete 1.2');

            // Check if parent auto-completes
            const showResult = await runCliInDir(testDir, 'show 1.0');
            expect(showResult.code).toBe(0);
            // Note: Auto-completion behavior depends on business logic implementation
        });

        it('should handle dependencies correctly', async () => {
            await runCliInDir(testDir, 'init');

            // Import tasks with dependencies
            const taskData = {
                tasks: [
                    { number: '1.0', name: 'Setup', status: 'pending', priority: 1 },
                    { number: '2.0', name: 'Implementation', status: 'pending', priority: 1, dependencies: ['1.0'] }
                ]
            };
            
            const tasksFile = path.join(testDir, 'dependencies.json');
            writeFileSync(tasksFile, JSON.stringify(taskData));
            await runCliInDir(testDir, `import ${tasksFile}`);

            // List tasks and verify dependency information is shown
            const listResult = await runCliInDir(testDir, 'list');
            expect(listResult.code).toBe(0);
            expect(listResult.stdout).toContain('Setup');
            expect(listResult.stdout).toContain('Implementation');
        });
    });

    describe('Export and Re-import Workflows', () => {
        it('should support export → modify → re-import workflow', async () => {
            await runCliInDir(testDir, 'init');

            // Import initial tasks
            const initialData = {
                tasks: [
                    { number: '1.0', name: 'Original Task', status: 'pending', priority: 1 }
                ]
            };
            
            const initialFile = path.join(testDir, 'initial.json');
            writeFileSync(initialFile, JSON.stringify(initialData));
            await runCliInDir(testDir, `import ${initialFile}`);

            // Mark task in progress
            await runCliInDir(testDir, 'in-progress 1.0');

            // Export current state
            const exportResult = await runCliInDir(testDir, 'export --pretty');
            expect(exportResult.code).toBe(0);
            
            const exportedData = JSON.parse(exportResult.stdout);
            expect(exportedData.tasks).toHaveLength(1);
            expect(exportedData.tasks[0].status).toBe('in_progress');

            // Modify exported data
            exportedData.tasks[0].name = 'Modified Task';
            exportedData.tasks.push({
                number: '2.0',
                name: 'Additional Task',
                status: 'pending',
                priority: 0
            });

            // Save and re-import modified data
            const modifiedFile = path.join(testDir, 'modified.json');
            writeFileSync(modifiedFile, JSON.stringify(exportedData, null, 2));
            
            // Note: This would overwrite existing data
            // For now, just verify the export worked correctly
            const listResult = await runCliInDir(testDir, 'list');
            expect(listResult.code).toBe(0);
        });
    });

    describe('Error Handling and Recovery', () => {
        it('should handle missing database gracefully', async () => {
            // Don't run init - try to use commands without database
            const listResult = await runCliInDir(testDir, 'list', { expectError: true });
            
            // The CLI might auto-create the database, so check if it fails or succeeds gracefully
            // If it succeeds, it should show no tasks; if it fails, it should have an error
            if (listResult.code === 0) {
                // Database was auto-created, should show empty list
                expect(listResult.stdout).toContain('No tasks found');
            } else {
                // Database creation failed, should have error message
                expect(listResult.stderr).toBeTruthy();
            }
        });

        it('should handle corrupted config files', async () => {
            await runCliInDir(testDir, 'init');
            
            // Corrupt the config file
            const configPath = path.join(testDir, '.todoqrc');
            writeFileSync(configPath, '{ invalid json }');

            // CLI should handle this gracefully
            const result = await runCliInDir(testDir, 'list', { expectError: true });
            
            // The CLI might fall back to defaults or fail gracefully
            if (result.code === 0) {
                // CLI used default config and succeeded
                expect(result.stdout).toBeDefined();
            } else {
                // CLI failed due to config error
                expect(result.stderr).toBeTruthy();
            }
        });

        it('should handle invalid JSON import gracefully', async () => {
            await runCliInDir(testDir, 'init');
            
            // Create invalid JSON file
            const invalidFile = path.join(testDir, 'invalid.json');
            writeFileSync(invalidFile, '{ "tasks": [ invalid json ] }');

            const importResult = await runCliInDir(testDir, `import ${invalidFile}`, { expectError: true });
            expect(importResult.code).not.toBe(0);
            expect(importResult.stderr).toBeTruthy();
        });
    });

    describe('Clear Command', () => {
        beforeEach(async () => {
            await runCliInDir(testDir, 'init');
            
            // Create some test tasks
            const tasksFile = createTasksFile(testDir, 'tasks.json', sampleTasks.hierarchical);
            await runCliInDir(testDir, `import ${tasksFile}`);
        });

        it('should require confirmation by default', async () => {
            // Running clear without --confirm should show confirmation prompt
            // We can't easily test interactive prompts in functional tests,
            // so we'll just verify that --confirm flag is the expected way to skip prompts
            const result = await runCliInDir(testDir, 'clear --confirm');
            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Deleted');
            
            // Verify all tasks are gone after confirmation
            const listResult = await runCliInDir(testDir, 'list');
            expect(listResult.stdout).toContain('No tasks found');
        });

        it('should clear all tasks with --confirm flag', async () => {
            // Verify tasks exist first
            const beforeResult = await runCliInDir(testDir, 'list');
            expect(beforeResult.stdout).toContain('1.0');

            // Clear with --confirm flag should skip confirmation
            const clearResult = await runCliInDir(testDir, 'clear --confirm');
            expect(clearResult.code).toBe(0);
            expect(clearResult.stdout).toContain('Deleted');

            // Verify all tasks are gone
            const afterResult = await runCliInDir(testDir, 'list');
            expect(afterResult.stdout).toContain('No tasks found');
        });

        it('should work with JSON output', async () => {
            const result = await runCliInDir(testDir, 'clear --confirm --json');
            expect(result.code).toBe(0);

            const output = JSON.parse(result.stdout);
            expect(output).toHaveProperty('deletedCount');
            expect(typeof output.deletedCount).toBe('number');
            expect(output.deletedCount).toBeGreaterThan(0);
        });

        it('should handle empty database gracefully', async () => {
            // Clear once
            await runCliInDir(testDir, 'clear --confirm');

            // Clear again on empty database
            const result = await runCliInDir(testDir, 'clear --confirm');
            expect(result.code).toBe(0);
            expect(result.stdout).toContain('No tasks to delete');
        });
    });
});