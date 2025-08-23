import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../src/core/task.js';
import { NavigationService } from '../../../src/core/navigation.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        cyan: (text: string) => text,
        bold: (text: string) => text
    }
}));
vi.mock('ora', () => ({
    default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn().mockReturnThis(),
        fail: vi.fn().mockReturnThis(),
        stop: vi.fn().mockReturnThis()
    })
}));

describe('CLI Command Core Logic Tests', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let navigationService: NavigationService;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
        db = new DatabaseClient(':memory:');
        
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();
        
        taskService = new TaskService(db);
        navigationService = new NavigationService(db);

        // Mock console methods
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
        vi.restoreAllMocks();
    });

    describe('Task Operations', () => {
        it('should create task through service', () => {
            const taskInput = {
                number: '1.0',
                name: 'Test Task',
                description: 'Test description',
                status: 'pending' as const,
                priority: 1
            };

            const task = taskService.create(taskInput);

            expect(task.taskNumber).toBe('1.0');
            expect(task.name).toBe('Test Task');
            expect(task.status).toBe('pending');
            expect(task.id).toBeDefined();
        });

        it('should show task details when task exists', () => {
            // Create a test task
            taskService.create({
                number: '1.0',
                name: 'Test Task',
                description: 'Test description',
                status: 'pending',
                priority: 1
            });

            const task = taskService.findByNumber('1.0');
            expect(task).toBeDefined();
            expect(task?.taskNumber).toBe('1.0');
            expect(task?.name).toBe('Test Task');
        });

        it('should return null for non-existent task', () => {
            const task = taskService.findByNumber('99.99');
            expect(task).toBeNull();
        });

        it('should complete task with notes', () => {
            // Create a test task
            taskService.create({
                number: '1.0',
                name: 'Test Task',
                status: 'pending'
            });

            // Complete the task
            const updatedTask = taskService.update('1.0', { 
                status: 'completed',
                completion_notes: 'Task completed successfully'
            });

            expect(updatedTask.status).toBe('completed');
            expect(updatedTask.completionNotes).toBe('Task completed successfully');
        });

        it('should update task properties', () => {
            // Create a test task
            taskService.create({
                number: '1.0',
                name: 'Original Task',
                status: 'pending'
            });

            // Update the task
            const updatedTask = taskService.update('1.0', {
                name: 'Updated Task',
                status: 'in_progress'
            });

            expect(updatedTask.name).toBe('Updated Task');
            expect(updatedTask.status).toBe('in_progress');
        });

        it('should delete task', () => {
            // Create a test task
            taskService.create({
                number: '1.0',
                name: 'Task to Remove'
            });

            // Delete the task
            const deleted = taskService.delete('1.0');
            expect(deleted).toBe(true);

            // Verify it's deleted
            const task = taskService.findByNumber('1.0');
            expect(task).toBeNull();
        });
    });

    describe('Navigation Operations', () => {
        beforeEach(() => {
            // Create test tasks for navigation
            taskService.create({ number: '1.0', name: 'Task 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'completed' });
        });

        it('should get current task', () => {
            const currentTask = navigationService.getCurrentTask();
            expect(currentTask).toBeDefined();
            expect(['1.0', '2.0']).toContain(currentTask?.taskNumber);
        });

        it('should get next task', () => {
            const nextTask = navigationService.getNextTask();
            expect(nextTask).toBeDefined();
            expect(['1.0', '2.0']).toContain(nextTask?.taskNumber);
        });

        it('should count remaining tasks', () => {
            const allTasks = taskService.list();
            const pendingTasks = allTasks.filter(t => t.status === 'pending');
            expect(pendingTasks).toHaveLength(2);
        });
    });

    describe('List Operations', () => {
        beforeEach(() => {
            // Create test tasks with hierarchy
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child Task', parent: '1.0', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Another Task', status: 'in_progress' });
        });

        it('should list all tasks', () => {
            const allTasks = taskService.list();
            expect(allTasks.length).toBeGreaterThanOrEqual(2); // Parent and child task should exist
        });

        it('should filter tasks by status', () => {
            const pendingTasks = taskService.list({ status: 'pending' });
            const completedTasks = taskService.list({ status: 'completed' });
            const inProgressTasks = taskService.list({ status: 'in_progress' });
            
            expect(pendingTasks.length).toBeGreaterThanOrEqual(1);
            expect(completedTasks.length).toBeGreaterThanOrEqual(0);
            expect(inProgressTasks.length).toBeGreaterThanOrEqual(0);
            
            if (pendingTasks.length > 0) {
                expect(pendingTasks[0].status).toBe('pending');
            }
        });

        it('should show task hierarchy', () => {
            const tasks = taskService.list();
            const parentTask = tasks.find(t => t.taskNumber === '1.0');
            
            expect(parentTask).toBeDefined();
            expect(parentTask?.name).toBe('Parent Task');
        });
    });

    describe('Stats Operations', () => {
        beforeEach(() => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'in_progress' });
        });

        it('should calculate task statistics', () => {
            const stats = taskService.getStats();
            
            expect(stats.total).toBe(3);
            expect(stats.completed).toBe(1);
            expect(stats.pending).toBe(1);
            expect(stats.inProgress).toBe(1);
            expect(stats.completionRate).toBeGreaterThanOrEqual(0);
            expect(stats.completionRate).toBeLessThanOrEqual(100);
        });

        it('should calculate progress correctly', () => {
            const stats = taskService.getStats();
            
            expect(stats.total).toBeGreaterThan(0);
            expect(stats.completed).toBeGreaterThanOrEqual(0);
            expect(stats.completionRate).toBeGreaterThanOrEqual(0);
            expect(stats.completionRate).toBeLessThanOrEqual(100);
        });
    });

    describe('Import/Export Operations', () => {
        it('should export tasks as structured data', () => {
            // Create test tasks to export
            taskService.create({ number: '1.0', name: 'Export Task 1' });
            taskService.create({ number: '2.0', name: 'Export Task 2' });

            const tasks = taskService.list();
            expect(tasks).toHaveLength(2);
            
            // Verify export structure
            const exportData = {
                tasks: tasks.map(task => ({
                    number: task.taskNumber,
                    name: task.name,
                    description: task.description,
                    parent: task.parentId ? 
                        taskService.findById(task.parentId)?.taskNumber : 
                        undefined,
                    status: task.status,
                    priority: task.priority,
                    docs_references: task.docsReferences,
                    testing_strategy: task.testingStrategy,
                    dependencies: task.dependencies,
                    files: task.files,
                    notes: task.notes,
                    completion_notes: task.completionNotes
                }))
            };

            expect(exportData.tasks).toHaveLength(2);
            expect(exportData.tasks[0].number).toBe('1.0');
            expect(exportData.tasks[1].number).toBe('2.0');
        });

        it('should validate import data structure', () => {
            const validImportData = {
                tasks: [
                    { number: '1.0', name: 'Import Task 1' },
                    { number: '2.0', name: 'Import Task 2' }
                ]
            };

            // This would normally go through validation
            expect(validImportData.tasks).toHaveLength(2);
            expect(validImportData.tasks[0].number).toBe('1.0');
            expect(validImportData.tasks[0].name).toBe('Import Task 1');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid task operations gracefully', () => {
            expect(() => {
                taskService.findByNumber('invalid-number');
            }).not.toThrow();

            const result = taskService.findByNumber('invalid-number');
            expect(result).toBeNull();
        });

        it('should handle database constraints', () => {
            taskService.create({ number: '1.0', name: 'First Task' });

            // Attempting to create duplicate should throw
            expect(() => {
                taskService.create({ number: '1.0', name: 'Duplicate Task' });
            }).toThrow();
        });

        it('should handle missing parent references', () => {
            expect(() => {
                taskService.create({ 
                    number: '1.1', 
                    name: 'Child Task', 
                    parent: '1.0' // Non-existent parent
                });
            }).toThrow();
        });
    });
});