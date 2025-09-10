import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { DatabaseClient } from '../../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../../src/core/task.js';
import { NavigationService } from '../../../../src/core/navigation.js';
import { TaskInput } from '../../../../src/core/types.js';

describe('Dependency Checking in Navigation', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let navigationService: NavigationService;
    const testDbPath = join(process.cwd(), 'test-dependencies.db');

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

    describe('getCurrentTask with Dependencies', () => {
        it('should skip tasks with unmet dependencies', () => {
            // Create tasks with dependencies
            taskService.create({ number: '1.0', name: 'Setup', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Main Task', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Independent', status: 'pending' });

            // Current task should be 1.0, not 2.0 (which is blocked)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('1.0');
        });

        it('should return task with met dependencies', () => {
            // Create tasks with dependencies
            taskService.create({ number: '1.0', name: 'Setup', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Main Task', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Final', status: 'pending', dependencies: ['2.0'] });

            // Current task should be 2.0 (dependency 1.0 is completed)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('2.0');
        });

        it('should return null when all tasks are blocked', () => {
            // Create circular-like blocking (not circular dependency, just all blocked)
            taskService.create({ number: '1.0', name: 'Task 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending', dependencies: ['1.0', '2.0'] });

            // Mark task 1 as cancelled (not completed)
            taskService.update('1.0', { status: 'cancelled' });

            // No task should be available (all blocked by cancelled task)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask).toBeNull();
        });

        it('should handle multiple dependencies correctly', () => {
            // Create tasks with multiple dependencies
            taskService.create({ number: '1.0', name: 'Setup 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Setup 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Main Task', status: 'pending', dependencies: ['1.0', '2.0'] });

            // Task 3.0 should be blocked (2.0 not completed)
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('2.0');

            // Complete task 2.0
            taskService.update('2.0', { status: 'completed' });

            // Now task 3.0 should be available
            const nextTask = navigationService.getCurrentTask();
            expect(nextTask?.taskNumber).toBe('3.0');
        });
    });

    describe('getNextTask with Dependencies', () => {
        it('should skip blocked tasks when getting next', () => {
            // Create tasks (create dependency before dependent)
            taskService.create({ number: '1.0', name: 'Current', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Dependency', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Blocked', status: 'pending', dependencies: ['3.0'] });
            taskService.create({ number: '4.0', name: 'Available', status: 'pending' });

            // Next task after 1.0 should be 3.0 (2.0 is blocked)
            const nextTask = navigationService.getNextTask('1.0');
            expect(nextTask?.taskNumber).toBe('3.0');
        });
    });

    describe('getBlockedTasks', () => {
        it('should return all blocked tasks', () => {
            // Create tasks with various dependency states
            taskService.create({ number: '1.0', name: 'Base', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Blocked 1', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Blocked 2', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '4.0', name: 'Available', status: 'pending' });

            const blockedTasks = navigationService.getBlockedTasks();
            const blockedNumbers = blockedTasks.map(t => t.taskNumber);

            expect(blockedNumbers).toEqual(['2.0', '3.0']);
        });

        it('should return empty array when no tasks are blocked', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });

            const blockedTasks = navigationService.getBlockedTasks();
            expect(blockedTasks).toEqual([]);
        });
    });

    describe('getReadyTasks', () => {
        it('should return only tasks with no blockers', () => {
            taskService.create({ number: '1.0', name: 'Ready 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Ready 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Blocked', status: 'pending', dependencies: ['1.0'] });

            const readyTasks = navigationService.getReadyTasks();
            const readyNumbers = readyTasks.map(t => t.taskNumber);

            expect(readyNumbers).toEqual(['1.0', '2.0']);
        });

        it('should include in-progress tasks', () => {
            taskService.create({ number: '1.0', name: 'In Progress', status: 'in_progress' });
            taskService.create({ number: '2.0', name: 'Pending', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Completed', status: 'completed' });

            const readyTasks = navigationService.getReadyTasks();
            const readyNumbers = readyTasks.map(t => t.taskNumber);

            expect(readyNumbers).toEqual(['1.0', '2.0']);
        });
    });

    describe('canStartTask', () => {
        it('should identify when task can start', () => {
            taskService.create({ number: '1.0', name: 'Dependency', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task', status: 'pending', dependencies: ['1.0'] });

            const result = navigationService.canStartTask('2.0');
            expect(result.canStart).toBe(true);
            expect(result.blockers).toEqual([]);
        });

        it('should identify blockers when task cannot start', () => {
            taskService.create({ number: '1.0', name: 'Blocker 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Blocker 2', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Task', status: 'pending', dependencies: ['1.0', '2.0'] });

            const result = navigationService.canStartTask('3.0');
            expect(result.canStart).toBe(false);
            expect(result.blockers).toHaveLength(2);
            expect(result.blockers[0]).toContain('1.0 Blocker 1 (pending)');
            expect(result.blockers[1]).toContain('2.0 Blocker 2 (in_progress)');
        });

        it('should throw error for non-existent task', () => {
            expect(() => navigationService.canStartTask('999.0')).toThrow('Task 999.0 not found');
        });
    });

    describe('Complex Dependency Scenarios', () => {
        it('should handle deep dependency chains', () => {
            // Create a chain: 1 -> 2 -> 3 -> 4 -> 5
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'completed', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending', dependencies: ['2.0'] });
            taskService.create({ number: '4.0', name: 'Task 4', status: 'pending', dependencies: ['3.0'] });
            taskService.create({ number: '5.0', name: 'Task 5', status: 'pending', dependencies: ['4.0'] });

            // Only task 3 should be available
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask?.taskNumber).toBe('3.0');

            const blockedTasks = navigationService.getBlockedTasks();
            const blockedNumbers = blockedTasks.map(t => t.taskNumber);
            expect(blockedNumbers).toEqual(['4.0', '5.0']);
        });

        it('should handle diamond dependencies', () => {
            //     1.0
            //    /   \
            //   2.0   3.0
            //    \   /
            //     4.0
            taskService.create({ number: '1.0', name: 'Root', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Left', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Right', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '4.0', name: 'Bottom', status: 'pending', dependencies: ['2.0', '3.0'] });

            // Tasks 2.0 and 3.0 should be ready
            const readyTasks = navigationService.getReadyTasks();
            const readyNumbers = readyTasks.map(t => t.taskNumber).sort();
            expect(readyNumbers).toEqual(['2.0', '3.0']);

            // Task 4.0 should be blocked
            const canStart = navigationService.canStartTask('4.0');
            expect(canStart.canStart).toBe(false);
            expect(canStart.blockers).toHaveLength(2);
        });
    });

    describe('Integration with work-next Command', () => {
        it('should prevent selecting blocked tasks', () => {
            // Simulate what work-next does
            taskService.create({ number: '1.0', name: 'Prerequisite', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Main Work', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Follow-up', status: 'pending', dependencies: ['2.0'] });

            // work-next uses getCurrentTask internally
            const taskForClaude = navigationService.getCurrentTask();
            
            // Should get task 1.0, not 2.0 or 3.0
            expect(taskForClaude?.taskNumber).toBe('1.0');
            
            // Verify 2.0 and 3.0 are blocked
            const blocked = navigationService.getBlockedTasks().map(t => t.taskNumber);
            expect(blocked).toEqual(['2.0', '3.0']);
        });
    });
});