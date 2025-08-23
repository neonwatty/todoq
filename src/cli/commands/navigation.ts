import { Command } from 'commander';
import chalk from 'chalk';
import { NavigationService } from '../../core/navigation.js';
import { TodoqConfig } from '../../core/types.js';
import { formatTask } from '../formatters.js';

export function registerNavigationCommands(program: Command): void {
    // Current task command
    program
        .command('current')
        .description('Show current task details')
        .option('--number', 'show number only')
        .action(async (options) => {
            const config = options._config as TodoqConfig;
            const navigationService = options._navigationService as NavigationService;

            try {
                const currentTask = navigationService.getCurrentTask();

                if (!currentTask) {
                    if (options.json) {
                        console.log(JSON.stringify({ message: 'No current task found' }));
                    } else {
                        console.log(chalk.yellow('No current task found. All tasks might be completed!'));
                    }
                    return;
                }

                if (options.json) {
                    console.log(JSON.stringify(currentTask, null, 2));
                } else if (options.number) {
                    console.log(currentTask.taskNumber);
                } else {
                    console.log(formatTask(currentTask, config));
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