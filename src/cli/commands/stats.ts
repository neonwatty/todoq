import { Command } from 'commander';
import { TaskService } from '../../core/task.js';
import { NavigationService } from '../../core/navigation.js';
import { formatStats } from '../formatters.js';

export function registerStatsCommands(program: Command): void {
    // Task statistics
    program
        .command('stats')
        .description('Show task statistics')
        .option('--json', 'output as JSON')
        .action(async (options) => {
            const taskService = options._taskService as TaskService;

            try {
                const stats = taskService.getStats();

                if (options.json) {
                    console.log(JSON.stringify(stats, null, 2));
                } else {
                    console.log(formatStats(stats));
                }
            } catch (error) {
                throw error;
            }
        });

    // Status command (overall project status)
    program
        .command('status')
        .description('Overall project status summary')
        .option('--json', 'output as JSON')
        .action(async (options) => {
            const taskService = options._taskService as TaskService;
            const navigationService = options._navigationService as NavigationService;

            try {
                const stats = taskService.getStats();
                const currentTask = navigationService.getCurrentTask();
                const remaining = navigationService.getRemainingTaskCount();

                if (options.json) {
                    const status = {
                        stats,
                        currentTask,
                        remaining,
                        lastUpdated: new Date().toISOString()
                    };
                    console.log(JSON.stringify(status, null, 2));
                } else {
                    console.log(formatStats(stats));
                    console.log('');
                    
                    if (currentTask) {
                        console.log(`Current task: ${currentTask.taskNumber} ${currentTask.name}`);
                    }
                    
                    console.log(`Remaining tasks: ${remaining}`);
                    
                    if (stats.total > 0) {
                        const progress = Math.round((stats.completed / stats.total) * 100);
                        console.log(`Overall progress: ${progress}%`);
                    }
                }
            } catch (error) {
                throw error;
            }
        });
}