import { Command } from 'commander';
import chalk from 'chalk';
import { NavigationService } from '../../core/navigation.js';
import { TodoqConfig } from '../../core/types.js';
import { TaskService } from '../../core/task.js';
import { formatTask } from '../formatters.js';

export function registerNavigationCommands(program: Command): void {
    // Current task command
    program
        .command('current')
        .description('Show current task details and optionally change status')
        .option('--number', 'show number only')
        .option('--json', 'output as JSON')
        .option('-c, --complete', 'mark current task as completed')
        .option('-s, --start', 'mark current task as in progress')
        .option('-r, --reopen', 'mark current task as pending')
        .option('--cancel', 'mark current task as cancelled')
        .option('--notes <text>', 'completion or cancellation notes')
        .option('--force', 'ignore dependency checks when completing')
        .action(async (options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;
            const taskService = options._taskService as TaskService;

            try {
                const currentTask = navigationService.getCurrentTask();

                // Check if status change flags are provided
                const statusFlags = {
                    complete: options.complete,
                    start: options.start,
                    reopen: options.reopen,
                    cancel: options.cancel
                };
                const hasStatusFlag = Object.values(statusFlags).some(flag => flag);

                if (!currentTask) {
                    if (hasStatusFlag) {
                        const message = 'No current task found to update status';
                        if (options.json) {
                            console.log(JSON.stringify({ error: message }));
                        } else {
                            console.log(chalk.red(message));
                        }
                        return;
                    }
                    
                    if (options.json) {
                        console.log(JSON.stringify({ message: 'No current task found' }));
                    } else {
                        console.log(chalk.yellow('No current task found. All tasks might be completed!'));
                    }
                    return;
                }

                let updatedTask = currentTask;
                let result: any = null;

                // Handle status changes
                if (hasStatusFlag) {
                    // Check for multiple status flags
                    const activeFlags = Object.entries(statusFlags).filter(([_, value]) => value);
                    if (activeFlags.length > 1) {
                        const message = `Only one status flag can be used at a time. Found: ${activeFlags.map(([key]) => `--${key}`).join(', ')}`;
                        if (options.json) {
                            console.log(JSON.stringify({ error: message }));
                        } else {
                            console.log(chalk.red(message));
                        }
                        return;
                    }

                    if (options.complete) {
                        if (options.force) {
                            // Force completion without dependency checks
                            const updates: any = { status: 'completed' };
                            if (options.notes) {
                                updates.completion_notes = options.notes;
                            }
                            updatedTask = taskService.update(currentTask.taskNumber, updates);
                            result = { task: updatedTask, autoCompleted: [] };
                        } else {
                            // Use smart completion with dependency checks
                            result = taskService.completeTask(currentTask.taskNumber, options.notes);
                            updatedTask = result.task;
                        }
                        
                        if (!options.json && !options.number) {
                            console.log(chalk.green(`✓ Completed task ${updatedTask.taskNumber}: ${updatedTask.name}`));
                            if (result.autoCompleted && result.autoCompleted.length > 0) {
                                console.log(chalk.blue(`Auto-completed parent tasks: ${result.autoCompleted.join(', ')}`));
                            }
                        }
                    } else if (options.start) {
                        updatedTask = taskService.update(currentTask.taskNumber, { status: 'in_progress' });
                        if (!options.json && !options.number) {
                            console.log(chalk.yellow(`→ Started task ${updatedTask.taskNumber}: ${updatedTask.name}`));
                        }
                    } else if (options.reopen) {
                        updatedTask = taskService.update(currentTask.taskNumber, { status: 'pending' });
                        if (!options.json && !options.number) {
                            console.log(chalk.blue(`○ Reopened task ${updatedTask.taskNumber}: ${updatedTask.name}`));
                        }
                    } else if (options.cancel) {
                        const updates: any = { status: 'cancelled' };
                        if (options.notes) {
                            updates.completion_notes = options.notes;
                        }
                        updatedTask = taskService.update(currentTask.taskNumber, updates);
                        if (!options.json && !options.number) {
                            console.log(chalk.red(`✗ Cancelled task ${updatedTask.taskNumber}: ${updatedTask.name}`));
                        }
                    }
                }

                // Output task details
                if (options.json) {
                    if (result && (options.complete && !options.force)) {
                        // Include completion metadata for smart completion
                        console.log(JSON.stringify(result, null, 2));
                    } else {
                        console.log(JSON.stringify(updatedTask, null, 2));
                    }
                } else if (options.number) {
                    console.log(updatedTask.taskNumber);
                } else if (!hasStatusFlag) {
                    // Only show task details if no status change was made (status change already printed message)
                    console.log(formatTask(updatedTask, config));
                }
            } catch (error) {
                throw error;
            }
        });

    // Next task command
    program
        .command('next')
        .description('Show next task')
        .option('--number', 'show number only')
        .option('--json', 'output as JSON')
        .argument('[current]', 'current task number')
        .action(async (currentTaskNumber, options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;

            try {
                const nextTask = navigationService.getNextTask(currentTaskNumber);

                if (!nextTask) {
                    if (options.json) {
                        console.log(JSON.stringify({ message: 'No next task found' }));
                    } else {
                        console.log(chalk.yellow('No next task found'));
                    }
                    return;
                }

                if (options.json) {
                    console.log(JSON.stringify(nextTask, null, 2));
                } else if (options.number) {
                    console.log(nextTask.taskNumber);
                } else {
                    console.log(formatTask(nextTask, config));
                }
            } catch (error) {
                throw error;
            }
        });

    // Previous task command
    program
        .command('prev')
        .alias('previous')
        .description('Show previous task')
        .option('--number', 'show number only')
        .option('--json', 'output as JSON')
        .argument('[current]', 'current task number')
        .action(async (currentTaskNumber, options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;

            try {
                if (!currentTaskNumber) {
                    if (options.json) {
                        console.log(JSON.stringify({ message: 'Current task number required' }));
                    } else {
                        console.log(chalk.red('Please provide current task number'));
                    }
                    return;
                }

                const prevTask = navigationService.getPreviousTask(currentTaskNumber);

                if (!prevTask) {
                    if (options.json) {
                        console.log(JSON.stringify({ message: 'No previous task found' }));
                    } else {
                        console.log(chalk.yellow('No previous task found'));
                    }
                    return;
                }

                if (options.json) {
                    console.log(JSON.stringify(prevTask, null, 2));
                } else if (options.number) {
                    console.log(prevTask.taskNumber);
                } else {
                    console.log(formatTask(prevTask, config));
                }
            } catch (error) {
                throw error;
            }
        });

    // Remaining tasks count
    program
        .command('remaining')
        .description('Count incomplete tasks')
        .action(async (options) => {
            const navigationService = options._navigationService as NavigationService;

            try {
                const count = navigationService.getRemainingTaskCount();

                if (options.json) {
                    console.log(JSON.stringify({ remaining: count }));
                } else {
                    console.log(chalk.blue(`${count} tasks remaining`));
                }
            } catch (error) {
                throw error;
            }
        });

    // Progress tree view
    program
        .command('progress')
        .description('Show tree with completion percentages')
        .option('--root <number>', 'root task number to show progress for')
        .action(async (options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;

            try {
                const progress = navigationService.getTaskProgress();

                if (options.json) {
                    console.log(JSON.stringify(progress, null, 2));
                } else {
                    console.log(chalk.bold('\nTask Progress:\n'));
                    
                    for (const item of progress) {
                        const indent = '  '.repeat(item.taskNumber.split('.').length - 1);
                        const statusIcon = getStatusIcon(item.status);
                        const progressText = item.totalChildren > 0 
                            ? ` [${item.completionPercentage}%]`
                            : '';
                        
                        const line = `${indent}${statusIcon} ${item.taskNumber} ${item.name}${progressText}`;
                        
                        if (item.status === 'completed') {
                            console.log(chalk.green(line));
                        } else if (item.status === 'in_progress') {
                            console.log(chalk.yellow(line));
                        } else if (item.status === 'cancelled') {
                            console.log(chalk.red(line));
                        } else {
                            console.log(line);
                        }
                    }
                }
            } catch (error) {
                throw error;
            }
        });

    // Search tasks
    program
        .command('search')
        .alias('find')
        .description('Search tasks by number, name, or description')
        .argument('<query>', 'search query')
        .action(async (query, options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;

            try {
                const results = navigationService.searchTasks(query);

                if (options.json) {
                    console.log(JSON.stringify(results, null, 2));
                } else {
                    if (results.length === 0) {
                        console.log(chalk.yellow(`No tasks found matching "${query}"`));
                        return;
                    }

                    console.log(chalk.bold(`\nSearch results for "${query}":\n`));
                    for (const task of results) {
                        console.log(formatTask(task, config, { compact: true }));
                        console.log('');
                    }
                }
            } catch (error) {
                throw error;
            }
        });
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✓';
        case 'in_progress': return '→';
        case 'cancelled': return '✗';
        default: return '○';
    }
}