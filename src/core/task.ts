import { DatabaseClient } from '../adapters/database/client.js';
import { Task, TaskInput, TaskStatus, BulkInsertResult, TaskStats, TodoqError } from './types.js';
import { TaskValidator } from './validation.js';
import { CompletionService } from './completion.js';

export class TaskService {
    private db: DatabaseClient;
    private validator: TaskValidator;
    private completionService: CompletionService;

    constructor(db: DatabaseClient) {
        this.db = db;
        this.validator = new TaskValidator();
        this.completionService = new CompletionService(db);
    }

    // Create a new task
    create(input: TaskInput): Task {
        try {
            // Validate input
            const validation = this.validator.validateSingleTask(input);
            if (!validation.valid) {
                throw new TodoqError(
                    `Invalid task data: ${validation.errors.join(', ')}`,
                    'VALIDATION_ERROR',
                    { input, errors: validation.errors }
                );
            }

            // Check for duplicate task number
            if (this.findByNumber(input.number)) {
                throw new TodoqError(
                    `Task with number ${input.number} already exists`,
                    'DUPLICATE_TASK_ERROR',
                    { taskNumber: input.number }
                );
            }

            // Find parent ID if parent is specified
            let parentId: number | undefined;
            if (input.parent) {
                const parent = this.findByNumber(input.parent);
                if (!parent) {
                    throw new TodoqError(
                        `Parent task ${input.parent} not found`,
                        'PARENT_NOT_FOUND',
                        { parentNumber: input.parent }
                    );
                }
                parentId = parent.id;
            }

            const stmt = this.db.prepare(`
                INSERT INTO tasks (
                    parent_id, task_number, name, description, docs_references,
                    testing_strategy, status, priority, files, notes, completion_notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                parentId || null,
                input.number,
                input.name,
                input.description || null,
                input.docs_references ? JSON.stringify(input.docs_references) : null,
                input.testing_strategy || null,
                input.status || 'pending',
                input.priority || 0,
                input.files ? JSON.stringify(input.files) : null,
                input.notes || null,
                input.completion_notes || null
            );

            const taskId = result.lastInsertRowid as number;

            // Insert dependencies if specified
            if (input.dependencies && input.dependencies.length > 0) {
                const dependencyStmt = this.db.prepare(`
                    INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)
                `);

                for (const depNumber of input.dependencies) {
                    const depTask = this.findByNumber(depNumber);
                    if (!depTask) {
                        throw new TodoqError(
                            `Dependency task ${depNumber} not found`,
                            'DEPENDENCY_NOT_FOUND',
                            { taskNumber: input.number, dependencyNumber: depNumber }
                        );
                    }
                    dependencyStmt.run(taskId, depTask.id);
                }
            }

            const created = this.findById(taskId);
            if (!created) {
                throw new TodoqError('Failed to create task', 'CREATE_ERROR');
            }

            return created;
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'CREATE_ERROR',
                { input, error }
            );
        }
    }

    // Find task by ID
    findById(id: number): Task | null {
        try {
            const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
            const row = stmt.get(id) as any;
            return row ? this.mapRowToTask(row) : null;
        } catch (error) {
            throw new TodoqError(
                'Failed to find task by ID',
                'FIND_ERROR',
                { id, error }
            );
        }
    }

    // Find task by task number
    findByNumber(taskNumber: string): Task | null {
        try {
            const stmt = this.db.prepare('SELECT * FROM tasks WHERE task_number = ?');
            const row = stmt.get(taskNumber) as any;
            return row ? this.mapRowToTask(row) : null;
        } catch (error) {
            throw new TodoqError(
                'Failed to find task by number',
                'FIND_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Update task
    update(taskNumber: string, updates: Partial<TaskInput>): Task {
        try {
            const existing = this.findByNumber(taskNumber);
            if (!existing) {
                throw new TodoqError(
                    `Task ${taskNumber} not found`,
                    'TASK_NOT_FOUND',
                    { taskNumber }
                );
            }

            const fields: string[] = [];
            const values: any[] = [];

            if (updates.name !== undefined) {
                fields.push('name = ?');
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                fields.push('description = ?');
                values.push(updates.description);
            }
            if (updates.status !== undefined) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.priority !== undefined) {
                fields.push('priority = ?');
                values.push(updates.priority);
            }
            if (updates.docs_references !== undefined) {
                fields.push('docs_references = ?');
                values.push(JSON.stringify(updates.docs_references));
            }
            if (updates.testing_strategy !== undefined) {
                fields.push('testing_strategy = ?');
                values.push(updates.testing_strategy);
            }
            if (updates.files !== undefined) {
                fields.push('files = ?');
                values.push(JSON.stringify(updates.files));
            }
            if (updates.notes !== undefined) {
                fields.push('notes = ?');
                values.push(updates.notes);
            }
            if (updates.completion_notes !== undefined) {
                fields.push('completion_notes = ?');
                values.push(updates.completion_notes);
            }

            if (fields.length === 0) {
                return existing;
            }

            values.push(taskNumber);
            const stmt = this.db.prepare(`
                UPDATE tasks SET ${fields.join(', ')} WHERE task_number = ?
            `);

            stmt.run(...values);

            const updated = this.findByNumber(taskNumber);
            if (!updated) {
                throw new TodoqError('Failed to update task', 'UPDATE_ERROR');
            }

            return updated;
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'UPDATE_ERROR',
                { taskNumber, updates, error }
            );
        }
    }

    // Delete task and all its subtasks
    delete(taskNumber: string): boolean {
        try {
            const task = this.findByNumber(taskNumber);
            if (!task) {
                throw new TodoqError(
                    `Task ${taskNumber} not found`,
                    'TASK_NOT_FOUND',
                    { taskNumber }
                );
            }

            return this.db.transaction(() => {
                // Delete task dependencies
                this.db.prepare('DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_id = ?')
                    .run(task.id, task.id);

                // Delete task (CASCADE will handle subtasks)
                const stmt = this.db.prepare('DELETE FROM tasks WHERE task_number = ?');
                const result = stmt.run(taskNumber);
                
                return result.changes > 0;
            });
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'DELETE_ERROR',
                { taskNumber, error }
            );
        }
    }

    // List tasks with optional filtering
    list(options: {
        status?: TaskStatus;
        parentId?: number;
        parentNumber?: string;
        includeCompleted?: boolean;
    } = {}): Task[] {
        try {
            let query = 'SELECT * FROM tasks';
            const conditions: string[] = [];
            const values: any[] = [];

            if (options.status) {
                conditions.push('status = ?');
                values.push(options.status);
            }

            if (options.parentId !== undefined) {
                conditions.push('parent_id = ?');
                values.push(options.parentId);
            }

            if (options.parentNumber) {
                const parent = this.findByNumber(options.parentNumber);
                if (parent) {
                    conditions.push('parent_id = ?');
                    values.push(parent.id);
                }
            }

            if (!options.includeCompleted && options.status !== 'completed') {
                conditions.push("status != 'completed'");
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY task_number';

            const stmt = this.db.prepare(query);
            const rows = stmt.all(...values) as any[];

            return rows.map(row => this.mapRowToTask(row));
        } catch (error) {
            throw new TodoqError(
                'Failed to list tasks',
                'LIST_ERROR',
                { options, error }
            );
        }
    }

    // Get task statistics
    getStats(): TaskStats {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
                FROM tasks
            `);

            const result = stmt.get() as any;
            const total = result.total || 0;
            const completed = result.completed || 0;

            return {
                total,
                pending: result.pending || 0,
                inProgress: result.inProgress || 0,
                completed,
                cancelled: result.cancelled || 0,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
            };
        } catch (error) {
            throw new TodoqError(
                'Failed to get task statistics',
                'STATS_ERROR',
                { error }
            );
        }
    }

    // Bulk insert tasks
    bulkInsert(tasks: TaskInput[]): BulkInsertResult {
        const result: BulkInsertResult = {
            success: false,
            inserted: [],
            skipped: [],
            errors: [],
            summary: { total: tasks.length, successful: 0, skipped: 0, failed: 0 }
        };

        try {
            // Validate all tasks first
            const validation = this.validator.validateImport(tasks);
            if (!validation.valid) {
                // Convert validation errors to result format
                for (const error of validation.errors) {
                    const task = tasks.find(t => t.number === error.task);
                    if (task) {
                        result.errors.push({
                            task,
                            error: `${error.field}: ${error.error}`
                        });
                        result.summary.failed++;
                    }
                }
                return result;
            }

            return this.db.transaction(() => {
                // Sort tasks by dependency order
                const sortedTasks = this.topologicalSort(tasks);

                for (const task of sortedTasks) {
                    try {
                        // Check if task already exists
                        const existing = this.findByNumber(task.number);
                        if (existing) {
                            result.skipped.push({ task, reason: 'Already exists' });
                            result.summary.skipped++;
                            continue;
                        }

                        // Insert task
                        const inserted = this.create(task);
                        result.inserted.push(inserted);
                        result.summary.successful++;
                    } catch (error) {
                        result.errors.push({ 
                            task, 
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                        result.summary.failed++;
                    }
                }

                result.success = result.summary.failed === 0;
                return result;
            });
        } catch (error) {
            throw new TodoqError(
                'Bulk insert failed',
                'BULK_INSERT_ERROR',
                { error }
            );
        }
    }

    // Sort tasks in dependency order (topological sort)
    private topologicalSort(tasks: TaskInput[]): TaskInput[] {
        const taskMap = new Map(tasks.map(t => [t.number, t]));
        const visited = new Set<string>();
        const result: TaskInput[] = [];

        const visit = (taskNumber: string): void => {
            if (visited.has(taskNumber)) return;
            
            const task = taskMap.get(taskNumber);
            if (!task) return;

            // Visit parent first
            if (task.parent && taskMap.has(task.parent)) {
                visit(task.parent);
            }

            // Visit dependencies first
            if (task.dependencies) {
                for (const dep of task.dependencies) {
                    if (taskMap.has(dep)) {
                        visit(dep);
                    }
                }
            }

            visited.add(taskNumber);
            result.push(task);
        };

        for (const task of tasks) {
            visit(task.number);
        }

        return result;
    }

    // Complete task with dependency checking and parent updates
    completeTask(taskNumber: string, completionNotes?: string): { task: Task; autoCompleted: string[] } {
        try {
            // Check if task can be completed
            const eligibility = this.completionService.canCompleteTask(taskNumber);
            if (!eligibility.canComplete) {
                throw new TodoqError(
                    `Cannot complete task ${taskNumber}. Blocked by: ${eligibility.blockers.join(', ')}`,
                    'TASK_BLOCKED',
                    { taskNumber, blockers: eligibility.blockers }
                );
            }

            // Update task status
            const updates: any = { status: 'completed' };
            if (completionNotes) {
                updates.completion_notes = completionNotes;
            }

            const task = this.update(taskNumber, updates);

            // Update completion tree and auto-complete parents
            const autoCompleted = this.db.transaction(() => {
                this.completionService.updateCompletionTree(taskNumber);
                return this.completionService.autoCompleteParents(taskNumber);
            });

            return { task, autoCompleted };
        } catch (error) {
            if (error instanceof TodoqError) {
                throw error;
            }
            throw new TodoqError(
                `Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'COMPLETE_TASK_ERROR',
                { taskNumber, error }
            );
        }
    }

    // Get completion service for advanced operations
    getCompletionService(): CompletionService {
        return this.completionService;
    }

    // Map database row to Task object
    private mapRowToTask(row: any): Task {
        // Get dependencies for this task
        const dependencies = this.getTaskDependencyNumbers(row.id);

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
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            files: row.files ? JSON.parse(row.files) : undefined,
            notes: row.notes || undefined,
            completionNotes: row.completion_notes || undefined,
            completionPercentage: row.completion_percentage || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }

    // Helper method to get dependency task numbers for a given task ID
    private getTaskDependencyNumbers(taskId: number): string[] {
        try {
            const stmt = this.db.prepare(`
                SELECT t.task_number
                FROM tasks t
                INNER JOIN task_dependencies td ON t.id = td.depends_on_id
                WHERE td.task_id = ?
                ORDER BY t.task_number
            `);
            
            const rows = stmt.all(taskId) as Array<{ task_number: string }>;
            return rows.map(row => row.task_number);
        } catch (error) {
            // Return empty array if there's an error fetching dependencies
            return [];
        }
    }
}