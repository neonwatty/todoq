import chalk from 'chalk';
import { Task, TodoqConfig, TaskStats } from '../core/types.js';

export interface FormatOptions {
    compact?: boolean;
    showFiles?: boolean;
    showDates?: boolean;
    showDescription?: boolean;
}

export function formatTask(task: Task, config: TodoqConfig, options: FormatOptions = {}): string {
    const { compact = false, showFiles = true, showDates = true, showDescription = true } = options;
    
    const lines: string[] = [];
    
    // Status icon and task header
    const statusIcon = getStatusIcon(task.status);
    const statusColor = getStatusColor(task.status);
    const priorityText = task.priority > 0 ? chalk.magenta(`[P${task.priority}]`) : '';
    
    const header = `${statusColor(statusIcon)} ${chalk.bold(task.taskNumber)} ${task.name} ${priorityText}`;
    lines.push(header);
    
    if (compact) {
        return lines.join('\n');
    }
    
    // Status and details
    lines.push(`  Status: ${statusColor(task.status)}`);
    
    if (task.description && showDescription) {
        lines.push(`  Description: ${chalk.gray(task.description)}`);
    }
    
    if (task.files && task.files.length > 0 && showFiles) {
        lines.push(`  Files: ${chalk.cyan(task.files.join(', '))}`);
    }
    
    if (task.docsReferences && task.docsReferences.length > 0) {
        lines.push(`  Docs: ${chalk.blue(task.docsReferences.join(', '))}`);
    }
    
    if (task.testingStrategy) {
        lines.push(`  Testing: ${chalk.yellow(task.testingStrategy)}`);
    }
    
    if (task.notes) {
        lines.push(`  Notes: ${chalk.gray(task.notes)}`);
    }
    
    if (task.completionNotes && task.status === 'completed') {
        lines.push(`  Completion: ${chalk.green(task.completionNotes)}`);
    }
    
    if (task.completionPercentage !== undefined && task.completionPercentage > 0) {
        const percentage = Math.round(task.completionPercentage);
        lines.push(`  Progress: ${formatProgressBar(percentage)}`);
    }
    
    if (showDates) {
        lines.push(`  Created: ${chalk.dim(formatDate(task.createdAt))}`);
        if (task.updatedAt && task.createdAt && task.updatedAt.getTime() !== task.createdAt.getTime()) {
            lines.push(`  Updated: ${chalk.dim(formatDate(task.updatedAt))}`);
        }
    }
    
    return lines.join('\n');
}

export function formatTaskList(tasks: Task[], config: TodoqConfig, format: 'tree' | 'list' | 'table' = 'list'): string {
    if (tasks.length === 0) {
        return chalk.yellow('No tasks found');
    }
    
    switch (format) {
        case 'tree':
            return formatTaskTree(tasks, config);
        case 'table':
            return formatTaskTable(tasks, config);
        case 'list':
        default:
            return formatTaskListView(tasks, config);
    }
}

function formatTaskListView(tasks: Task[], config: TodoqConfig): string {
    const lines: string[] = [];
    
    for (const task of tasks) {
        lines.push(formatTask(task, config, { compact: true }));
    }
    
    return lines.join('\n');
}

function formatTaskTree(tasks: Task[], config: TodoqConfig): string {
    // Group tasks by hierarchy
    const taskMap = new Map(tasks.map(t => [t.id!, t]));
    const rootTasks = tasks.filter(t => !t.parentId);
    const lines: string[] = [];
    
    function renderTask(task: Task, level: number = 0): void {
        const indent = '  '.repeat(level);
        const statusIcon = getStatusIcon(task.status);
        const statusColor = getStatusColor(task.status);
        const priorityText = task.priority > 0 ? chalk.magenta(`[P${task.priority}]`) : '';
        
        const line = `${indent}${statusColor(statusIcon)} ${task.taskNumber} ${task.name} ${priorityText}`;
        lines.push(line);
        
        // Find and render children
        const children = tasks.filter(t => t.parentId === task.id);
        for (const child of children.sort((a, b) => a.taskNumber.localeCompare(b.taskNumber))) {
            renderTask(child, level + 1);
        }
    }
    
    for (const rootTask of rootTasks.sort((a, b) => a.taskNumber.localeCompare(b.taskNumber))) {
        renderTask(rootTask);
    }
    
    return lines.join('\n');
}

function formatTaskTable(tasks: Task[], config: TodoqConfig): string {
    // Use cli-table3 for table formatting
    const Table = require('cli-table3');
    
    const table = new Table({
        head: ['Number', 'Name', 'Status', 'Priority', 'Progress'],
        colWidths: [10, 30, 12, 8, 10]
    });
    
    for (const task of tasks) {
        const statusColor = getStatusColor(task.status);
        const progressText = task.completionPercentage !== undefined 
            ? `${Math.round(task.completionPercentage)}%`
            : task.status === 'completed' ? '100%' : '0%';
            
        table.push([
            task.taskNumber,
            task.name.length > 27 ? task.name.substring(0, 24) + '...' : task.name,
            statusColor(task.status),
            task.priority > 0 ? `P${task.priority}` : '',
            progressText
        ]);
    }
    
    return table.toString();
}

export function formatStats(stats: TaskStats): string {
    const lines: string[] = [];
    
    lines.push(chalk.bold('\nTask Statistics:'));
    lines.push(`  Total tasks: ${chalk.cyan(stats.total)}`);
    lines.push(`  Completed: ${chalk.green(stats.completed)}`);
    lines.push(`  In Progress: ${chalk.yellow(stats.inProgress)}`);
    lines.push(`  Pending: ${chalk.blue(stats.pending)}`);
    lines.push(`  Cancelled: ${chalk.red(stats.cancelled)}`);
    lines.push(`  Completion Rate: ${formatCompletionRate(stats.completionRate)}`);
    
    return lines.join('\n');
}

function formatProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const color = percentage >= 80 ? chalk.green : percentage >= 50 ? chalk.yellow : chalk.red;
    
    return `${color(bar)} ${percentage}%`;
}

function formatCompletionRate(rate: number): string {
    const color = rate >= 80 ? chalk.green : rate >= 50 ? chalk.yellow : chalk.red;
    return color(`${rate}%`);
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'completed': return '✓';
        case 'in_progress': return '→';
        case 'cancelled': return '✗';
        case 'pending': 
        default: return '○';
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case 'completed': return chalk.green;
        case 'in_progress': return chalk.yellow;
        case 'cancelled': return chalk.red;
        case 'pending':
        default: return chalk.blue;
    }
}

function formatDate(date?: Date): string {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        return 'Today';
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

export function formatError(error: Error, verbose: boolean = false): string {
    const lines: string[] = [];
    
    lines.push(chalk.red(`Error: ${error.message}`));
    
    if (verbose && error.stack) {
        lines.push(chalk.gray(error.stack));
    }
    
    return lines.join('\n');
}