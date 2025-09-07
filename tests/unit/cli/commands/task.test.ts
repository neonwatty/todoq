import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { registerTaskCommands } from '../../../../src/cli/commands/task.js';
import { TaskService } from '../../../../src/core/task.js';
import { formatTask } from '../../../../src/cli/formatters.js';
import { setupAllCommands } from './test-helpers.js';
import type { Task, TodoqConfig, TaskStatus } from '../../../../src/core/types.js';

// Mock dependencies
vi.mock('inquirer');
vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text) => text),
    green: vi.fn((text) => text), 
    blue: vi.fn((text) => text),
    yellow: vi.fn((text) => text)
  }
}));

vi.mock('../../../../src/core/task.js', () => ({
  TaskService: vi.fn(() => ({
    findByNumber: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    list: vi.fn(),
    completeTask: vi.fn()
  }))
}));

vi.mock('../../../../src/cli/formatters.js', () => ({
  formatTask: vi.fn(() => 'formatted task output')
}));

describe('Task Commands', () => {
  let program: Command;
  let mockTaskService: any;
  let mockConfig: TodoqConfig;
  let mockTask: Task;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    program = new Command();
    registerTaskCommands(program);
    
    mockTaskService = {
      findByNumber: vi.fn(),
      create: vi.fn(),
      update: vi.fn(), 
      delete: vi.fn(),
      deleteAll: vi.fn(),
      list: vi.fn(),
      completeTask: vi.fn()
    };

    mockConfig = {
      database: { path: 'test.db', autoMigrate: true, walMode: true },
      display: { format: 'tree', colors: true, showCompleted: false },
      defaults: { status: 'pending', priority: 0 }
    } as TodoqConfig;

    mockTask = {
      id: 1,
      taskNumber: '1.0',
      name: 'Test Task',
      description: 'Test description',
      status: 'pending' as TaskStatus,
      priority: 0,
      parent: null,
      notes: null,
      completion_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setupAllCommands(program, {
      _taskService: mockTaskService,
      _config: mockConfig
    });

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('show command', () => {
    it('should show task details in normal format', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'show', '1.0']);

      expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
      expect(formatTask).toHaveBeenCalledWith(mockTask, mockConfig, { showFiles: true, showDates: true });
      expect(consoleSpy).toHaveBeenCalledWith('formatted task output');
    });

    it('should show task details in JSON format', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'show', '1.0', '--json']);

      expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockTask, null, 2));
    });

    it('should handle task not found in normal format', async () => {
      mockTaskService.findByNumber.mockReturnValue(null);

      await program.parseAsync(['node', 'test', 'show', '1.0']);

      expect(consoleSpy).toHaveBeenCalledWith('Task 1.0 not found');
    });

    it('should handle task not found in JSON format', async () => {
      mockTaskService.findByNumber.mockReturnValue(null);

      await program.parseAsync(['node', 'test', 'show', '1.0', '--json']);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'Task not found' }));
    });

    it('should work with get alias', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'get', '1.0']);

      expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
      expect(formatTask).toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
      const error = new Error('Database error');
      mockTaskService.findByNumber.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'show', '1.0']))
        .rejects.toThrow('Database error');
    });
  });

  describe('insert command', () => {
    it('should create task with minimal parameters', async () => {
      mockTaskService.create.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'insert', '1.0', 'New Task']);

      expect(mockTaskService.create).toHaveBeenCalledWith({
        number: '1.0',
        name: 'New Task',
        description: undefined,
        parent: null,
        status: 'pending',
        priority: 0,
        notes: undefined
      });
      expect(consoleSpy).toHaveBeenCalledWith('Created task 1.0: Test Task');
    });

    it('should create task with all options', async () => {
      mockTaskService.create.mockReturnValue(mockTask);

      await program.parseAsync([
        'node', 'test', 'insert', '1.1', 'Task with options',
        '-d', 'Task description',
        '-p', '1.0',
        '--priority', '5',
        '-s', 'in_progress',
        '--notes', 'Initial notes'
      ]);

      expect(mockTaskService.create).toHaveBeenCalledWith({
        number: '1.1',
        name: 'Task with options',
        description: 'Task description',
        parent: '1.0',
        status: 'in_progress',
        priority: 5,
        notes: 'Initial notes'
      });
    });

    it('should output JSON format when requested', async () => {
      mockTaskService.create.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'insert', '1.0', 'New Task', '--json']);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(mockTask, null, 2));
    });

    it('should work with add alias', async () => {
      mockTaskService.create.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'add', '1.0', 'New Task']);

      expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
        number: '1.0',
        name: 'New Task'
      }));
    });

    it('should handle create errors', async () => {
      const error = new Error('Task already exists');
      mockTaskService.create.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'insert', '1.0', 'New Task']))
        .rejects.toThrow('Task already exists');
    });

    it('should parse priority as integer', async () => {
      mockTaskService.create.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'insert', '1.0', 'Task', '--priority', '7']);

      expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
        priority: 7
      }));
    });
  });

  describe('remove command', () => {
    beforeEach(() => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });
    });

    it('should delete task after confirmation', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([]); // No subtasks
      mockTaskService.delete.mockReturnValue(true);

      await program.parseAsync(['node', 'test', 'remove', '1.0']);

      expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
      expect(mockTaskService.list).toHaveBeenCalledWith({ parentNumber: '1.0' });
      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Delete task 1.0?',
        default: false
      }]);
      expect(mockTaskService.delete).toHaveBeenCalledWith('1.0');
      expect(consoleSpy).toHaveBeenCalledWith('Deleted 1 task');
    });

    it('should show subtask count in confirmation', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([mockTask, mockTask]); // 2 subtasks
      mockTaskService.delete.mockReturnValue(true);

      await program.parseAsync(['node', 'test', 'remove', '1.0']);

      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Delete task 1.0 and 2 subtasks?',
        default: false
      }]);
      expect(consoleSpy).toHaveBeenCalledWith('Deleted 3 tasks');
    });

    it('should skip confirmation with force flag', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([]);
      mockTaskService.delete.mockReturnValue(true);

      await program.parseAsync(['node', 'test', 'remove', '1.0', '--force']);

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockTaskService.delete).toHaveBeenCalledWith('1.0');
    });

    it('should cancel deletion when user declines', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([]);
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmed: false });

      await program.parseAsync(['node', 'test', 'remove', '1.0']);

      expect(mockTaskService.delete).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Cancelled');
    });

    it('should handle task not found', async () => {
      mockTaskService.findByNumber.mockReturnValue(null);

      await program.parseAsync(['node', 'test', 'remove', '1.0']);

      expect(consoleSpy).toHaveBeenCalledWith('Task 1.0 not found');
      expect(mockTaskService.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion failure', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([]);
      mockTaskService.delete.mockReturnValue(false);

      await program.parseAsync(['node', 'test', 'remove', '1.0', '--force']);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete task');
    });

    it('should work with delete alias', async () => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.list.mockReturnValue([]);
      mockTaskService.delete.mockReturnValue(true);

      await program.parseAsync(['node', 'test', 'delete', '1.0', '--force']);

      expect(mockTaskService.delete).toHaveBeenCalledWith('1.0');
    });
  });

  describe('update command', () => {
    beforeEach(() => {
      mockTaskService.findByNumber.mockReturnValue(mockTask);
      mockTaskService.update.mockReturnValue({ ...mockTask, name: 'Updated Task' });
    });

    it('should update task with command line options', async () => {
      await program.parseAsync([
        'node', 'test', 'update', '1.0',
        '--name', 'Updated Name',
        '--description', 'Updated desc',
        '--priority', '3',
        '--status', 'in_progress',
        '--notes', 'Updated notes'
      ]);

      expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        name: 'Updated Name',
        description: 'Updated desc',
        priority: 3,
        status: 'in_progress',
        notes: 'Updated notes'
      });
      expect(consoleSpy).toHaveBeenCalledWith('Updated task 1.0');
    });

    it('should handle interactive mode', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        name: 'Interactive Name',
        description: 'Interactive desc',
        status: 'completed',
        priority: 5,
        notes: 'Interactive notes'
      });

      await program.parseAsync(['node', 'test', 'update', '1.0', '--interactive']);

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({ name: 'name', default: 'Test Task' }),
        expect.objectContaining({ name: 'description', default: 'Test description' }),
        expect.objectContaining({ name: 'status', default: 'pending' }),
        expect.objectContaining({ name: 'priority', default: 0 }),
        expect.objectContaining({ name: 'notes', default: '' })
      ]);
      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        name: 'Interactive Name',
        description: 'Interactive desc',
        status: 'completed',
        priority: 5,
        notes: 'Interactive notes'
      });
    });

    it('should convert empty strings to undefined', async () => {
      await program.parseAsync([
        'node', 'test', 'update', '1.0',
        '--description', '',
        '--notes', ''
      ]);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        description: undefined,
        notes: undefined
      });
    });

    it('should handle no updates provided', async () => {
      await program.parseAsync(['node', 'test', 'update', '1.0']);

      expect(mockTaskService.update).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('No updates provided');
    });

    it('should handle task not found', async () => {
      mockTaskService.findByNumber.mockReturnValue(null);

      await program.parseAsync(['node', 'test', 'update', '1.0', '--name', 'New Name']);

      expect(consoleSpy).toHaveBeenCalledWith('Task 1.0 not found');
      expect(mockTaskService.update).not.toHaveBeenCalled();
    });

    it('should handle completion-notes option', async () => {
      mockTaskService.update.mockReturnValue(mockTask);

      await program.parseAsync(['node', 'test', 'update', '1.0', '--completion-notes', 'Task notes']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        completion_notes: 'Task notes'
      });
    });

    it('should work with edit alias', async () => {
      await program.parseAsync(['node', 'test', 'edit', '1.0', '--name', 'Edited Name']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        name: 'Edited Name'
      });
    });

    it('should parse priority as integer', async () => {
      await program.parseAsync(['node', 'test', 'update', '1.0', '--priority', '8']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        priority: 8
      });
    });

    it('should validate priority in interactive mode', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({
        name: 'Test',
        description: '',
        status: 'pending',
        priority: 5,
        notes: ''
      });

      await program.parseAsync(['node', 'test', 'update', '1.0', '--interactive']);

      const priorityPrompt = vi.mocked(inquirer.prompt).mock.calls[0][0].find(
        (prompt: any) => prompt.name === 'priority'
      );
      expect(priorityPrompt.validate(5)).toBe(true);
      expect(priorityPrompt.validate(15)).toBe('Priority must be between 0 and 10');
    });
  });

  describe('complete command', () => {
    const completionResult = {
      task: { ...mockTask, status: 'completed', name: 'Test Task' },
      autoCompleted: ['2.0', '3.0']
    };

    it('should complete task with smart completion', async () => {
      mockTaskService.completeTask.mockReturnValue(completionResult);

      await program.parseAsync(['node', 'test', 'complete', '1.0']);

      expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', undefined);
      expect(consoleSpy).toHaveBeenCalledWith('✓ Completed task 1.0: Test Task');
      expect(consoleSpy).toHaveBeenCalledWith('Auto-completed parent tasks: 2.0, 3.0');
    });

    it('should complete task with completion notes', async () => {
      mockTaskService.completeTask.mockReturnValue(completionResult);

      await program.parseAsync(['node', 'test', 'complete', '1.0', '--notes', 'Task finished']);

      expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', 'Task finished');
    });

    it('should force completion bypassing dependency checks', async () => {
      const forcedTask = { ...mockTask, status: 'completed' };
      mockTaskService.update.mockReturnValue(forcedTask);

      await program.parseAsync(['node', 'test', 'complete', '1.0', '--force']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'completed' });
      expect(mockTaskService.completeTask).not.toHaveBeenCalled();
    });

    it('should force completion with notes', async () => {
      const forcedTask = { ...mockTask, status: 'completed' };
      mockTaskService.update.mockReturnValue(forcedTask);

      await program.parseAsync(['node', 'test', 'complete', '1.0', '--force', '--notes', 'Forced complete']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        status: 'completed',
        completion_notes: 'Forced complete'
      });
    });

    it('should handle errors in completion process', async () => {
      const error = new Error('Completion failed');
      mockTaskService.completeTask.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'complete', '1.0']))
        .rejects.toThrow('Completion failed');
    });

    it('should work with done alias', async () => {
      mockTaskService.completeTask.mockReturnValue(completionResult);

      await program.parseAsync(['node', 'test', 'done', '1.0']);

      expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', undefined);
    });

    it('should handle completion without auto-completed tasks', async () => {
      const simpleResult = { task: { ...mockTask, status: 'completed' }, autoCompleted: [] };
      mockTaskService.completeTask.mockReturnValue(simpleResult);

      await program.parseAsync(['node', 'test', 'complete', '1.0']);

      expect(consoleSpy).toHaveBeenCalledWith('✓ Completed task 1.0: Test Task');
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Auto-completed'));
    });
  });

  describe('incomplete command', () => {
    it('should reopen task', async () => {
      const reopenedTask = { ...mockTask, status: 'pending' };
      mockTaskService.update.mockReturnValue(reopenedTask);

      await program.parseAsync(['node', 'test', 'incomplete', '1.0']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'pending' });
      expect(consoleSpy).toHaveBeenCalledWith('○ Reopened task 1.0: Test Task');
    });

    it('should handle task not found error', async () => {
      const error = new Error('Task not found');
      mockTaskService.update.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'incomplete', '1.0']))
        .rejects.toThrow('Task not found');
    });

    it('should work with reopen alias', async () => {
      const reopenedTask = { ...mockTask, status: 'pending' };
      mockTaskService.update.mockReturnValue(reopenedTask);

      await program.parseAsync(['node', 'test', 'reopen', '1.0']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'pending' });
    });
  });

  describe('in-progress command', () => {
    it('should start task', async () => {
      const startedTask = { ...mockTask, status: 'in_progress' };
      mockTaskService.update.mockReturnValue(startedTask);

      await program.parseAsync(['node', 'test', 'in-progress', '1.0']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'in_progress' });
      expect(consoleSpy).toHaveBeenCalledWith('→ Started task 1.0: Test Task');
    });

    it('should handle update errors', async () => {
      const error = new Error('Update failed');
      mockTaskService.update.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'in-progress', '1.0']))
        .rejects.toThrow('Update failed');
    });

    it('should work with start alias', async () => {
      const startedTask = { ...mockTask, status: 'in_progress' };
      mockTaskService.update.mockReturnValue(startedTask);

      await program.parseAsync(['node', 'test', 'start', '1.0']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'in_progress' });
    });
  });

  describe('cancel command', () => {
    it('should cancel task', async () => {
      const cancelledTask = { ...mockTask, status: 'cancelled' };
      mockTaskService.update.mockReturnValue(cancelledTask);

      await program.parseAsync(['node', 'test', 'cancel', '1.0']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'cancelled' });
      expect(consoleSpy).toHaveBeenCalledWith('✗ Cancelled task 1.0: Test Task');
    });

    it('should cancel task with notes', async () => {
      const cancelledTask = { ...mockTask, status: 'cancelled' };
      mockTaskService.update.mockReturnValue(cancelledTask);

      await program.parseAsync(['node', 'test', 'cancel', '1.0', '--notes', 'Not needed anymore']);

      expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
        status: 'cancelled',
        completion_notes: 'Not needed anymore'
      });
    });

    it('should handle cancellation errors', async () => {
      const error = new Error('Cancellation failed');
      mockTaskService.update.mockImplementation(() => {
        throw error;
      });

      await expect(program.parseAsync(['node', 'test', 'cancel', '1.0']))
        .rejects.toThrow('Cancellation failed');
    });
  });

  describe('clear command', () => {
    beforeEach(() => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });
    });

    it('should delete all tasks after confirmation', async () => {
      mockTaskService.deleteAll.mockReturnValue(5);

      await program.parseAsync(['node', 'test', 'clear']);

      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'confirm',
        name: 'confirmed',
        message: 'Delete all tasks? This action cannot be undone.',
        default: false
      }]);
      expect(mockTaskService.deleteAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Deleted 5 tasks');
    });

    it('should skip confirmation with confirm flag', async () => {
      mockTaskService.deleteAll.mockReturnValue(3);

      await program.parseAsync(['node', 'test', 'clear', '--confirm']);

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(mockTaskService.deleteAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Deleted 3 tasks');
    });

    it('should cancel when user declines', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValue({ confirmed: false });

      await program.parseAsync(['node', 'test', 'clear']);

      expect(mockTaskService.deleteAll).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Cancelled');
    });

    it('should handle no tasks to delete', async () => {
      mockTaskService.deleteAll.mockReturnValue(0);

      await program.parseAsync(['node', 'test', 'clear', '--confirm']);

      expect(consoleSpy).toHaveBeenCalledWith('No tasks to delete');
    });

    it('should output JSON format', async () => {
      mockTaskService.deleteAll.mockReturnValue(2);

      await program.parseAsync(['node', 'test', 'clear', '--confirm', '--json']);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ deletedCount: 2 }, null, 2));
    });

    it('should handle singular task message', async () => {
      mockTaskService.deleteAll.mockReturnValue(1);

      await program.parseAsync(['node', 'test', 'clear', '--confirm']);

      expect(consoleSpy).toHaveBeenCalledWith('✓ Deleted 1 task');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    describe('Input validation', () => {
      it('should handle special characters in task names', async () => {
        mockTaskService.create.mockReturnValue(mockTask);
        const specialName = 'Task with "quotes" & <html> tags';

        await program.parseAsync(['node', 'test', 'insert', '1.0', specialName]);

        expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
          name: specialName
        }));
      });

      it('should handle unicode characters in descriptions', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        mockTaskService.update.mockReturnValue(mockTask);
        const unicodeDesc = 'Task with emojis 🚀 and unicode ñáéíóú';

        await program.parseAsync(['node', 'test', 'update', '1.0', '--description', unicodeDesc]);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
          description: unicodeDesc
        });
      });

      it('should handle very long task names', async () => {
        mockTaskService.create.mockReturnValue(mockTask);
        const longName = 'A'.repeat(1000);

        await program.parseAsync(['node', 'test', 'insert', '1.0', longName]);

        expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
          name: longName
        }));
      });

      it('should handle complex task numbers', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);

        await program.parseAsync(['node', 'test', 'show', '10.5.3.1']);

        expect(mockTaskService.findByNumber).toHaveBeenCalledWith('10.5.3.1');
      });

      it('should handle invalid priority bounds in insert', async () => {
        mockTaskService.create.mockReturnValue(mockTask);

        // Should still pass through the value - validation happens in service layer
        await program.parseAsync(['node', 'test', 'insert', '1.0', 'Task', '--priority', '15']);

        expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
          priority: 15
        }));
      });
    });

    describe('Service layer errors', () => {
      it('should propagate database connection errors from show', async () => {
        const dbError = new Error('SQLITE_BUSY: database is locked');
        mockTaskService.findByNumber.mockImplementation(() => {
          throw dbError;
        });

        await expect(program.parseAsync(['node', 'test', 'show', '1.0']))
          .rejects.toThrow('SQLITE_BUSY: database is locked');
      });

      it('should propagate constraint violation errors from insert', async () => {
        const constraintError = new Error('UNIQUE constraint failed: tasks.task_number');
        mockTaskService.create.mockImplementation(() => {
          throw constraintError;
        });

        await expect(program.parseAsync(['node', 'test', 'insert', '1.0', 'Duplicate Task']))
          .rejects.toThrow('UNIQUE constraint failed');
      });

      it('should propagate foreign key constraint errors from update', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        const fkError = new Error('FOREIGN KEY constraint failed');
        mockTaskService.update.mockImplementation(() => {
          throw fkError;
        });

        await expect(program.parseAsync(['node', 'test', 'update', '1.0', '--name', 'Updated']))
          .rejects.toThrow('FOREIGN KEY constraint failed');
      });

      it('should propagate dependency validation errors from complete', async () => {
        const depError = new Error('Cannot complete task: dependencies not met');
        mockTaskService.completeTask.mockImplementation(() => {
          throw depError;
        });

        await expect(program.parseAsync(['node', 'test', 'complete', '1.0']))
          .rejects.toThrow('Cannot complete task: dependencies not met');
      });

      it('should handle transaction rollback errors', async () => {
        const txError = new Error('Transaction rolled back due to concurrent modification');
        mockTaskService.deleteAll.mockImplementation(() => {
          throw txError;
        });

        await expect(program.parseAsync(['node', 'test', 'clear', '--confirm']))
          .rejects.toThrow('Transaction rolled back');
      });
    });

    describe('Interactive prompt edge cases', () => {
      it('should handle inquirer prompt interruption (CTRL+C)', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        mockTaskService.list.mockReturnValue([]);
        const interruptError = new Error('User interrupted');
        vi.mocked(inquirer.prompt).mockRejectedValue(interruptError);

        await expect(program.parseAsync(['node', 'test', 'remove', '1.0']))
          .rejects.toThrow('User interrupted');
      });

      it('should handle invalid input in interactive update priority', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        vi.mocked(inquirer.prompt).mockResolvedValue({
          name: 'Test',
          description: '',
          status: 'pending',
          priority: -5, // Invalid but passed through
          notes: ''
        });

        await program.parseAsync(['node', 'test', 'update', '1.0', '--interactive']);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', expect.objectContaining({
          priority: -5
        }));
      });

      it('should handle empty responses in interactive update', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        vi.mocked(inquirer.prompt).mockResolvedValue({
          name: '',
          description: '',
          status: 'pending',
          priority: 0,
          notes: ''
        });

        await program.parseAsync(['node', 'test', 'update', '1.0', '--interactive']);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
          name: undefined,
          description: undefined,
          status: 'pending',
          priority: 0,
          notes: undefined
        });
      });
    });

    describe('Command option combinations', () => {
      it('should handle conflicting options gracefully', async () => {
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        mockTaskService.update.mockReturnValue(mockTask);

        // Both command line and interactive - interactive should take precedence
        vi.mocked(inquirer.prompt).mockResolvedValue({
          name: 'Interactive Name',
          description: 'Interactive desc',
          status: 'in_progress',
          priority: 5,
          notes: 'Interactive notes'
        });

        await program.parseAsync([
          'node', 'test', 'update', '1.0',
          '--name', 'CLI Name',
          '--interactive'
        ]);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
          name: 'Interactive Name',
          description: 'Interactive desc',
          status: 'in_progress',
          priority: 5,
          notes: 'Interactive notes'
        });
      });

      it('should handle multiple status changes in sequence', async () => {
        const task = { ...mockTask };
        mockTaskService.update
          .mockReturnValueOnce({ ...task, status: 'in_progress' })
          .mockReturnValueOnce({ ...task, status: 'completed' })
          .mockReturnValueOnce({ ...task, status: 'cancelled' });

        await program.parseAsync(['node', 'test', 'in-progress', '1.0']);
        await program.parseAsync(['node', 'test', 'complete', '1.0', '--force']);
        await program.parseAsync(['node', 'test', 'cancel', '1.0']);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'in_progress' });
        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'completed' });
        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', { status: 'cancelled' });
      });
    });

    describe('JSON output consistency', () => {
      it('should maintain JSON structure consistency across error scenarios', async () => {
        mockTaskService.findByNumber.mockReturnValue(null);

        await program.parseAsync(['node', 'test', 'show', 'nonexistent', '--json']);

        expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'Task not found' }));
      });

      it('should handle JSON serialization of complex objects', async () => {
        const complexTask = {
          ...mockTask,
          metadata: { tags: ['urgent', 'bug'], assignee: 'developer' },
          history: [
            { action: 'created', timestamp: '2023-01-01' },
            { action: 'updated', timestamp: '2023-01-02' }
          ]
        };
        mockTaskService.findByNumber.mockReturnValue(complexTask);

        await program.parseAsync(['node', 'test', 'show', '1.0', '--json']);

        expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(complexTask, null, 2));
      });
    });

    describe('Concurrency and race conditions', () => {
      it('should handle task modification during remove operation', async () => {
        mockTaskService.findByNumber.mockReturnValueOnce(mockTask);
        mockTaskService.list.mockReturnValue([]);
        // Simulate task being deleted by another process
        mockTaskService.delete.mockReturnValue(false);

        await program.parseAsync(['node', 'test', 'remove', '1.0', '--force']);

        expect(consoleSpy).toHaveBeenCalledWith('Failed to delete task');
      });

      it('should handle empty database scenarios', async () => {
        mockTaskService.deleteAll.mockReturnValue(0);

        await program.parseAsync(['node', 'test', 'clear', '--confirm']);

        expect(consoleSpy).toHaveBeenCalledWith('No tasks to delete');
      });
    });

    describe('Memory and performance edge cases', () => {
      it('should handle very large completion notes', async () => {
        mockTaskService.update.mockReturnValue(mockTask);
        const largeNotes = 'A'.repeat(10000);

        await program.parseAsync(['node', 'test', 'cancel', '1.0', '--notes', largeNotes]);

        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
          status: 'cancelled',
          completion_notes: largeNotes
        });
      });

      it('should handle tasks with many subtasks in remove confirmation', async () => {
        const manySubtasks = Array(1000).fill(mockTask);
        mockTaskService.findByNumber.mockReturnValue(mockTask);
        mockTaskService.list.mockReturnValue(manySubtasks);
        mockTaskService.delete.mockReturnValue(true);

        await program.parseAsync(['node', 'test', 'remove', '1.0', '--force']);

        expect(consoleSpy).toHaveBeenCalledWith('Deleted 1001 tasks');
      });
    });

    describe('Cross-command integration', () => {
      it('should maintain consistency across related operations', async () => {
        // Create -> Show -> Update -> Complete workflow
        const createdTask = { ...mockTask, name: 'New Task' };
        const updatedTask = { ...createdTask, description: 'Updated description' };
        const completedResult = { task: { ...updatedTask, status: 'completed' }, autoCompleted: [] };

        mockTaskService.create.mockReturnValue(createdTask);
        mockTaskService.findByNumber.mockReturnValue(updatedTask);
        mockTaskService.update.mockReturnValue(updatedTask);
        mockTaskService.completeTask.mockReturnValue(completedResult);

        await program.parseAsync(['node', 'test', 'insert', '1.0', 'New Task']);
        await program.parseAsync(['node', 'test', 'show', '1.0']);
        await program.parseAsync(['node', 'test', 'update', '1.0', '--description', 'Updated description']);
        await program.parseAsync(['node', 'test', 'complete', '1.0']);

        expect(mockTaskService.create).toHaveBeenCalledWith(expect.objectContaining({
          number: '1.0',
          name: 'New Task'
        }));
        expect(mockTaskService.findByNumber).toHaveBeenCalledWith('1.0');
        expect(mockTaskService.update).toHaveBeenCalledWith('1.0', {
          description: 'Updated description'
        });
        expect(mockTaskService.completeTask).toHaveBeenCalledWith('1.0', undefined);
      });
    });
  });
});