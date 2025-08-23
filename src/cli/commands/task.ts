import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { TaskService } from '../../core/task.js';
import { TodoqConfig, TaskStatus } from '../../core/types.js';
import { formatTask } from '../formatters.js';

export function registerTaskCommands(program: Command): void {
    // Show task details
    program
        .command('show')
        .alias('get')
        .description('Show detailed task view')
        .argument('<number>', 'task number')
        .action(async (taskNumber, options) => {
            const config = options._config as TodoqConfig;
            const taskService = options._taskService as TaskService;

            try {
                const task = taskService.findByNumber(taskNumber);

                if (!task) {
                    if (options.json) {
                        console.log(JSON.stringify({ error: 'Task not found' }));
                    } else {
                        console.log(chalk.red(`Task ${taskNumber} not found`));
                    }
                    return;
                }

                if (options.json) {
                    console.log(JSON.stringify(task, null, 2));
                } else {
                    console.log(formatTask(task, config, { showFiles: true, showDates: true }));
                }
            } catch (error) {
                throw error;
            }
        });

    // Insert new task
    program
        .command('insert')
        .alias('add')
        .description('Insert task')
        .argument('<number>', 'task number (e.g., 1.0, 1.1)')
        .argument('<name>', 'task name')
        .option('-d, --description <desc>', 'task description')
        .option('-p, --parent <parent>', 'parent task number')
        .option('--priority <priority>', 'task priority (0-10)', '0')
        .option('-s, --status <status>', 'task status', 'pending')
        .option('--notes <notes>', 'task notes')
        .action(async (taskNumber, name, options) => {
            const taskService = options._taskService as TaskService;

            try {
                const taskInput = {
                    number: taskNumber,
                    name,
                    description: options.description,
                    parent: options.parent || null,
                    status: options.status as TaskStatus,
                    priority: parseInt(options.priority),
                    notes: options.notes
                };

                const task = taskService.create(taskInput);

                if (options.json) {
                    console.log(JSON.stringify(task, null, 2));
                } else {
                    console.log(chalk.green(`Created task ${task.taskNumber}: ${task.name}`));
                }
            } catch (error) {
                throw error;
            }
        });

    // Remove task
    program
        .command('remove')
        .alias('delete')
        .description('Remove task and all subtasks')
        .argument('<number>', 'task number')
        .option('-f, --force', 'skip confirmation')
        .action(async (taskNumber, options) => {
            const taskService = options._taskService as TaskService;

            try {
                const task = taskService.findByNumber(taskNumber);
                if (!task) {
                    console.log(chalk.red(`Task ${taskNumber} not found`));
                    return;
                }

                // Get subtasks for confirmation
                const subtasks = taskService.list({ parentNumber: taskNumber });
                
                if (!options.force) {
                    const message = subtasks.length > 0
                        ? `Delete task ${taskNumber} and ${subtasks.length} subtasks?`
                        : `Delete task ${taskNumber}?`;
                    
                    const { confirmed } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirmed',
                        message,
                        default: false
                    }]);

                    if (!confirmed) {
                        console.log(chalk.yellow('Cancelled'));
                        return;
                    }
                }

                const deleted = taskService.delete(taskNumber);

                if (deleted) {
                    const count = subtasks.length + 1;
                    console.log(chalk.green(`Deleted ${count} task${count > 1 ? 's' : ''}`));
                } else {
                    console.log(chalk.red('Failed to delete task'));
                }
            } catch (error) {
                throw error;
            }
        });

    // Update task
    program
        .command('update')
        .alias('edit')
        .description('Update task details')
        .argument('<number>', 'task number')
        .option('-n, --name <name>', 'task name')
        .option('-d, --description <desc>', 'task description')
        .option('-p, --priority <priority>', 'task priority (0-10)')
        .option('-s, --status <status>', 'task status')
        .option('--notes <notes>', 'task notes')
        .option('--completion-notes <notes>', 'completion notes')
        .option('-i, --interactive', 'interactive update')
        .action(async (taskNumber, options) => {
            const config = options._config as TodoqConfig;
            const taskService = options._taskService as TaskService;

            try {
                const existingTask = taskService.findByNumber(taskNumber);
                if (!existingTask) {
                    console.log(chalk.red(`Task ${taskNumber} not found`));
                    return;
                }

                let updates: any = {};

                if (options.interactive) {
                    console.log(chalk.blue(`Updating task ${taskNumber}:`));
                    console.log(formatTask(existingTask, config, { compact: true }));
                    console.log('');

                    const answers = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'name',
                            message: 'Task name:',
                            default: existingTask.name
                        },
                        {
                            type: 'input',
                            name: 'description',
                            message: 'Description:',
                            default: existingTask.description || ''
                        },
                        {
                            type: 'list',
                            name: 'status',
                            message: 'Status:',
                            choices: ['pending', 'in_progress', 'completed', 'cancelled'],
                            default: existingTask.status
                        },
                        {
                            type: 'number',
                            name: 'priority',
                            message: 'Priority (0-10):',
                            default: existingTask.priority,
                            validate: (input: number) => (input >= 0 && input <= 10) || 'Priority must be between 0 and 10'
                        },
                        {
                            type: 'input',
                            name: 'notes',
                            message: 'Notes:',
                            default: existingTask.notes || ''
                        }
                    ]);

                    updates = answers;
                } else {
                    // Use command line options
                    if (options.name) updates.name = options.name;
                    if (options.description !== undefined) updates.description = options.description;
                    if (options.priority !== undefined) updates.priority = parseInt(options.priority);
                    if (options.status) updates.status = options.status as TaskStatus;
                    if (options.notes !== undefined) updates.notes = options.notes;
                    if (options.completionNotes !== undefined) updates.completion_notes = options.completionNotes;
                }

                // Remove empty strings and convert to undefined
                Object.keys(updates).forEach(key => {
                    if (updates[key] === '') {
                        updates[key] = undefined;
                    }
                });

                if (Object.keys(updates).length === 0) {
                    console.log(chalk.yellow('No updates provided'));
                    return;
                }

                const updatedTask = taskService.update(taskNumber, updates);

                if (options.json) {
                    console.log(JSON.stringify(updatedTask, null, 2));
                } else {
                    console.log(chalk.green(`Updated task ${taskNumber}`));
                    console.log(formatTask(updatedTask, config, { compact: true }));
                }
            } catch (error) {
                throw error;
            }
        });

    // Complete task
    program
        .command('complete')
        .alias('done')
        .description('Mark task as completed')
        .argument('<number>', 'task number')
        .option('--notes <notes>', 'completion notes')
        .option('--force', 'ignore dependency checks')
        .action(async (taskNumber, options) => {
            const taskService = options._taskService as TaskService;

            try {
                let result;

                if (options.force) {
                    // Force completion without dependency checks
                    const updates: any = { status: 'completed' };
                    if (options.notes) {
                        updates.completion_notes = options.notes;
                    }
                    const task = taskService.update(taskNumber, updates);
                    result = { task, autoCompleted: [] };
                } else {
                    // Use smart completion with dependency checks
                    result = taskService.completeTask(taskNumber, options.notes);
                }

                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log(chalk.green(`✓ Completed task ${taskNumber}: ${result.task.name}`));
                    
                    if (result.autoCompleted.length > 0) {
                        console.log(chalk.blue(`Auto-completed parent tasks: ${result.autoCompleted.join(', ')}`));
                    }
                }
            } catch (error) {
                throw error;
            }
        });

    // Mark task as incomplete
    program
        .command('incomplete')
        .alias('reopen')
        .description('Mark task as pending')
        .argument('<number>', 'task number')
        .action(async (taskNumber, options) => {
            const taskService = options._taskService as TaskService;

            try {
                const task = taskService.update(taskNumber, { status: 'pending' });

                if (options.json) {
                    console.log(JSON.stringify(task, null, 2));
                } else {
                    console.log(chalk.blue(`○ Reopened task ${taskNumber}: ${task.name}`));
                }
            } catch (error) {
                throw error;
            }
        });

    // Mark task as in progress
    program
        .command('in-progress')
        .alias('start')
        .description('Mark task as in progress')
        .argument('<number>', 'task number')
        .action(async (taskNumber, options) => {
            const taskService = options._taskService as TaskService;

            try {
                const task = taskService.update(taskNumber, { status: 'in_progress' });

                if (options.json) {
                    console.log(JSON.stringify(task, null, 2));
                } else {
                    console.log(chalk.yellow(`→ Started task ${taskNumber}: ${task.name}`));
                }
            } catch (error) {
                throw error;
            }
        });

    // Cancel task
    program
        .command('cancel')
        .description('Mark task as cancelled')
        .argument('<number>', 'task number')
        .option('--notes <notes>', 'cancellation reason')
        .action(async (taskNumber, options) => {
            const taskService = options._taskService as TaskService;

            try {
                const updates: any = { status: 'cancelled' };
                if (options.notes) {
                    updates.completion_notes = options.notes;
                }

                const task = taskService.update(taskNumber, updates);

                if (options.json) {
                    console.log(JSON.stringify(task, null, 2));
                } else {
                    console.log(chalk.red(`✗ Cancelled task ${taskNumber}: ${task.name}`));
                }
            } catch (error) {
                throw error;
            }
        });
}