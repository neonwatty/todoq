import { DatabaseClient } from '../adapters/database/client.js';
import { Task, TodoqError } from './types.js';

export class CompletionService {
    private db: DatabaseClient;

    constructor(db: DatabaseClient) {
        this.db = db;
    }

    // Calculate completion percentage for a parent task
    calculateParentCompletion(parentId: number): number {
        try {
            const stmt = this.db.prepare(`
                SELECT status FROM tasks WHERE parent_id = ?
            `);
            const children = stmt.all(parentId) as Array<{ status: string }>;

            if (children.length === 0) return 0;

            const completed = children.filter(c => c.status === 'completed').length;
            return Math.round((completed / children.length) * 100);
        } catch (error) {
            throw new TodoqError(
                'Failed to calculate parent completion',
                'COMPLETION_CALC_ERROR',
                { parentId, error }
            );
        }
    }

    // Update completion percentages for all parent tasks in the hierarchy
    updateCompletionTree(taskNumber: string): void {
        try {
            const task = this.db.prepare(`
                SELECT id, parent_id FROM tasks WHERE task_number = ?
            `).get(taskNumber) as any;

            if (!task) return;

            this.db.transaction(() => {
                let currentParentId = task.parent_id;
                
                while (currentParentId) {
                    const percentage = this.calculateParentCompletion(currentParentId);
                    
                    // Update parent completion percentage
                    this.db.prepare(`
                        UPDATE tasks SET completion_percentage = ? WHERE id = ?
                    `).run(percentage, currentParentId);

                    // Get next parent up the hierarchy
                    const parent = this.db.prepare(`
                        SELECT parent_id FROM tasks WHERE id = ?
                    `).get(currentParentId) as any;
                    
                    currentParentId = parent?.parent_id;
                }
            });
        } catch (error) {
            throw new TodoqError(
                'Failed to update completion tree',
                'COMPLETION_UPDATE_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Get completion progress for all tasks (for progress view)
    getProgressTree(): TaskProgress[] {
        try {
            const stmt = this.db.prepare(`
                WITH task_completion AS (
                    SELECT 
                        p.id,
                        p.task_number,
                        p.name,
                        p.status,
                        p.parent_id,
                        COUNT(c.id) as total_children,
                        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_children,
                        CASE 
                            WHEN COUNT(c.id) = 0 THEN 
                                CASE WHEN p.status = 'completed' THEN 100 ELSE 0 END
                            ELSE 
                                ROUND(CAST(COUNT(CASE WHEN c.status = 'completed' THEN 1 END) AS FLOAT) / COUNT(c.id) * 100)
                        END as completion_percentage
                    FROM tasks p
                    LEFT JOIN tasks c ON c.parent_id = p.id
                    GROUP BY p.id, p.task_number, p.name, p.status, p.parent_id
                )
                SELECT * FROM task_completion
                ORDER BY task_number
            `);

            const rows = stmt.all() as any[];
            
            return rows.map(row => ({
                taskNumber: row.task_number,
                name: row.name,
                status: row.status,
                parentId: row.parent_id,
                totalChildren: row.total_children,
                completedChildren: row.completed_children,
                completionPercentage: row.completion_percentage,
                level: row.task_number.split('.').length - 1
            }));
        } catch (error) {
            throw new TodoqError(
                'Failed to get progress tree',
                'PROGRESS_TREE_ERROR',
                { error }
            );
        }
    }

    // Display formatted progress tree
    displayProgressTree(): void {
        const progress = this.getProgressTree();
        
        console.log('\nTask Progress Tree:\n');
        
        for (const item of progress) {
            const indent = '  '.repeat(item.level);
            const statusIcon = this.getStatusIcon(item.status);
            const progressText = item.totalChildren > 0 
                ? ` [${item.completionPercentage}%]`
                : item.status === 'completed' ? ' ✓' : '';
            
            console.log(`${indent}${statusIcon} ${item.taskNumber} ${item.name}${progressText}`);
        }
    }

    // Check if task can be completed (all dependencies are complete)
    canCompleteTask(taskNumber: string): { canComplete: boolean; blockers: string[] } {
        try {
            const task = this.db.prepare(`
                SELECT id FROM tasks WHERE task_number = ?
            `).get(taskNumber) as any;

            if (!task) {
                return { canComplete: false, blockers: ['Task not found'] };
            }

            // Check dependencies
            const dependencies = this.db.prepare(`
                SELECT t.task_number, t.name, t.status
                FROM tasks t
                INNER JOIN task_dependencies td ON t.id = td.depends_on_id
                WHERE td.task_id = ? AND t.status != 'completed'
            `).all(task.id) as any[];

            const blockers = dependencies.map(dep => 
                `${dep.task_number}: ${dep.name} (${dep.status})`
            );

            return {
                canComplete: blockers.length === 0,
                blockers
            };
        } catch (error) {
            throw new TodoqError(
                'Failed to check task completion eligibility',
                'COMPLETION_CHECK_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Get tasks blocked by the given task
    getBlockedTasks(taskNumber: string): Task[] {
        try {
            const task = this.db.prepare(`
                SELECT id FROM tasks WHERE task_number = ?
            `).get(taskNumber) as any;

            if (!task) return [];

            const stmt = this.db.prepare(`
                SELECT t.* FROM tasks t
                INNER JOIN task_dependencies td ON t.id = td.task_id
                WHERE td.depends_on_id = ?
                ORDER BY t.task_number
            `);

            const rows = stmt.all(task.id) as any[];
            return rows.map(row => this.mapRowToTask(row));
        } catch (error) {
            throw new TodoqError(
                'Failed to get blocked tasks',
                'BLOCKED_TASKS_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Auto-complete parent tasks when all children are complete
    autoCompleteParents(taskNumber: string): string[] {
        const autoCompleted: string[] = [];

        try {
            const task = this.db.prepare(`
                SELECT id, parent_id FROM tasks WHERE task_number = ?
            `).get(taskNumber) as any;

            if (!task || !task.parent_id) return autoCompleted;

            this.db.transaction(() => {
                let currentParentId = task.parent_id;
                
                while (currentParentId) {
                    // Check if all children of this parent are complete
                    const incompleteChildren = this.db.prepare(`
                        SELECT COUNT(*) as count FROM tasks 
                        WHERE parent_id = ? AND status != 'completed'
                    `).get(currentParentId) as any;

                    if (incompleteChildren.count === 0) {
                        // All children complete, mark parent as complete
                        this.db.prepare(`
                            UPDATE tasks SET status = 'completed', completion_percentage = 100 
                            WHERE id = ?
                        `).run(currentParentId);

                        const parentTask = this.db.prepare(`
                            SELECT task_number FROM tasks WHERE id = ?
                        `).get(currentParentId) as any;

                        if (parentTask) {
                            autoCompleted.push(parentTask.task_number);
                        }

                        // Move to next parent
                        const grandparent = this.db.prepare(`
                            SELECT parent_id FROM tasks WHERE id = ?
                        `).get(currentParentId) as any;
                        
                        currentParentId = grandparent?.parent_id;
                    } else {
                        break; // Parent has incomplete children
                    }
                }
            });
        } catch (error) {
            throw new TodoqError(
                'Failed to auto-complete parent tasks',
                'AUTO_COMPLETE_ERROR',
                { taskNumber, error }
            );
        }

        return autoCompleted;
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'completed': return '✓';
            case 'in_progress': return '→';
            case 'cancelled': return '✗';
            default: return '○';
        }
    }

    private mapRowToTask(row: any): Task {
        return {
            id: row.id,
            parentId: row.parent_id || undefined,
            taskNumber: row.task_number,
            name: row.name,
            description: row.description || undefined,
            docsReferences: row.docs_references ? JSON.parse(row.docs_references) : undefined,
            testingStrategy: row.testing_strategy || undefined,
            status: row.status,
            priority: row.priority,
            files: row.files ? JSON.parse(row.files) : undefined,
            notes: row.notes || undefined,
            completionNotes: row.completion_notes || undefined,
            completionPercentage: row.completion_percentage || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}

export interface TaskProgress {
    taskNumber: string;
    name: string;
    status: string;
    parentId?: number;
    totalChildren: number;
    completedChildren: number;
    completionPercentage: number;
    level: number;
}