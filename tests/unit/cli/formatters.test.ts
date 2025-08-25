import { describe, it, expect, vi } from 'vitest';
import { formatTask, formatTaskList, formatStats } from '../../../src/cli/formatters.js';
import { Task, TodoqConfig, TaskStats } from '../../../src/core/types.js';

// Mock chalk to return plain text
vi.mock('chalk', () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
        cyan: (text: string) => text,
        bold: (text: string) => text,
        gray: (text: string) => text,
        dim: (text: string) => text,
        magenta: (text: string) => text
    }
}));

// Mock cli-table3 to return simple text representation
vi.mock('cli-table3', () => {
    return {
        default: class MockTable {
            private rows: string[][] = [];
            private headers: string[] = [];

            constructor(options: { head: string[]; colWidths?: number[] }) {
                this.headers = options.head;
            }

            push(row: string[]) {
                this.rows.push(row);
            }

            toString() {
                const headerRow = this.headers.join(' | ');
                const separator = '-'.repeat(headerRow.length);
                const dataRows = this.rows.map(row => row.join(' | ')).join('\n');
                return [headerRow, separator, dataRows].join('\n');
            }
        }
    };
});

describe('Formatters', () => {
    const mockConfig: TodoqConfig = {
        database: {
            path: '/tmp/test.db',
            autoMigrate: true,
            walMode: true
        },
        display: {
            format: 'list',
            colors: false,
            showCompleted: false
        },
        defaults: {
            status: 'pending',
            priority: 0
        }
    };

    const mockTask: Task = {
        id: 1,
        taskNumber: '1.0',
        name: 'Test Task',
        description: 'A test task description',
        status: 'pending',
        priority: 1,
        files: ['src/test.ts', 'src/helper.ts'],
        docsReferences: ['https://docs.example.com/test', 'https://api.example.com'],
        testingStrategy: 'Unit and integration tests',
        dependencies: ['2.0'],
        notes: 'Important task notes',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-02T00:00:00Z')
    };

    const mockChildTask: Task = {
        id: 2,
        parentId: 1,
        taskNumber: '1.1',
        name: 'Child Task',
        description: 'A child task',
        status: 'completed',
        priority: 0,
        files: ['src/child.ts'],
        docsReferences: ['https://docs.example.com/child'],
        testingStrategy: 'Unit tests only',
        notes: 'Child task notes',
        completionNotes: 'Task completed successfully',
        createdAt: new Date('2023-01-01T00:00:00Z'),
        updatedAt: new Date('2023-01-03T00:00:00Z')
    };

    describe('formatTask', () => {
        it('should format task in compact mode', () => {
            const result = formatTask(mockTask, mockConfig, { compact: true });
            
            expect(result).toContain('○ 1.0 Test Task [P1]');
            expect(result).not.toContain('Description:');
            expect(result).not.toContain('Files:');
        });

        it('should format task in detailed mode', () => {
            const result = formatTask(mockTask, mockConfig, { compact: false });
            
            expect(result).toContain('○ 1.0 Test Task [P1]');
            expect(result).toContain('Status: pending');
            expect(result).toContain('Description: A test task description');
            expect(result).toContain('Files: src/test.ts, src/helper.ts');
            expect(result).toContain('Docs: https://docs.example.com/test, https://api.example.com');
            expect(result).toContain('Testing: Unit and integration tests');
            expect(result).toContain('Notes: Important task notes');
        });

        it('should show completion notes for completed tasks', () => {
            const result = formatTask(mockChildTask, mockConfig, { compact: false });
            
            expect(result).toContain('✓ 1.1 Child Task');
            expect(result).toContain('Status: completed');
            expect(result).toContain('Completion: Task completed successfully');
        });

        it('should handle tasks with minimal data', () => {
            const minimalTask: Task = {
                id: 3,
                taskNumber: '2.0',
                name: 'Minimal Task',
                status: 'pending',
                priority: 0
            };

            const result = formatTask(minimalTask, mockConfig, { compact: false });
            
            expect(result).toContain('○ 2.0 Minimal Task');
            expect(result).toContain('Status: pending');
            expect(result).not.toContain('Description:');
            expect(result).not.toContain('Files:');
            expect(result).not.toContain('Docs:');
        });

        it('should handle empty arrays gracefully', () => {
            const taskWithEmptyArrays: Task = {
                ...mockTask,
                files: [],
                docsReferences: [],
                dependencies: []
            };

            const result = formatTask(taskWithEmptyArrays, mockConfig, { compact: false });
            
            expect(result).toContain('○ 1.0 Test Task [P1]');
            expect(result).not.toContain('Files:');
            expect(result).not.toContain('Docs:');
        });
    });

    describe('formatTaskList', () => {
        const mockTasks: Task[] = [mockTask, mockChildTask];

        describe('list format', () => {
            it('should format tasks in compact list mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'list', false);
                
                expect(result).toContain('○ 1.0 Test Task [P1]');
                expect(result).toContain('✓ 1.1 Child Task');
                expect(result).not.toContain('Description:');
                expect(result).not.toContain('Files:');
            });

            it('should format tasks in detailed list mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'list', true);
                
                expect(result).toContain('○ 1.0 Test Task [P1]');
                expect(result).toContain('Status: pending');
                expect(result).toContain('Description: A test task description');
                expect(result).toContain('Files: src/test.ts, src/helper.ts');
                expect(result).toContain('✓ 1.1 Child Task');
                expect(result).toContain('Status: completed');
                expect(result).toContain('Completion: Task completed successfully');
            });
        });

        describe('tree format', () => {
            it('should format tasks in compact tree mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'tree', false);
                
                expect(result).toContain('○ 1.0 Test Task [P1]');
                expect(result).toContain('  ✓ 1.1 Child Task');
                expect(result).not.toContain('Description:');
            });

            it('should format tasks in detailed tree mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'tree', true);
                
                expect(result).toContain('○ 1.0 Test Task [P1]');
                expect(result).toContain('  Status: pending');
                expect(result).toContain('  ✓ 1.1 Child Task');
                expect(result).toContain('    Status: completed');
            });
        });

        describe('table format', () => {
            it('should format tasks in compact table mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'table', false);
                
                expect(result).toContain('Number | Name | Status | Priority | Progress');
                expect(result).toContain('1.0 | Test Task | pending | P1 | 0%');
                expect(result).toContain('1.1 | Child Task | completed |  | 100%');
            });

            it('should format tasks in detailed table mode', () => {
                const result = formatTaskList(mockTasks, mockConfig, 'table', true);
                
                expect(result).toContain('Number | Name | Status | Priority | Description | Files | Dependencies | Docs | Testing | Notes | Created');
                expect(result).toContain('1.0');
                expect(result).toContain('Test Task');
                expect(result).toContain('pending');
                expect(result).toContain('P1');
                expect(result).toContain('A test task descrip...');
                expect(result).toContain('src/test....');
                expect(result).toContain('2.0');
            });

            it('should truncate long text in detailed table mode', () => {
                const longTask: Task = {
                    ...mockTask,
                    name: 'This is a very long task name that should be truncated',
                    description: 'This is a very long description that should be truncated in the table view because it exceeds the column width limit',
                    files: ['src/very/long/path/to/file.ts', 'src/another/very/long/path/to/another/file.ts']
                };

                const result = formatTaskList([longTask], mockConfig, 'table', true);
                
                expect(result).toContain('This is a very...');
                expect(result).toContain('This is a very...');
            });
        });

        describe('empty tasks', () => {
            it('should handle empty task list', () => {
                const result = formatTaskList([], mockConfig, 'list', false);
                
                expect(result).toBe('No tasks found');
            });

            it('should handle empty task list in detailed mode', () => {
                const result = formatTaskList([], mockConfig, 'list', true);
                
                expect(result).toBe('No tasks found');
            });

            it('should handle empty task list in table mode', () => {
                const result = formatTaskList([], mockConfig, 'table', true);
                
                expect(result).toBe('No tasks found');
            });
        });
    });

    describe('edge cases', () => {
        it('should handle tasks with unicode characters', () => {
            const unicodeTask: Task = {
                id: 4,
                taskNumber: '3.0',
                name: 'Task with 🚀 emoji and 中文 characters',
                description: 'Description with unicode: ñáéíóú, 🎉, 完了',
                status: 'pending',
                priority: 1,
                notes: 'Notes with special chars: ©®™'
            };

            const result = formatTask(unicodeTask, mockConfig, { compact: false });
            
            expect(result).toContain('🚀 emoji and 中文');
            expect(result).toContain('ñáéíóú, 🎉, 完了');
            expect(result).toContain('©®™');
        });

        it('should handle tasks with very long content', () => {
            const longTask: Task = {
                id: 5,
                taskNumber: '4.0',
                name: 'A'.repeat(100),
                description: 'B'.repeat(1000),
                status: 'pending',
                priority: 1,
                files: ['C'.repeat(200)],
                notes: 'D'.repeat(500)
            };

            const result = formatTaskList([longTask], mockConfig, 'table', true);
            
            // Should not throw error and should contain truncated content
            expect(result).toContain('AAAA...');
            expect(result).toContain('BBBB...');
            expect(result).toContain('CCCC...');
        });

        it('should handle tasks with null and undefined values', () => {
            const taskWithNulls: Task = {
                id: 6,
                taskNumber: '5.0',
                name: 'Task with nulls',
                status: 'pending',
                priority: 0,
                description: undefined,
                files: undefined,
                docsReferences: undefined,
                testingStrategy: undefined,
                notes: undefined
            };

            const result = formatTask(taskWithNulls, mockConfig, { compact: false });
            
            expect(result).toContain('○ 5.0 Task with nulls');
            expect(result).toContain('Status: pending');
            expect(result).not.toContain('Description:');
            expect(result).not.toContain('Files:');
            expect(result).not.toContain('Testing:');
        });

        it('should handle tasks with special status values', () => {
            const cancelledTask: Task = {
                ...mockTask,
                status: 'cancelled',
                completionNotes: 'Task was cancelled due to scope change'
            };

            const inProgressTask: Task = {
                ...mockTask,
                status: 'in_progress',
                completionPercentage: 75
            };

            const cancelledResult = formatTask(cancelledTask, mockConfig, { compact: false });
            const inProgressResult = formatTask(inProgressTask, mockConfig, { compact: false });
            
            expect(cancelledResult).toContain('✗ 1.0 Test Task');
            expect(cancelledResult).toContain('Status: cancelled');
            expect(cancelledResult).toContain('Cancellation: Task was cancelled due to scope change');
            
            expect(inProgressResult).toContain('→ 1.0 Test Task');
            expect(inProgressResult).toContain('Status: in_progress');
            expect(inProgressResult).toContain('Progress:');
            expect(inProgressResult).toContain('75%');
        });
    });

    describe('formatStats', () => {
        it('should format task statistics correctly', () => {
            const stats: TaskStats = {
                total: 10,
                completed: 5,
                pending: 3,
                inProgress: 1,
                cancelled: 1,
                completionRate: 50
            };

            const result = formatStats(stats);
            
            expect(result).toContain('Task Statistics:');
            expect(result).toContain('Total tasks: 10');
            expect(result).toContain('Completed: 5');
            expect(result).toContain('In Progress: 1');
            expect(result).toContain('Pending: 3');
            expect(result).toContain('Cancelled: 1');
            expect(result).toContain('Completion Rate: 50%');
        });

        it('should handle zero statistics', () => {
            const stats: TaskStats = {
                total: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                cancelled: 0,
                completionRate: 0
            };

            const result = formatStats(stats);
            
            expect(result).toContain('Total tasks: 0');
            expect(result).toContain('Completion Rate: 0%');
        });

        it('should handle 100% completion rate', () => {
            const stats: TaskStats = {
                total: 5,
                completed: 5,
                pending: 0,
                inProgress: 0,
                cancelled: 0,
                completionRate: 100
            };

            const result = formatStats(stats);
            
            expect(result).toContain('Completion Rate: 100%');
        });
    });
});