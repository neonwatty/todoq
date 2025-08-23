import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../../src/adapters/database/client.js';
import { MigrationManager } from '../../src/adapters/database/migrations.js';
import { TaskService } from '../../src/core/task.js';
import { existsSync, unlinkSync } from 'fs';

describe('TodoQ Basic Tests', () => {
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

    describe('Database', () => {
        it('should initialize database successfully', () => {
            expect(db.isOpen).toBe(true);
        });

        it('should create tables', () => {
            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `).all() as Array<{ name: string }>;
            
            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('tasks');
            expect(tableNames).toContain('task_dependencies');
            expect(tableNames).toContain('config');
        });
    });

    describe('Task CRUD', () => {
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
            expect(task.id).toBeDefined();
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
        });

        it('should update a task', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task'
            };

            taskService.create(taskInput);
            const updated = taskService.update('1.0', { 
                name: 'Updated Task',
                status: 'in_progress'
            });

            expect(updated.name).toBe('Updated Task');
            expect(updated.status).toBe('in_progress');
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

        it('should list tasks', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1' },
                { number: '2.0', name: 'Task 2' },
                { number: '3.0', name: 'Task 3' }
            ];

            tasks.forEach(task => taskService.create(task));
            const list = taskService.list();

            expect(list).toHaveLength(3);
            expect(list.map(t => t.taskNumber)).toEqual(['1.0', '2.0', '3.0']);
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

        it('should reject invalid parent', () => {
            const child = { number: '1.1', name: 'Child Task', parent: '1.0' };

            expect(() => taskService.create(child)).toThrow();
        });
    });

    describe('Task Stats', () => {
        it('should calculate statistics', () => {
            const tasks = [
                { number: '1.0', name: 'Task 1', status: 'completed' as const },
                { number: '2.0', name: 'Task 2', status: 'in_progress' as const },
                { number: '3.0', name: 'Task 3', status: 'pending' as const }
            ];

            tasks.forEach(task => taskService.create(task));
            const stats = taskService.getStats();

            expect(stats.total).toBe(3);
            expect(stats.completed).toBe(1);
            expect(stats.inProgress).toBe(1);
            expect(stats.pending).toBe(1);
            expect(stats.completionRate).toBe(33); // 1/3 * 100, rounded
        });
    });
});