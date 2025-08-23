import { z } from 'zod';

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

export const TaskInputSchema = z.object({
    number: z.string().regex(/^\d+(\.\d+)*$/, 'Task number must follow format like 1.0, 1.1, 1.2.1'),
    name: z.string().min(1, 'Task name is required').max(200, 'Task name too long'),
    description: z.string().optional(),
    parent: z.string().regex(/^\d+(\.\d+)*$/).nullable().optional(),
    status: TaskStatusSchema.optional(),
    priority: z.number().int().min(0).max(10).optional(),
    docs_references: z.array(z.string().url('Invalid URL format')).optional(),
    testing_strategy: z.string().optional(),
    dependencies: z.array(z.string().regex(/^\d+(\.\d+)*$/)).optional(),
    files: z.array(z.string()).optional(),
    notes: z.string().optional(),
    completion_notes: z.string().optional()
});

export const BulkTaskInputSchema = z.object({
    tasks: z.array(TaskInputSchema)
});

export const TodoqConfigSchema = z.object({
    database: z.object({
        path: z.string().min(1, 'Database path is required'),
        autoMigrate: z.boolean(),
        walMode: z.boolean()
    }),
    display: z.object({
        format: z.enum(['tree', 'list', 'table']),
        colors: z.boolean(),
        showCompleted: z.boolean()
    }),
    defaults: z.object({
        status: TaskStatusSchema,
        priority: z.number().int().min(0).max(10)
    })
});

export class TaskValidator {
    private errors: Array<{task: string; field: string; error: string}> = [];

    validateImport(tasks: any[]): ValidationResult {
        this.errors = [];
        const taskNumbers = new Set<string>();
        const validTasks: any[] = [];

        // First pass: validate individual tasks
        for (const task of tasks) {
            const validation = TaskInputSchema.safeParse(task);
            if (!validation.success) {
                validation.error.issues.forEach(issue => {
                    this.errors.push({
                        task: task.number || 'unknown',
                        field: issue.path.join('.'),
                        error: issue.message
                    });
                });
                continue;
            }

            // Check for duplicate task numbers
            if (taskNumbers.has(task.number)) {
                this.errors.push({
                    task: task.number,
                    field: 'number',
                    error: 'Duplicate task number'
                });
                continue;
            }

            taskNumbers.add(task.number);
            validTasks.push(task);
        }

        // Second pass: validate relationships
        this.validateRelationships(validTasks, taskNumbers);

        return {
            valid: this.errors.length === 0,
            errors: this.errors,
            summary: {
                total: tasks.length,
                valid: tasks.length - this.errors.length,
                invalid: this.errors.length
            }
        };
    }

    private validateRelationships(tasks: any[], taskNumbers: Set<string>): void {
        const taskMap = new Map(tasks.map(t => [t.number, t]));

        for (const task of tasks) {
            // Validate parent relationship
            if (task.parent && !taskNumbers.has(task.parent)) {
                this.errors.push({
                    task: task.number,
                    field: 'parent',
                    error: `Parent task ${task.parent} not found in import`
                });
            }

            // Validate hierarchical numbering - allow flexible hierarchies
            if (task.parent) {
                const parentParts = task.parent.split('.');
                const taskParts = task.number.split('.');
                
                // For now, just check that child number has at least as many parts as parent
                // This allows both 1.0 -> 1.0.1 style AND 1.0 -> 1.1 style hierarchies
                if (taskParts.length < parentParts.length) {
                    this.errors.push({
                        task: task.number,
                        field: 'number',
                        error: `Task number ${task.number} cannot have fewer levels than parent ${task.parent}`
                    });
                }
            }

            // Validate dependencies
            if (task.dependencies) {
                for (const dep of task.dependencies) {
                    if (!taskNumbers.has(dep)) {
                        this.errors.push({
                            task: task.number,
                            field: 'dependencies',
                            error: `Dependency ${dep} not found in import`
                        });
                    }
                }
            }
        }

        // Check for circular dependencies
        this.validateNoCycles(taskMap);
    }

    private validateNoCycles(taskMap: Map<string, any>): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (taskNumber: string): boolean => {
            visited.add(taskNumber);
            recursionStack.add(taskNumber);

            const task = taskMap.get(taskNumber);
            if (task?.dependencies) {
                for (const dep of task.dependencies) {
                    if (!visited.has(dep)) {
                        if (hasCycle(dep)) return true;
                    } else if (recursionStack.has(dep)) {
                        this.errors.push({
                            task: taskNumber,
                            field: 'dependencies',
                            error: `Circular dependency detected with ${dep}`
                        });
                        return true;
                    }
                }
            }

            recursionStack.delete(taskNumber);
            return false;
        };

        for (const taskNumber of taskMap.keys()) {
            if (!visited.has(taskNumber)) {
                hasCycle(taskNumber);
            }
        }
    }

    validateSingleTask(task: any): { valid: boolean; errors: string[] } {
        const validation = TaskInputSchema.safeParse(task);
        
        if (validation.success) {
            return { valid: true, errors: [] };
        }

        return {
            valid: false,
            errors: validation.error.issues.map(issue => 
                `${issue.path.join('.')}: ${issue.message}`
            )
        };
    }
}

export interface ValidationResult {
    valid: boolean;
    errors: Array<{task: string; field: string; error: string}>;
    summary: {
        total: number;
        valid: number;
        invalid: number;
    };
}

// Utility functions for validation
export function isValidTaskNumber(taskNumber: string): boolean {
    return /^\d+(\.\d+)+$/.test(taskNumber);
}

export function isValidTaskStatus(status: string): boolean {
    return TaskStatusSchema.safeParse(status).success;
}

export function validateTaskHierarchy(taskNumber: string, parentNumber?: string): boolean {
    if (!parentNumber) {
        // Root task should be like "1.0", "2.0", etc.
        return /^\d+\.0$/.test(taskNumber);
    }
    
    // Allow flexible hierarchies: both 1.0 -> 1.0.1 and 1.0 -> 1.1 styles
    const parentParts = parentNumber.split('.');
    const taskParts = taskNumber.split('.');
    
    // Ensure task number is "greater" than parent
    // For 1.0 -> 1.1: both have 2 parts, first part same, second part should be greater
    // For 1.0 -> 1.0.1: task has more parts
    
    if (taskParts.length === parentParts.length + 1 && taskNumber.startsWith(parentNumber + '.')) {
        // Style 1: 1.0 -> 1.0.1 (extends parent)
        return true;
    } else if (taskParts.length === parentParts.length) {
        // Style 2: 1.0 -> 1.1 (same level, different last number)
        // Check that all parts except last are the same, and last part is different and greater
        const samePrefix = taskParts.slice(0, -1).join('.') === parentParts.slice(0, -1).join('.');
        const lastTaskPart = parseInt(taskParts[taskParts.length - 1]);
        const lastParentPart = parseInt(parentParts[parentParts.length - 1]);
        
        return samePrefix && !isNaN(lastTaskPart) && !isNaN(lastParentPart) && lastTaskPart > lastParentPart;
    }
    
    return false;
}