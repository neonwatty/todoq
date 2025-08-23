import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../src/core/task.js';
import { NavigationService } from '../../../src/core/navigation.js';

describe('NavigationService', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let navigationService: NavigationService;

    beforeEach(() => {
        db = new DatabaseClient(':memory:');
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();
        
        taskService = new TaskService(db);
        navigationService = new NavigationService(db);
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
    });

    describe('getCurrentTask', () => {
        it('should return first pending task when no tasks completed', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Third Task', status: 'pending' });

            const current = navigationService.getCurrentTask();
            
            expect(current).toBeDefined();
            expect(current?.taskNumber).toBe('1.0');
            expect(current?.name).toBe('First Task');
        });

        it('should return first available pending task after some completed', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Third Task', status: 'pending' });

            const current = navigationService.getCurrentTask();
            
            expect(current).toBeDefined();
            expect(current?.taskNumber).toBe('2.0');
            expect(current?.name).toBe('Second Task');
        });

        it('should return first in_progress task', () => {
            taskService.create({ number: '1.0', name: 'Pending Task', status: 'pending' });
            taskService.create({ number: '0.5', name: 'In Progress Task', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Another Pending', status: 'pending' });

            const current = navigationService.getCurrentTask();
            
            expect(current).toBeDefined();
            expect(current?.taskNumber).toBe('0.5'); // First in task_number order
            expect(current?.name).toBe('In Progress Task');
        });

        it('should return null when all tasks are completed', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'completed' });

            const current = navigationService.getCurrentTask();
            
            expect(current).toBeNull();
        });

        it('should return null when no tasks exist', () => {
            const current = navigationService.getCurrentTask();
            
            expect(current).toBeNull();
        });
    });

    describe('getNextTask', () => {
        it('should return next pending task in sequence', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Third Task', status: 'pending' });

            const next = navigationService.getNextTask('1.0');
            
            expect(next).toBeDefined();
            expect(next?.taskNumber).toBe('2.0');
        });

        it('should skip completed tasks', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'completed' });
            taskService.create({ number: '3.0', name: 'Third Task', status: 'pending' });

            const next = navigationService.getNextTask('1.0');
            
            expect(next).toBeDefined();
            expect(next?.taskNumber).toBe('3.0');
        });

        it('should return null when no next task available', () => {
            taskService.create({ number: '1.0', name: 'Only Task', status: 'completed' });

            const next = navigationService.getNextTask('1.0');
            
            expect(next).toBeNull();
        });

        it('should return current task when no parameter given', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });

            const next = navigationService.getNextTask();
            
            expect(next).toBeDefined();
            expect(next?.taskNumber).toBe('1.0');
        });
    });

    describe('getPreviousTask', () => {
        it('should return previous task in sequence', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Third Task', status: 'pending' });

            const prev = navigationService.getPreviousTask('2.0');
            
            expect(prev).toBeDefined();
            expect(prev?.taskNumber).toBe('1.0');
        });

        it('should return null when no previous task exists', () => {
            taskService.create({ number: '1.0', name: 'First Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Second Task', status: 'pending' });

            const prev = navigationService.getPreviousTask('1.0');
            
            expect(prev).toBeNull();
        });

        it('should return null when no parameter given', () => {
            const prev = navigationService.getPreviousTask();
            
            expect(prev).toBeNull();
        });
    });

    describe('getRemainingTaskCount', () => {
        it('should count remaining incomplete tasks', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'in_progress' });
            taskService.create({ number: '4.0', name: 'Task 4', status: 'cancelled' });

            const remaining = navigationService.getRemainingTaskCount();
            
            expect(remaining).toBe(2); // pending + in_progress
        });

        it('should return 0 when all tasks are completed', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'completed' });

            const remaining = navigationService.getRemainingTaskCount();
            
            expect(remaining).toBe(0);
        });

        it('should return 0 when no tasks exist', () => {
            const remaining = navigationService.getRemainingTaskCount();
            
            expect(remaining).toBe(0);
        });
    });

    describe('getTasksByStatus', () => {
        beforeEach(() => {
            taskService.create({ number: '1.0', name: 'Pending Task 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'In Progress Task', status: 'in_progress' });
            taskService.create({ number: '3.0', name: 'Completed Task', status: 'completed' });
            taskService.create({ number: '4.0', name: 'Pending Task 2', status: 'pending' });
            taskService.create({ number: '5.0', name: 'Cancelled Task', status: 'cancelled' });
        });

        it('should group tasks by status', () => {
            const tasksByStatus = navigationService.getTasksByStatus();
            
            expect(tasksByStatus.pending).toHaveLength(2);
            expect(tasksByStatus.in_progress).toHaveLength(1);
            expect(tasksByStatus.completed).toHaveLength(1);
            expect(tasksByStatus.cancelled).toHaveLength(1);
        });

        it('should return correct task objects in each group', () => {
            const tasksByStatus = navigationService.getTasksByStatus();
            
            expect(tasksByStatus.pending.map(t => t.taskNumber)).toEqual(['1.0', '4.0']);
            expect(tasksByStatus.in_progress[0].taskNumber).toBe('2.0');
            expect(tasksByStatus.completed[0].taskNumber).toBe('3.0');
            expect(tasksByStatus.cancelled[0].taskNumber).toBe('5.0');
        });
    });

    describe('getTaskHierarchy', () => {
        it('should return hierarchical structure', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child Task 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.2', name: 'Child Task 2', parent: '1.0', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Another Parent', status: 'pending' });

            const hierarchy = navigationService.getTaskHierarchy();
            
            expect(hierarchy).toHaveLength(2); // Two root tasks
            expect(hierarchy[0].task.taskNumber).toBe('1.0');
            expect(hierarchy[0].children).toHaveLength(2);
            expect(hierarchy[1].task.taskNumber).toBe('2.0');
            expect(hierarchy[1].children).toHaveLength(0);
        });

        it('should return specific hierarchy when root specified', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child Task 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Another Parent', status: 'pending' });

            const hierarchy = navigationService.getTaskHierarchy('1.0');
            
            expect(hierarchy).toHaveLength(1);
            expect(hierarchy[0].task.taskNumber).toBe('1.0');
            expect(hierarchy[0].children).toHaveLength(1);
        });

        it('should handle deep hierarchies correctly', () => {
            taskService.create({ number: '1.0', name: 'Root', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Level 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Level 2', parent: '1.1', status: 'pending' });

            const hierarchy = navigationService.getTaskHierarchy();
            
            expect(hierarchy[0].level).toBe(0); // Root level
            expect(hierarchy[0].children[0].level).toBe(1); // First child level
            expect(hierarchy[0].children[0].children[0].level).toBe(2); // Second child level
        });

        it('should return empty array when no tasks exist', () => {
            const hierarchy = navigationService.getTaskHierarchy();
            
            expect(hierarchy).toHaveLength(0);
        });
    });

    describe('getTaskProgress', () => {
        it('should calculate progress for all tasks', () => {
            taskService.create({ number: '1.0', name: 'Parent', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Standalone', status: 'completed' });

            const progress = navigationService.getTaskProgress();
            
            expect(progress).toHaveLength(4);
            
            const parent = progress.find(p => p.taskNumber === '1.0')!;
            expect(parent.totalChildren).toBe(2);
            expect(parent.completedChildren).toBe(1);
            expect(parent.completionPercentage).toBe(50);

            const standalone = progress.find(p => p.taskNumber === '2.0')!;
            expect(standalone.totalChildren).toBe(0);
            expect(standalone.completionPercentage).toBe(100); // Completed leaf task
        });

        it('should handle tasks with no children', () => {
            taskService.create({ number: '1.0', name: 'Leaf Task', status: 'pending' });

            const progress = navigationService.getTaskProgress();
            
            expect(progress).toHaveLength(1);
            expect(progress[0].totalChildren).toBe(0);
            expect(progress[0].completionPercentage).toBe(0);
        });

        it('should return empty array when no tasks exist', () => {
            const progress = navigationService.getTaskProgress();
            
            expect(progress).toHaveLength(0);
        });
    });

    describe('searchTasks', () => {
        beforeEach(() => {
            taskService.create({ number: '1.0', name: 'Fix authentication bug', description: 'Fix login issue' });
            taskService.create({ number: '2.0', name: 'Add new feature', description: 'Implement user profile' });
            taskService.create({ number: '3.0', name: 'Update documentation', description: 'Fix auth docs' });
        });

        it('should find tasks by name', () => {
            const results = navigationService.searchTasks('authentication');
            
            expect(results).toHaveLength(1);
            expect(results[0].taskNumber).toBe('1.0');
        });

        it('should find tasks by description', () => {
            const results = navigationService.searchTasks('profile');
            
            expect(results).toHaveLength(1);
            expect(results[0].taskNumber).toBe('2.0');
        });

        it('should find tasks by task number', () => {
            const results = navigationService.searchTasks('3.0');
            
            expect(results).toHaveLength(1);
            expect(results[0].taskNumber).toBe('3.0');
        });

        it('should return multiple matches', () => {
            const results = navigationService.searchTasks('auth');
            
            expect(results).toHaveLength(2); // Matches name and description
        });

        it('should return empty array when no matches found', () => {
            const results = navigationService.searchTasks('nonexistent');
            
            expect(results).toHaveLength(0);
        });
    });

    describe('getTaskDependencies', () => {
        it('should return dependencies for a task', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending', dependencies: ['1.0', '2.0'] });

            const dependencies = navigationService.getTaskDependencies('3.0');
            
            expect(dependencies).toHaveLength(2);
            const depNumbers = dependencies.map(d => d.taskNumber);
            expect(depNumbers).toContain('1.0');
            expect(depNumbers).toContain('2.0');
        });

        it('should return empty array when task has no dependencies', () => {
            taskService.create({ number: '1.0', name: 'Independent Task', status: 'pending' });

            const dependencies = navigationService.getTaskDependencies('1.0');
            
            expect(dependencies).toHaveLength(0);
        });

        it('should throw error for non-existent task', () => {
            expect(() => {
                navigationService.getTaskDependencies('99.99');
            }).toThrow();
        });
    });

    describe('getDependentTasks', () => {
        it('should return tasks that depend on given task', () => {
            taskService.create({ number: '1.0', name: 'Blocker Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Dependent Task 1', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Dependent Task 2', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '4.0', name: 'Independent Task', status: 'pending' });

            const dependents = navigationService.getDependentTasks('1.0');
            
            expect(dependents).toHaveLength(2);
            const depNumbers = dependents.map(d => d.taskNumber);
            expect(depNumbers).toContain('2.0');
            expect(depNumbers).toContain('3.0');
            expect(depNumbers).not.toContain('4.0');
        });

        it('should return empty array when no tasks depend on given task', () => {
            taskService.create({ number: '1.0', name: 'Independent Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Another Independent Task', status: 'pending' });

            const dependents = navigationService.getDependentTasks('1.0');
            
            expect(dependents).toHaveLength(0);
        });

        it('should throw error for non-existent task', () => {
            expect(() => {
                navigationService.getDependentTasks('99.99');
            }).toThrow();
        });
    });
});