import { Command } from 'commander';
import { registerInitCommands } from './init.js';
import { registerNavigationCommands } from './navigation.js';
import { registerTaskCommands } from './task.js';
import { registerListCommands } from './list.js';
import { registerImportExportCommands } from './import-export.js';
import { registerConfigCommands } from './config.js';
import { registerStatsCommands } from './stats.js';
import { registerWorkNextCommands } from './work-next.js';

export function registerCommands(program: Command): void {
    // Register command groups
    registerInitCommands(program);
    registerNavigationCommands(program);
    registerTaskCommands(program);
    registerListCommands(program);
    registerImportExportCommands(program);
    registerConfigCommands(program);
    registerStatsCommands(program);
    registerWorkNextCommands(program);
}