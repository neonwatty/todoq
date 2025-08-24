import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseClient } from '../../../src/adapters/database/client.js';
import { MigrationManager } from '../../../src/adapters/database/migrations.js';
import { TaskService } from '../../../src/core/task.js';
import { CompletionService } from '../../../src/core/completion.js';

describe('CompletionService', () => {
    let db: DatabaseClient;
    let taskService: TaskService;
    let completionService: CompletionService;
    let consoleLogSpy: any;

    beforeEach(() => {
        db = new DatabaseClient(':memory:');
        const migrationManager = new MigrationManager(db);
        migrationManager.initialize();
        
        taskService = new TaskService(db);
        completionService = new CompletionService(db);

        // Mock console.log to avoid output during tests
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        if (db && db.isOpen) {
            db.close();
        }
        vi.restoreAllMocks();
    });

    describe('calculateParentCompletion', () => {
        it('should calculate 0% for parent with no completed children', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'pending' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            expect(percentage).toBe(0);
        });

        it('should calculate 50% for parent with half children completed', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'pending' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            expect(percentage).toBe(50);
        });

        it('should calculate 100% for parent with all children completed', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'completed' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            expect(percentage).toBe(100);
        });

        it('should return 0% for parent with no children', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            expect(percentage).toBe(0);
        });

        it('should handle mix of completed and cancelled children', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'cancelled' });
            taskService.create({ number: '1.3', name: 'Child 3', parent: '1.0', status: 'pending' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            // Should be 33% (1 completed out of 3 children)
            expect(percentage).toBe(33);
        });

        it('should handle in_progress tasks as not completed', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'in_progress' });

            const parent = taskService.findByNumber('1.0')!;
            const percentage = completionService.calculateParentCompletion(parent.id);

            expect(percentage).toBe(50);
        });
    });

    describe('updateCompletionTree', () => {
        it('should update completion percentages in hierarchy', () => {
            taskService.create({ number: '1.0', name: 'Root Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Parent 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Child 1.1', parent: '1.1', status: 'completed' });
            taskService.create({ number: '1.1.2', name: 'Child 1.2', parent: '1.1', status: 'completed' });

            completionService.updateCompletionTree('1.1.2');

            // Check that parent completion was updated
            const parent = taskService.findByNumber('1.1')!;
            expect(parent.completionPercentage).toBe(100);
        });

        it('should cascade updates up multiple levels', () => {
            taskService.create({ number: '1.0', name: 'Root Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Parent 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Child 1', parent: '1.1', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Parent 2', parent: '1.0', status: 'completed' });

            completionService.updateCompletionTree('1.1.1');

            // Both level 1.1 and 1.0 should be updated
            const level1 = taskService.findByNumber('1.1')!;
            const root = taskService.findByNumber('1.0')!;
            
            expect(level1.completionPercentage).toBe(100);
            expect(root.completionPercentage).toBe(50); // 1 of 2 children complete
        });

        it('should handle leaf tasks gracefully', () => {
            taskService.create({ number: '1.0', name: 'Leaf Task', status: 'pending' });

            expect(() => {
                completionService.updateCompletionTree('1.0');
            }).not.toThrow();
        });
    });

    describe('canCompleteTask', () => {
        it('should return true when no dependencies block completion', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending', dependencies: ['1.0'] });

            const result = completionService.canCompleteTask('2.0');

            expect(result.canComplete).toBe(true);
            expect(result.blockers).toHaveLength(0);
        });

        it('should return false when dependencies are incomplete', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending', dependencies: ['1.0'] });

            const result = completionService.canCompleteTask('2.0');

            expect(result.canComplete).toBe(false);
            expect(result.blockers).toHaveLength(1);
            expect(result.blockers[0]).toContain('1.0');
            expect(result.blockers[0]).toContain('pending');
        });

        it('should return false for non-existent task', () => {
            const result = completionService.canCompleteTask('99.99');

            expect(result.canComplete).toBe(false);
            expect(result.blockers).toContain('Task not found');
        });

        it('should handle multiple dependencies', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'pending', dependencies: ['1.0', '2.0'] });

            const result = completionService.canCompleteTask('3.0');

            expect(result.canComplete).toBe(false);
            expect(result.blockers).toHaveLength(1);
            expect(result.blockers[0]).toContain('2.0');
        });
    });

    describe('getBlockedTasks', () => {
        it('should return tasks blocked by the given task', () => {
            taskService.create({ number: '1.0', name: 'Blocker Task', status: 'pending' });
            taskService.create({ number: '2.0', name: 'Blocked Task 1', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '3.0', name: 'Blocked Task 2', status: 'pending', dependencies: ['1.0'] });
            taskService.create({ number: '4.0', name: 'Independent Task', status: 'pending' });

            const blockedTasks = completionService.getBlockedTasks('1.0');

            expect(blockedTasks).toHaveLength(2);
            const blockedNumbers = blockedTasks.map(t => t.taskNumber);
            expect(blockedNumbers).toContain('2.0');
            expect(blockedNumbers).toContain('3.0');
            expect(blockedNumbers).not.toContain('4.0');
        });

        it('should return empty array for non-existent task', () => {
            const blockedTasks = completionService.getBlockedTasks('99.99');

            expect(blockedTasks).toHaveLength(0);
        });

        it('should return empty array when no tasks are blocked', () => {
            taskService.create({ number: '1.0', name: 'Independent Task', status: 'pending' });

            const blockedTasks = completionService.getBlockedTasks('1.0');

            expect(blockedTasks).toHaveLength(0);
        });
    });

    describe('autoCompleteParents', () => {
        it('should auto-complete parent when all children are done', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'completed' });

            const autoCompleted = completionService.autoCompleteParents('1.2');

            expect(autoCompleted).toContain('1.0');

            // Verify parent is now completed
            const parent = taskService.findByNumber('1.0')!;
            expect(parent.status).toBe('completed');
            expect(parent.completionPercentage).toBe(100);
        });

        it('should cascade auto-completion up multiple levels', () => {
            taskService.create({ number: '1.0', name: 'Root Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Parent 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Child 1', parent: '1.1', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Parent 2', parent: '1.0', status: 'completed' });

            const autoCompleted = completionService.autoCompleteParents('1.1.1');

            expect(autoCompleted).toContain('1.1');
            expect(autoCompleted).toContain('1.0');

            // Verify all are completed
            expect(taskService.findByNumber('1.1')!.status).toBe('completed');
            expect(taskService.findByNumber('1.0')!.status).toBe('completed');
        });

        it('should not auto-complete when some children are incomplete', () => {
            taskService.create({ number: '1.0', name: 'Parent Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child 1', parent: '1.0', status: 'completed' });
            taskService.create({ number: '1.2', name: 'Child 2', parent: '1.0', status: 'pending' });

            const autoCompleted = completionService.autoCompleteParents('1.1');

            expect(autoCompleted).toHaveLength(0);

            // Verify parent is still pending
            const parent = taskService.findByNumber('1.0')!;
            expect(parent.status).toBe('pending');
        });

        it('should return empty array for leaf tasks', () => {
            taskService.create({ number: '1.0', name: 'Leaf Task', status: 'completed' });

            const autoCompleted = completionService.autoCompleteParents('1.0');

            expect(autoCompleted).toHaveLength(0);
        });

        it('should return empty array for non-existent task', () => {
            const autoCompleted = completionService.autoCompleteParents('99.99');

            expect(autoCompleted).toHaveLength(0);
        });
    });

    describe('getProgressTree', () => {
        it('should build progress tree with percentages', () => {
            taskService.create({ number: '1.0', name: 'Root Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Parent 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Child 1.1', parent: '1.1', status: 'completed' });
            taskService.create({ number: '1.1.2', name: 'Child 1.2', parent: '1.1', status: 'pending' });
            taskService.create({ number: '1.2', name: 'Parent 2', parent: '1.0', status: 'completed' });

            const tree = completionService.getProgressTree();

            expect(tree).toHaveLength(5); // All tasks in tree
            
            const root = tree.find(t => t.taskNumber === '1.0')!;
            expect(root).toBeDefined();
            expect(root.completionPercentage).toBe(50); // 1 of 2 children complete

            const parent1 = tree.find(t => t.taskNumber === '1.1')!;
            expect(parent1).toBeDefined();
            expect(parent1.completionPercentage).toBe(50); // 1 of 2 children complete

            const parent2 = tree.find(t => t.taskNumber === '1.2')!;
            expect(parent2).toBeDefined();
            expect(parent2.completionPercentage).toBe(100); // Leaf task, completed
        });

        it('should handle flat task structure', () => {
            taskService.create({ number: '1.0', name: 'Task 1', status: 'completed' });
            taskService.create({ number: '2.0', name: 'Task 2', status: 'pending' });
            taskService.create({ number: '3.0', name: 'Task 3', status: 'in_progress' });

            const tree = completionService.getProgressTree();

            expect(tree).toHaveLength(3);
            expect(tree[0].completionPercentage).toBe(100); // Completed
            expect(tree[1].completionPercentage).toBe(0);   // Pending
            expect(tree[2].completionPercentage).toBe(0);   // In Progress
        });

        it('should return empty array for no tasks', () => {
            const tree = completionService.getProgressTree();

            expect(tree).toHaveLength(0);
        });

        it('should calculate correct hierarchy levels', () => {
            taskService.create({ number: '1.0', name: 'Root', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Level 1', parent: '1.0', status: 'pending' });
            taskService.create({ number: '1.1.1', name: 'Level 2', parent: '1.1', status: 'pending' });

            const tree = completionService.getProgressTree();

            const root = tree.find(t => t.taskNumber === '1.0')!;
            const level1 = tree.find(t => t.taskNumber === '1.1')!;
            const level2 = tree.find(t => t.taskNumber === '1.1.1')!;

            expect(root.level).toBe(1);  // 1.0 is root level (parts - 1 = 1)
            expect(level1.level).toBe(1); // 1.1 is also level 1 by numbering (but child by parent relationship)
            expect(level2.level).toBe(2); // 1.1.1 is level 2
        });
    });

    describe('displayProgressTree', () => {
        it('should display progress tree without errors', () => {
            taskService.create({ number: '1.0', name: 'Root Task', status: 'pending' });
            taskService.create({ number: '1.1', name: 'Child Task', parent: '1.0', status: 'completed' });

            expect(() => {
                completionService.displayProgressTree();
            }).not.toThrow();

            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should handle empty task list', () => {
            expect(() => {
                completionService.displayProgressTree();
            }).not.toThrow();
        });
    });
});