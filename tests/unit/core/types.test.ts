import { describe, it, expect } from 'vitest';
import { TodoqError } from '../../../src/core/types.js';

describe('TodoqError', () => {
    it('should create error with message and code', () => {
        const error = new TodoqError('Test error message', 'TEST_ERROR');

        expect(error.message).toBe('Test error message');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.name).toBe('TodoqError');
        expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
        const details = { userId: 123, action: 'delete' };
        const error = new TodoqError('Operation failed', 'OPERATION_ERROR', details);

        expect(error.message).toBe('Operation failed');
        expect(error.code).toBe('OPERATION_ERROR');
        expect(error.details).toEqual(details);
    });

    it('should be instance of Error', () => {
        const error = new TodoqError('Test', 'TEST');

        expect(error instanceof Error).toBe(true);
        expect(error instanceof TodoqError).toBe(true);
    });

    it('should have proper stack trace', () => {
        const error = new TodoqError('Test', 'TEST');

        expect(error.stack).toBeDefined();
        expect(error.stack?.includes('TodoqError')).toBe(true);
    });
});