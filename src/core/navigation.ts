import { DatabaseClient } from '../adapters/database/client.js';
import { Task, TaskStatus, TodoqError } from './types.js';
import { TaskService } from './task.js';

export class NavigationService {
    private db: DatabaseClient;
    private taskService: TaskService;

    constructor(db: DatabaseClient) {
        this.db = db;
        this.taskService = new TaskService(db);
    }

    // Get current task (first incomplete task)
    getCurrentTask(): Task | null {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM tasks 
                WHERE status IN ('pending', 'in_progress')
                ORDER BY task_number
                LIMIT 1
            `);

            const row = stmt.get() as any;
            return row ? this.mapRowToTask(row) : null;
        } catch (error) {
            throw new TodoqError(
                'Failed to get current task',
                'NAVIGATION_ERROR',
                { error }
            );
        }
    }

    // Get next incomplete task after given task number
    getNextTask(currentTaskNumber?: string): Task | null {
        try {
            if (!currentTaskNumber) {
                return this.getCurrentTask();
            }

            const stmt = this.db.prepare(`
                SELECT * FROM tasks 
                WHERE status IN ('pending', 'in_progress')
                AND task_number > ?
                ORDER BY task_number
                LIMIT 1
            `);

            const row = stmt.get(currentTaskNumber) as any;
            return row ? this.mapRowToTask(row) : null;
        } catch (error) {
            throw new TodoqError(
                'Failed to get next task',
                'NAVIGATION_ERROR',
                { currentTaskNumber, error }
            );
        }
    }

    // Get previous incomplete task before given task number
    getPreviousTask(currentTaskNumber?: string): Task | null {
        try {
            if (!currentTaskNumber) {
                return null;
            }

            const stmt = this.db.prepare(`
                SELECT * FROM tasks 
                WHERE status IN ('pending', 'in_progress')
                AND task_number < ?
                ORDER BY task_number DESC
                LIMIT 1
            `);

            const row = stmt.get(currentTaskNumber) as any;
            return row ? this.mapRowToTask(row) : null;
        } catch (error) {
            throw new TodoqError(
                'Failed to get previous task',
                'NAVIGATION_ERROR',
                { currentTaskNumber, error }
            );
        }
    }

    // Count remaining incomplete tasks
    getRemainingTaskCount(): number {
        try {
            const stmt = this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM tasks 
                WHERE status IN ('pending', 'in_progress')
            `);

            const result = stmt.get() as any;
            return result.count || 0;
        } catch (error) {
            throw new TodoqError(
                'Failed to count remaining tasks',
                'NAVIGATION_ERROR',
                { error }
            );
        }
    }

    // Get task hierarchy (parent-child relationships)
    getTaskHierarchy(rootTaskNumber?: string): TaskHierarchy[] {
        try {
            let query = `
                WITH RECURSIVE task_tree AS (
                    -- Base case: root tasks or specific root
                    SELECT *, 0 as level, task_number as path
                    FROM tasks 
                    WHERE parent_id IS NULL
            `;

            const values: any[] = [];
            if (rootTaskNumber) {
                query += ' AND task_number = ?';
                values.push(rootTaskNumber);
            }

            query += `
                    UNION ALL
                    -- Recursive case: child tasks
                    SELECT t.*, tt.level + 1, tt.path || '.' || t.task_number
                    FROM tasks t
                    INNER JOIN task_tree tt ON t.parent_id = tt.id
                )
                SELECT * FROM task_tree 
                ORDER BY task_number
            `;

            const stmt = this.db.prepare(query);
            const rows = stmt.all(...values) as any[];

            return this.buildHierarchy(rows);
        } catch (error) {
            throw new TodoqError(
                'Failed to get task hierarchy',
                'NAVIGATION_ERROR',
                { rootTaskNumber, error }
            );
        }
    }

    // Get tasks by status with counts
    getTasksByStatus(): { [key in TaskStatus]: Task[] } {
        try {
            const tasks = this.taskService.list({ includeCompleted: true });
            
            const result: { [key in TaskStatus]: Task[] } = {
                pending: [],
                in_progress: [],
                completed: [],
                cancelled: []
            };

            for (const task of tasks) {
                result[task.status].push(task);
            }

            return result;
        } catch (error) {
            throw new TodoqError(
                'Failed to get tasks by status',
                'NAVIGATION_ERROR',
                { error }
            );
        }
    }

    // Get task progress (completion percentage for parent tasks)
    getTaskProgress(): TaskProgress[] {
        try {
            const stmt = this.db.prepare(`
                WITH task_completion AS (
                    SELECT 
                        p.id,
                        p.task_number,
                        p.name,
                        p.status,
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
                    GROUP BY p.id, p.task_number, p.name, p.status
                )
                SELECT * FROM task_completion
                ORDER BY task_number
            `);

            const rows = stmt.all() as any[];
            
            return rows.map(row => ({
                taskNumber: row.task_number,
                name: row.name,
                status: row.status as TaskStatus,
                totalChildren: row.total_children,
                completedChildren: row.completed_children,
                completionPercentage: row.completion_percentage
            }));
        } catch (error) {
            throw new TodoqError(
                'Failed to get task progress',
                'NAVIGATION_ERROR',
                { error }
            );
        }
    }

    // Find tasks by pattern or name
    searchTasks(query: string): Task[] {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM tasks 
                WHERE task_number LIKE ? 
                OR name LIKE ? 
                OR description LIKE ?
                ORDER BY task_number
            `);

            const searchPattern = `%${query}%`;
            const rows = stmt.all(searchPattern, searchPattern, searchPattern) as any[];

            return rows.map(row => this.mapRowToTask(row));
        } catch (error) {
            throw new TodoqError(
                'Failed to search tasks',
                'NAVIGATION_ERROR',
                { query, error }
            );
        }
    }

    // Get task dependencies
    getTaskDependencies(taskNumber: string): Task[] {
        try {
            const task = this.taskService.findByNumber(taskNumber);
            if (!task) {
                throw new TodoqError(
                    `Task ${taskNumber} not found`,
                    'TASK_NOT_FOUND',
                    { taskNumber }
                );
            }

            const stmt = this.db.prepare(`
                SELECT t.* FROM tasks t
                INNER JOIN task_dependencies td ON t.id = td.depends_on_id
                WHERE td.task_id = ?
                ORDER BY t.task_number
            `);

            const rows = stmt.all(task.id) as any[];
            return rows.map(row => this.mapRowToTask(row));
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                'Failed to get task dependencies',
                'NAVIGATION_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Get tasks that depend on the given task
    getDependentTasks(taskNumber: string): Task[] {
        try {
            const task = this.taskService.findByNumber(taskNumber);
            if (!task) {
                throw new TodoqError(
                    `Task ${taskNumber} not found`,
                    'TASK_NOT_FOUND',
                    { taskNumber }
                );
            }

            const stmt = this.db.prepare(`
                SELECT t.* FROM tasks t
                INNER JOIN task_dependencies td ON t.id = td.task_id
                WHERE td.depends_on_id = ?
                ORDER BY t.task_number
            `);

            const rows = stmt.all(task.id) as any[];
            return rows.map(row => this.mapRowToTask(row));
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                'Failed to get dependent tasks',
                'NAVIGATION_ERROR',
                { taskNumber, error }
            );
        }
    }

    private buildHierarchy(rows: any[]): TaskHierarchy[] {
        const taskMap = new Map<number, TaskHierarchy>();
        const result: TaskHierarchy[] = [];

        // First pass: create all nodes
        for (const row of rows) {
            const hierarchy: TaskHierarchy = {
                task: this.mapRowToTask(row),
                level: row.level,
                children: []
            };
            taskMap.set(row.id, hierarchy);

            if (row.parent_id === null) {
                result.push(hierarchy);
            }
        }

        // Second pass: build parent-child relationships
        for (const row of rows) {
            if (row.parent_id !== null) {
                const parent = taskMap.get(row.parent_id);
                const child = taskMap.get(row.id);
                if (parent && child) {
                    parent.children.push(child);
                }
            }
        }

        return result;
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
            status: row.status as TaskStatus,
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

export interface TaskHierarchy {
    task: Task;
    level: number;
    children: TaskHierarchy[];
}

export interface TaskProgress {
    taskNumber: string;
    name: string;
    status: TaskStatus;
    totalChildren: number;
    completedChildren: number;
    completionPercentage: number;
}