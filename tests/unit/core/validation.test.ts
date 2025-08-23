import { describe, it, expect } from 'vitest';
import { TaskValidator, TaskInputSchema, isValidTaskNumber, isValidTaskStatus, validateTaskHierarchy } from '../../../src/core/validation.js';

describe('TaskValidator', () => {
    let validator: TaskValidator;

    beforeEach(() => {
        validator = new TaskValidator();
    });

    describe('validateSingleTask', () => {
        it('should validate a valid task', () => {
            const task = {
                number: '1.0',
                name: 'Test Task',
                description: 'A test task',
                status: 'pending' as const,
                priority: 1
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid task number format', () => {
            const task = {
                number: 'invalid',
                name: 'Test Task'
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('number: Task number must follow format like 1.0, 1.1, 1.2.1');
        });

        it('should reject empty task name', () => {
            const task = {
                number: '1.0',
                name: ''
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('name: Task name is required');
        });

        it('should reject task name that is too long', () => {
            const task = {
                number: '1.0',
                name: 'a'.repeat(201)
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('name: Task name too long');
        });

        it('should reject invalid status', () => {
            const task = {
                number: '1.0',
                name: 'Test Task',
                status: 'invalid' as any
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('status'))).toBe(true);
        });

        it('should reject priority out of range', () => {
            const task = {
                number: '1.0',
                name: 'Test Task',
                priority: 11
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('priority'))).toBe(true);
        });

        it('should reject invalid URLs in docs_references', () => {
            const task = {
                number: '1.0',
                name: 'Test Task',
                docs_references: ['not-a-url', 'also-invalid']
            };

            const result = validator.validateSingleTask(task);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid URL format'))).toBe(true);
        });
    });

    describe('validateImport', () => {
        it('should validate a list of valid tasks', () => {
            const tasks = [
                { number: '1.0', name: 'Parent Task' },
                { number: '1.1', name: 'Child Task', parent: '1.0' },
                { number: '2.0', name: 'Another Task' }
            ];

            const result = validator.validateImport(tasks);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.summary.total).toBe(3);
            expect(result.summary.valid).toBe(3);
            expect(result.summary.invalid).toBe(0);
        });

        it('should detect duplicate task numbers', () => {
            const tasks = [
                { number: '1.0', name: 'First Task' },
                { number: '1.0', name: 'Duplicate Task' }
            ];

            const result = validator.validateImport(tasks);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.error === 'Duplicate task number')).toBe(true);
        });

        it('should detect missing parent tasks', () => {
            const tasks = [
                { number: '1.1', name: 'Child Task', parent: '1.0' }
            ];

            const result = validator.validateImport(tasks);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.error === 'Parent task 1.0 not found in import')).toBe(true);
        });

        it('should detect circular dependencies', () => {
            const tasks = [
                { number: '1.0', name: 'Task A', dependencies: ['1.1'] },
                { number: '1.1', name: 'Task B', dependencies: ['1.0'] }
            ];

            const result = validator.validateImport(tasks);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.error.includes('Circular dependency detected'))).toBe(true);
        });

        it('should detect invalid hierarchical numbering', () => {
            const tasks = [
                { number: '1.0', name: 'Parent Task' },
                { number: '3', name: 'Invalid Child', parent: '1.0' } // Single digit, not valid
            ];

            const result = validator.validateImport(tasks);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'number')).toBe(true);
        });
    });
});

describe('Validation Utility Functions', () => {
    describe('isValidTaskNumber', () => {
        it('should validate correct task number formats', () => {
            expect(isValidTaskNumber('1.0')).toBe(true);
            expect(isValidTaskNumber('1.1')).toBe(true);
            expect(isValidTaskNumber('1.2.3')).toBe(true);
            expect(isValidTaskNumber('10.20.30')).toBe(true);
        });

        it('should reject invalid task number formats', () => {
            expect(isValidTaskNumber('1')).toBe(false); // Must have at least one dot
            expect(isValidTaskNumber('1.')).toBe(false);
            expect(isValidTaskNumber('.1')).toBe(false);
            expect(isValidTaskNumber('1.a')).toBe(false);
            expect(isValidTaskNumber('a.1')).toBe(false);
            expect(isValidTaskNumber('1..2')).toBe(false);
            expect(isValidTaskNumber('')).toBe(false);
        });
    });

    describe('isValidTaskStatus', () => {
        it('should validate correct statuses', () => {
            expect(isValidTaskStatus('pending')).toBe(true);
            expect(isValidTaskStatus('in_progress')).toBe(true);
            expect(isValidTaskStatus('completed')).toBe(true);
            expect(isValidTaskStatus('cancelled')).toBe(true);
        });

        it('should reject invalid statuses', () => {
            expect(isValidTaskStatus('invalid')).toBe(false);
            expect(isValidTaskStatus('done')).toBe(false);
            expect(isValidTaskStatus('todo')).toBe(false);
            expect(isValidTaskStatus('')).toBe(false);
        });
    });

    describe('validateTaskHierarchy', () => {
        it('should validate root tasks', () => {
            expect(validateTaskHierarchy('1.0')).toBe(true);
            expect(validateTaskHierarchy('2.0')).toBe(true);
            expect(validateTaskHierarchy('10.0')).toBe(true);
        });

        it('should validate child tasks', () => {
            expect(validateTaskHierarchy('1.1', '1.0')).toBe(true);
            expect(validateTaskHierarchy('1.2', '1.0')).toBe(true);
            expect(validateTaskHierarchy('1.0.1', '1.0')).toBe(true);
        });

        it('should reject invalid root tasks', () => {
            expect(validateTaskHierarchy('1.1')).toBe(false);
            expect(validateTaskHierarchy('1')).toBe(false);
        });

        it('should reject invalid child relationships', () => {
            expect(validateTaskHierarchy('2.1', '1.0')).toBe(false);
            expect(validateTaskHierarchy('1.0', '1.1')).toBe(false); // Parent cannot be child of child
            expect(validateTaskHierarchy('1.1', '2.0')).toBe(false); // Different root numbers
        });
    });
});

describe('TaskInputSchema', () => {
    it('should validate complete valid task input', () => {
        const taskInput = {
            number: '1.0',
            name: 'Test Task',
            description: 'A comprehensive test task',
            parent: '0.1',
            status: 'pending' as const,
            priority: 5,
            docs_references: ['https://example.com/docs'],
            testing_strategy: 'Unit and integration tests',
            dependencies: ['0.1', '0.2'],
            files: ['src/test.ts', 'tests/test.spec.ts'],
            notes: 'Important task for testing',
            completion_notes: 'Task completed successfully'
        };

        const result = TaskInputSchema.safeParse(taskInput);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.number).toBe('1.0');
            expect(result.data.name).toBe('Test Task');
            expect(result.data.status).toBe('pending');
        }
    });

    it('should validate minimal task input', () => {
        const taskInput = {
            number: '1.0',
            name: 'Minimal Task'
        };

        const result = TaskInputSchema.safeParse(taskInput);

        expect(result.success).toBe(true);
    });

    it('should reject invalid task input', () => {
        const taskInput = {
            number: 'invalid',
            name: '',
            priority: 15,
            status: 'invalid'
        };

        const result = TaskInputSchema.safeParse(taskInput);

        expect(result.success).toBe(false);
        if (!result.success) {
            const errors = result.error.issues.map(i => i.path.join('.') + ': ' + i.message);
            expect(errors.some(e => e.includes('number'))).toBe(true);
            expect(errors.some(e => e.includes('name'))).toBe(true);
            expect(errors.some(e => e.includes('priority'))).toBe(true);
            expect(errors.some(e => e.includes('status'))).toBe(true);
        }
    });
});