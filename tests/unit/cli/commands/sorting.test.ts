import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { DatabaseClient } from '../../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../../src/core/task.js';
import { NavigationService } from '../../../../src/core/navigation.js';
import { TaskInput } from '../../../../src/core/types.js';

describe('Task Number Sorting', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let navigationService: NavigationService;
    const testDbPath = join(process.cwd(), 'test-sorting.db');

    beforeEach(() => {
        // Clean up any existing test database
        if (existsSync(testDbPath)) {
            rmSync(testDbPath);
        }

        // Initialize database
        db = new DatabaseClient(testDbPath);
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();

        // Initialize services
        taskService = new TaskService(db);
        navigationService = new NavigationService(db);
    });

    afterEach(() => {
        // Close database connection
        db.close();

        // Clean up test database
        if (existsSync(testDbPath)) {
            rmSync(testDbPath);
        }
    });

    describe('Numerical Ordering', () => {
        it('should sort tasks numerically, not alphabetically', () => {
            // Create tasks with numbers that would sort incorrectly alphabetically
            const tasks: TaskInput[] = [
                { number: '1.0', name: 'Task 1', status: 'pending' },
                { number: '2.0', name: 'Task 2', status: 'pending' },
                { number: '10.0', name: 'Task 10', status: 'pending' },
                { number: '11.0', name: 'Task 11', status: 'pending' },
                { number: '3.0', name: 'Task 3', status: 'pending' },
                { number: '20.0', name: 'Task 20', status: 'pending' },
            ];

            // Insert tasks in random order
            for (const task of tasks) {
                taskService.create(task);
            }

            // Get all tasks
            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);

            // Should be in numerical order
            expect(taskNumbers).toEqual(['1.0', '2.0', '3.0', '10.0', '11.0', '20.0']);
        });

        it('should sort subtasks numerically', () => {
            // Create parent task
            taskService.create({ number: '1.0', name: 'Parent', status: 'pending' });

            // Create subtasks with numbers that would sort incorrectly alphabetically
            const subtasks: TaskInput[] = [
                { number: '1.1', name: 'Subtask 1', parent: '1.0', status: 'pending' },
                { number: '1.10', name: 'Subtask 10', parent: '1.0', status: 'pending' },
                { number: '1.11', name: 'Subtask 11', parent: '1.0', status: 'pending' },
                { number: '1.2', name: 'Subtask 2', parent: '1.0', status: 'pending' },
                { number: '1.20', name: 'Subtask 20', parent: '1.0', status: 'pending' },
                { number: '1.3', name: 'Subtask 3', parent: '1.0', status: 'pending' },
            ];

            // Insert subtasks in random order
            for (const task of subtasks) {
                taskService.create(task);
            }

            // Get all tasks
            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);

            // Should be in numerical order
            expect(taskNumbers).toEqual(['1.0', '1.1', '1.2', '1.3', '1.10', '1.11', '1.20']);
        });

        it('should handle mixed major and minor numbers correctly', () => {
            const tasks: TaskInput[] = [
                { number: '1.1', name: 'Task 1.1', status: 'pending' },
                { number: '2.10', name: 'Task 2.10', status: 'pending' },
                { number: '10.1', name: 'Task 10.1', status: 'pending' },
                { number: '2.2', name: 'Task 2.2', status: 'pending' },
                { number: '10.10', name: 'Task 10.10', status: 'pending' },
                { number: '1.10', name: 'Task 1.10', status: 'pending' },
            ];

            for (const task of tasks) {
                taskService.create(task);
            }

            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);

            expect(taskNumbers).toEqual(['1.1', '1.10', '2.2', '2.10', '10.1', '10.10']);
        });
    });

    describe('Navigation with Numerical Ordering', () => {
        it('should get current task in numerical order', () => {
            // Create tasks out of order
            taskService.create({ number: '10.0', name: 'Task 10', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '1.0', name: 'Task 1', status: 'pending' });

            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('1.0');
        });

        it('should get next task in numerical order', () => {
            // Create tasks
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '10.0', name: 'Task 10', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending' });

            const nextTask = navigationService.getNextTask('2.0');
            expect(nextTask?.taskNumber).toBe('3.0'); // Should be 3.0, not 10.0
        });

        it('should handle large task numbers correctly', () => {
            // Create tasks with very large numbers
            const tasks: TaskInput[] = [];
            for (let i = 1; i <= 25; i++) {
                tasks.push({ number: `${i}.0`, name: `Task ${i}`, status: 'pending' });
            }

            // Shuffle the array to insert in random order
            const shuffled = [...tasks].sort(() => Math.random() - 0.5);
            for (const task of shuffled) {
                taskService.create(task);
            }

            // Get all tasks and verify order
            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => parseInt(t.taskNumber));
            
            // Should be in ascending numerical order
            for (let i = 1; i < taskNumbers.length; i++) {
                expect(taskNumbers[i]).toBeGreaterThan(taskNumbers[i - 1]);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle single-digit task numbers', () => {
            taskService.create({ number: '1', name: 'Task 1', status: 'pending' });
            taskService.create({ number: '10', name: 'Task 10', status: 'pending' });
            taskService.create({ number: '2', name: 'Task 2', status: 'pending' });

            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);

            // Note: parseTaskNumber should handle single numbers (no dot)
            expect(taskNumbers[0]).toBe('1');
            expect(taskNumbers[1]).toBe('2');
            expect(taskNumbers[2]).toBe('10');
        });

        it('should handle zero-padded numbers correctly', () => {
            taskService.create({ number: '01.0', name: 'Task 01', status: 'pending' });
            taskService.create({ number: '10.0', name: 'Task 10', status: 'pending' });
            taskService.create({ number: '02.0', name: 'Task 02', status: 'pending' });

            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);

            // Should treat 01 as 1, 02 as 2, etc.
            expect(taskNumbers).toEqual(['01.0', '02.0', '10.0']);
        });
    });
});