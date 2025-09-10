import { Command } from 'commander';
import { TaskService } from '../../core/task.js';
import { TodoqConfig, TaskStatus } from '../../core/types.js';
import { formatTaskList } from '../formatters.js';

export function registerListCommands(program: Command): void {
    program
        .command('list')
        .alias('ls')
        .description('List tasks with optional filtering')
        .option('--status <status>', 'filter by status (pending, in_progress, completed, cancelled)')
        .option('--parent <number>', 'show subtasks of parent')
        .option('--no-subtasks', 'show only parent tasks')
        .option('--tree', 'show hierarchical tree view')
        .option('--format <format>', 'output format (tree, list, table)')
        .option('--completed', 'include completed tasks')
        .option('--detailed', 'show all task fields and complete information')
        .option('--json', 'output as JSON')
        .action(async (options) => {
            const config = options._config as TodoqConfig;
            const taskService = options._taskService as TaskService;

            try {
                const listOptions: any = {};

                if (options.status) {
                    listOptions.status = options.status as TaskStatus;
                }

                if (options.parent) {
                    listOptions.parentNumber = options.parent;
                }

                if (options.completed || config.display.showCompleted) {
                    listOptions.includeCompleted = true;
                }

                let tasks = taskService.list(listOptions);

                // Filter out subtasks if --no-subtasks is specified
                if (options.noSubtasks) {
                    tasks = tasks.filter(task => !task.parentId);
                }

                if (options.json) {
                    console.log(JSON.stringify(tasks, null, 2));
                } else {
                    const format = options.tree ? 'tree' : (options.format || config.display.format || 'list');
                    const detailed = options.detailed || false;
                    console.log(formatTaskList(tasks, config, format, detailed));
                }
            } catch (error) {
                throw error;
            }
        });
}