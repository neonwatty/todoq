import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../src/core/task.js';

describe('TaskService Integration', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    const testDbPath = ':memory:';

    beforeEach(async () => {
        db = new DatabaseClient(testDbPath);
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();
        taskService = new TaskService(db);
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
    });

    describe('CRUD Operations', () => {
        it('should create a task', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task',
                description: 'A test task',
                status: 'pending' as const,
                priority: 1
            };

            const task = taskService.create(taskInput);

            expect(task.taskNumber).toBe('1.0');
            expect(task.name).toBe('Test Task');
            expect(task.status).toBe('pending');
            expect(task.priority).toBe(1);
            expect(task.id).toBeDefined();
            expect(task.createdAt).toBeInstanceOf(Date);
        });

        it('should find task by number', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task'
            };

            taskService.create(taskInput);
            const found = taskService.findByNumber('1.0');

            expect(found).toBeDefined();
            expect(found?.taskNumber).toBe('1.0');
            expect(found?.name).toBe('Test Task');
        });

        it('should find task by ID', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task'
            };

            const created = taskService.create(taskInput);
            const found = taskService.findById(created.id!);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.taskNumber).toBe('1.0');
        });

        it('should update a task', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task'
            };

            taskService.create(taskInput);
            const updated = taskService.update('1.0', { 
                name: 'Updated Task',
                status: 'in_progress',
                priority: 2
            });

            expect(updated.name).toBe('Updated Task');
            expect(updated.status).toBe('in_progress');
            expect(updated.priority).toBe(2);
        });

        it('should delete a task', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task'
            };

            taskService.create(taskInput);
            const deleted = taskService.delete('1.0');

            expect(deleted).toBe(true);
            expect(taskService.findByNumber('1.0')).toBeNull();
        });

        it('should return false when deleting non-existent task', () => {
            expect(() => taskService.delete('non-existent')).toThrow('Task non-existent not found');
        });
    });

    describe('Task Hierarchy', () => {
        it('should create parent-child relationships', () => {
            const parent = { number: '1.0', name: 'Parent Task' };
            const child = { number: '1.1', name: 'Child Task', parent: '1.0' };

            const parentTask = taskService.create(parent);
            const childTask = taskService.create(child);

            expect(childTask.parentId).toBe(parentTask.id);
        });

        it('should reject child task with non-existent parent', () => {
            const child = { number: '1.1', name: 'Child Task', parent: '1.0' };

            expect(() => taskService.create(child)).toThrow('Parent task 1.0 not found');
        });

        it('should delete child tasks when parent is deleted', () => {
            const parent = { number: '1.0', name: 'Parent Task' };
            const child = { number: '1.1', name: 'Child Task', parent: '1.0' };

            taskService.create(parent);
            taskService.create(child);

            taskService.delete('1.0');

            expect(taskService.findByNumber('1.0')).toBeNull();
            expect(taskService.findByNumber('1.1')).toBeNull();
        });
    });

    describe('Task Listing', () => {
        beforeEach(() => {
            // Create test data
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '2.1', name: 'Task 2.1', parent: '2.0', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'cancelled' });
        });

        it('should list all tasks', () => {
            const tasks = taskService.list({ includeCompleted: true });

            expect(tasks).toHaveLength(4);
            expect(tasks.map(t => t.taskNumber)).toEqual(['1.0', '2.0', '2.1', '3.0']);
        });

        it('should filter tasks by status', () => {
            const pendingTasks = taskService.list({ status: 'pending' });
            const completedTasks = taskService.list({ status: 'completed' });

            expect(pendingTasks).toHaveLength(1);
            expect(pendingTasks[0].taskNumber).toBe('2.0');

            expect(completedTasks).toHaveLength(1);
            expect(completedTasks[0].taskNumber).toBe('1.0');
        });

        it('should filter tasks by parent', () => {
            const parent = taskService.findByNumber('2.0');
            const childTasks = taskService.list({ parentId: parent!.id });

            expect(childTasks).toHaveLength(1);
            expect(childTasks[0].taskNumber).toBe('2.1');
        });

        it('should include completed tasks when requested', () => {
            const allTasks = taskService.list({ includeCompleted: true });
            const withoutCompleted = taskService.list({ includeCompleted: false });

            expect(allTasks).toHaveLength(4);
            expect(withoutCompleted).toHaveLength(3); // Excludes completed task
        });
    });

    describe('Task Statistics', () => {
        beforeEach(() => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending' });
            taskService.create({ number: '4.0', name: 'Task 4', status: 'cancelled' });
        });

        it('should calculate task statistics', () => {
            const stats = taskService.getStats();

            expect(stats.total).toBe(4);
            expect(stats.completed).toBe(1);
            expect(stats.inProgress).toBe(1);
            expect(stats.pending).toBe(1);
            expect(stats.cancelled).toBe(1);
            expect(stats.completionRate).toBe(25); // 1/4 * 100
        });

        it('should handle empty database', () => {
            // Create new database
            const emptyDb = new DatabaseClient(':memory:');
            const migrationManager = new MigrationManager(emptyDb);
            migrationManager.initialize();
            const emptyTaskService = new TaskService(emptyDb);

            const stats = emptyTaskService.getStats();

            expect(stats.total).toBe(0);
            expect(stats.completed).toBe(0);
            expect(stats.inProgress).toBe(0);
            expect(stats.pending).toBe(0);
            expect(stats.cancelled).toBe(0);
            expect(stats.completionRate).toBe(0);

            emptyDb.close();
        });
    });

    describe('Bulk Operations', () => {
        it('should bulk insert valid tasks', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1' },
                { number: '1.1', name: 'Task 1.1', parent: '1.0' },
                { number: '2.0', name: 'Task 2' }
            ];

            const result = taskService.bulkInsert(tasks);

            expect(result.success).toBe(true);
            expect(result.inserted).toHaveLength(3);
            expect(result.summary.successful).toBe(3);
            expect(result.summary.failed).toBe(0);
            expect(result.summary.skipped).toBe(0);
        });

        it('should skip duplicate tasks during bulk insert', () => {
            // Create one task first
            taskService.create({ number: '1.0', name: 'Existing Task' });

            const tasks = [
                { number: '1.0', name: 'Duplicate Task' },
                { number: '2.0', name: 'New Task' }
            ];

            const result = taskService.bulkInsert(tasks);

            expect(result.success).toBe(true);
            expect(result.inserted).toHaveLength(1);
            expect(result.skipped).toHaveLength(1);
            expect(result.summary.successful).toBe(1);
            expect(result.summary.skipped).toBe(1);
        });

        it('should handle validation errors during bulk insert', () => {
            const tasks = [
                { number: 'invalid', name: 'Invalid Task' },
                { number: '1.0', name: 'Valid Task' }
            ];

            const result = taskService.bulkInsert(tasks);

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.summary.failed).toBe(1);
        });

        it('should maintain transaction integrity during bulk insert', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1' },
                { number: '1.0', name: 'Duplicate' }, // This will cause validation to fail for entire batch
                { number: '2.0', name: 'Task 2' }
            ];

            const result = taskService.bulkInsert(tasks);

            // Validation fails for the entire batch due to duplicate number
            expect(result.success).toBe(false);
            expect(result.summary.successful).toBe(0);
            expect(result.summary.failed).toBe(1); // Duplicate error
        });
    });

    describe('Task Completion', () => {
        it('should complete task with dependency checking', () => {
            const task = taskService.create({ number: '1.0', name: 'Test Task' });

            const result = taskService.completeTask('1.0', 'Task completed successfully');

            expect(result.task.status).toBe('completed');
            expect(result.task.completionNotes).toBe('Task completed successfully');
            expect(result.autoCompleted).toHaveLength(0); // No parents to auto-complete
        });

        it('should auto-complete parent when all children are done', () => {
            // Create parent and children
            taskService.create({ number: '1.0', name: 'Parent' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0' });

            // Complete first child
            taskService.completeTask('1.1');
            let parent = taskService.findByNumber('1.0');
            expect(parent?.status).toBe('pending'); // Parent should still be pending

            // Complete second child
            const result = taskService.completeTask('1.2');
            
            expect(result.autoCompleted).toContain('1.0');
            parent = taskService.findByNumber('1.0');
            expect(parent?.status).toBe('completed'); // Parent should now be completed
        });
    });
});