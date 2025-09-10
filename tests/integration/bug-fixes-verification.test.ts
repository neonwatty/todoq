import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { DatabaseClient } from '../../src/adapters/database/client.js';
import { MigrationManager } from '../../src/adapters/database/migrations.js';
import { TaskService } from '../../src/core/task.js';
import { NavigationService } from '../../src/core/navigation.js';

describe('Bug Fixes Verification', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let navigationService: NavigationService;
    const testDbPath = join(process.cwd(), 'test-bugfixes.db');

    beforeEach(() => {
        if (existsSync(testDbPath)) {
            rmSync(testDbPath);
        }
        db = new DatabaseClient(testDbPath);
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();
        taskService = new TaskService(db);
        navigationService = new NavigationService(db);
    });

    afterEach(() => {
        db.close();
        if (existsSync(testDbPath)) {
            rmSync(testDbPath);
        }
    });

    describe('Task Sorting Bug Fix', () => {
        it('should correctly order tasks 1.0, 2.0, ..., 10.0, 11.0 numerically', () => {
            // Create tasks that would fail with alphabetical sorting
            for (let i = 1; i <= 12; i++) {
                taskService.create({ 
                    number: `${i}.0`, 
                    name: `Task ${i}`, 
                    status: 'pending' 
                });
            }

            // Verify correct ordering
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('1.0');

            // Get all tasks and verify order
            const allTasks = taskService.list({});
            const taskNumbers = allTasks.map(t => t.taskNumber);
            
            // Should be 1.0, 2.0, 3.0, ..., 10.0, 11.0, 12.0
            // NOT 1.0, 10.0, 11.0, 12.0, 2.0, 3.0, ...
            expect(taskNumbers).toEqual([
                '1.0', '2.0', '3.0', '4.0', '5.0', '6.0',
                '7.0', '8.0', '9.0', '10.0', '11.0', '12.0'
            ]);
        });

        it('should navigate through double-digit tasks in correct order', () => {
            // Create tasks 8.0 through 12.0
            for (let i = 8; i <= 12; i++) {
                taskService.create({ 
                    number: `${i}.0`, 
                    name: `Task ${i}`, 
                    status: 'pending' 
                });
            }

            // Mark 8.0 and 9.0 as completed
            taskService.update('8.0', { status: 'completed' });
            taskService.update('9.0', { status: 'completed' });

            // Current should be 10.0, not 11.0 or 12.0
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('10.0');

            // Get next after 10.0 should be 11.0
            const nextTask = navigationService.getNextTask('10.0');
            expect(nextTask?.taskNumber).toBe('11.0');
        });
    });

    describe('Dependency Checking Bug Fix', () => {
        it('should not select tasks with unmet dependencies as current', () => {
            // Create dependency chain
            taskService.create({ number: '1.0', name: 'Prerequisite', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Depends on 1', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Depends on 2', status: 'pending', dependencies: ['2.0'] });

            // Current should be 1.0 (no dependencies)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('1.0');

            // 2.0 and 3.0 should be blocked
            const blockedTasks = navigationService.getBlockedTasks();
            const blockedNumbers = blockedTasks.map(t => t.taskNumber);
            expect(blockedNumbers).toContain('2.0');
            expect(blockedNumbers).toContain('3.0');
        });

        it('should allow task selection once dependencies are met', () => {
            // Create dependency chain
            taskService.create({ number: '1.0', name: 'Setup', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Build', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Test', status: 'pending', dependencies: ['2.0'] });

            // Complete task 1.0
            taskService.update('1.0', { status: 'completed' });

            // Now 2.0 should be current (dependency met)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('2.0');

            // 3.0 should still be blocked
            const canStart3 = navigationService.canStartTask('3.0');
            expect(canStart3.canStart).toBe(false);
            expect(canStart3.blockers[0]).toContain('2.0');
        });

        it('should handle complex multi-dependency scenarios', () => {
            // Create tasks with multiple dependencies
            taskService.create({ number: '1.0', name: 'Database Setup', status: 'completed' });
            taskService.create({ number: '2.0', name: 'API Server', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Frontend', status: 'pending', dependencies: ['1.0', '2.0'] });
            taskService.create({ number: '4.0', name: 'Integration', status: 'pending', dependencies: ['3.0'] });

            // 2.0 should be current (no dependencies)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('2.0');

            // 3.0 should be blocked (2.0 not complete)
            const canStart3 = navigationService.canStartTask('3.0');
            expect(canStart3.canStart).toBe(false);
            expect(canStart3.blockers).toHaveLength(1);
            expect(canStart3.blockers[0]).toContain('2.0');

            // Complete 2.0
            taskService.update('2.0', { status: 'completed' });

            // Now 3.0 should be available
            const newCurrentTask = navigationService.getCurrentTask();
            expect(newCurrentTask?.taskNumber).toBe('3.0');
        });
    });

    describe('Combined Sorting and Dependency Checking', () => {
        it('should handle both numerical sorting and dependencies correctly', () => {
            // Create tasks with dependencies and double-digit numbers
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '10.0', name: 'Task 10', status: 'pending' });
            taskService.create({ number: '11.0', name: 'Task 11', status: 'pending', dependencies: ['10.0'] });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending' });

            // Current should be 2.0 (dependency met, comes before 3.0 numerically)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('2.0');

            // Ready tasks should be in numerical order
            const readyTasks = navigationService.getReadyTasks();
            const readyNumbers = readyTasks.map(t => t.taskNumber);
            expect(readyNumbers).toEqual(['2.0', '3.0', '10.0']);

            // 11.0 should be blocked
            const blockedTasks = navigationService.getBlockedTasks();
            expect(blockedTasks).toHaveLength(1);
            expect(blockedTasks[0].taskNumber).toBe('11.0');
        });
    });
});