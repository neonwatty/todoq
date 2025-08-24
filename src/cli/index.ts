#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../adapters/config/index.js';
import { DatabaseClient } from '../adapters/database/client.js';
import { MigrationManager } from '../adapters/database/migrations.js';
import { TaskService } from '../core/task.js';
import { NavigationService } from '../core/navigation.js';
import { TodoqError } from '../core/types.js';
import { registerCommands } from './commands/index.js';
import { getPackageVersion } from './version.js';

const program = new Command();

// Global error handler
function handleError(error: unknown): void {
    if (error instanceof TodoqError) {
        console.error(chalk.red(`Error (${error.code}): ${error.message}`));
        if (error.details && process.env.DEBUG) {
            console.error('Details:', JSON.stringify(error.details, null, 2));
        }
        process.exit(1);
    } else if (error instanceof Error) {
        console.error(chalk.red('Unexpected error:', error.message));
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    } else {
        console.error(chalk.red('Unknown error occurred'));
        process.exit(1);
    }
}

// Setup global options and hooks
program
    .name('todoq')
    .description('Hierarchical task management CLI with SQLite backend')
    .version(getPackageVersion())
    .option('-c, --config <path>', 'config file path')
    .option('--json', 'output as JSON')
    .option('-v, --verbose', 'verbose output')
    .hook('preAction', async (thisCommand, actionCommand) => {
        try {
            const options = thisCommand.opts();
            
            // Load configuration
            const config = await loadConfig(options.config);
            
            // Initialize database if needed
            const db = new DatabaseClient(config.database.path);
            
            // Only run migrations if auto-migrate is enabled and not for template command
            if (config.database.autoMigrate && actionCommand.name() !== 'template') {
                try {
                    const migrationManager = new MigrationManager(db);
                    migrationManager.initialize();
                } catch (migrationError) {
                    // For init command, this is expected - we'll handle it there
                    if (actionCommand.name() !== 'init') {
                        throw migrationError;
                    }
                }
            }

            // Create services
            const taskService = new TaskService(db);
            const navigationService = new NavigationService(db);

            // Attach to command context
            actionCommand.setOptionValue('_config', config);
            actionCommand.setOptionValue('_db', db);
            actionCommand.setOptionValue('_taskService', taskService);
            actionCommand.setOptionValue('_navigationService', navigationService);
        } catch (error) {
            handleError(error);
        }
    })
    .hook('postAction', (thisCommand, actionCommand) => {
        // Cleanup database connections
        const db = actionCommand.getOptionValue('_db') as DatabaseClient;
        if (db && db.isOpen) {
            db.close();
        }
    });

// Register all commands
registerCommands(program);

// Global error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error.message);
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
    process.exit(1);
});

// Main execution function
async function main() {
    try {
        await program.parseAsync();
    } catch (error) {
        handleError(error);
    }
}

// Execute main function
main();