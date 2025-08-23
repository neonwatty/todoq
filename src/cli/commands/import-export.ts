import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync } from 'fs';
import { TaskService } from '../../core/task.js';
import { TaskValidator, BulkTaskInputSchema } from '../../core/validation.js';
import { TodoqConfig } from '../../core/types.js';

export function registerImportExportCommands(program: Command): void {
    // Import tasks from JSON
    program
        .command('import')
        .alias('add-json')
        .description('Import tasks from JSON file')
        .argument('[file]', 'JSON file path (use - for stdin)')
        .option('--validate-only', 'only validate, do not import')
        .option('--skip-errors', 'skip invalid tasks and continue')
        .action(async (file, options) => {
            const taskService = options._taskService as TaskService;
            const validator = new TaskValidator();

            try {
                let jsonContent: string;

                if (!file || file === '-') {
                    // Read from stdin
                    jsonContent = await readStdin();
                } else {
                    jsonContent = readFileSync(file, 'utf-8');
                }

                const data = JSON.parse(jsonContent);
                
                // Validate JSON schema
                const schemaValidation = BulkTaskInputSchema.safeParse(data);
                if (!schemaValidation.success) {
                    console.log(chalk.red('Invalid JSON format:'));
                    schemaValidation.error.issues.forEach(issue => {
                        console.log(chalk.red(`  ${issue.path.join('.')}: ${issue.message}`));
                    });
                    process.exit(1);
                }

                const tasks = data.tasks;
                console.log(chalk.blue(`Found ${tasks.length} tasks to process`));

                // Validate tasks
                const spinner = ora('Validating tasks...').start();
                const validation = validator.validateImport(tasks);
                spinner.stop();

                if (!validation.valid) {
                    console.log(chalk.red(`\nValidation failed with ${validation.errors.length} errors:`));
                    validation.errors.forEach(error => {
                        console.log(chalk.red(`  Task ${error.task} - ${error.field}: ${error.error}`));
                    });

                    if (!options.skipErrors && !options.validateOnly) {
                        process.exit(1);
                    }
                }

                if (options.validateOnly) {
                    if (validation.valid) {
                        console.log(chalk.green('✓ All tasks are valid!'));
                    }
                    return;
                }

                // Import tasks
                const importSpinner = ora('Importing tasks...').start();
                const result = taskService.bulkInsert(tasks);
                importSpinner.stop();

                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log(chalk.bold('\nImport Results:'));
                    console.log(chalk.green(`  ✓ Inserted: ${result.summary.successful}`));
                    console.log(chalk.yellow(`  ⚠ Skipped: ${result.summary.skipped}`));
                    console.log(chalk.red(`  ✗ Failed: ${result.summary.failed}`));
                    console.log(`  Total: ${result.summary.total}`);

                    if (result.errors.length > 0) {
                        console.log(chalk.red('\nErrors:'));
                        result.errors.forEach(error => {
                            console.log(chalk.red(`  Task ${error.task.number}: ${error.error}`));
                        });
                    }

                    if (result.skipped.length > 0) {
                        console.log(chalk.yellow('\nSkipped:'));
                        result.skipped.forEach(skipped => {
                            console.log(chalk.yellow(`  Task ${skipped.task.number}: ${skipped.reason}`));
                        });
                    }

                    if (result.success) {
                        console.log(chalk.green('\n✓ Import completed successfully!'));
                    } else {
                        console.log(chalk.yellow('\n⚠ Import completed with some errors'));
                    }
                }
            } catch (error) {
                if (error instanceof SyntaxError) {
                    console.log(chalk.red('Invalid JSON format:', error.message));
                    process.exit(1);
                }
                throw error;
            }
        });

    // Bulk validate JSON
    program
        .command('bulk-validate')
        .description('Validate JSON without importing')
        .argument('<file>', 'JSON file path')
        .action(async (file, options) => {
            const validator = new TaskValidator();

            try {
                const jsonContent = readFileSync(file, 'utf-8');
                const data = JSON.parse(jsonContent);

                const schemaValidation = BulkTaskInputSchema.safeParse(data);
                if (!schemaValidation.success) {
                    if (options.json) {
                        console.log(JSON.stringify({ 
                            valid: false, 
                            errors: schemaValidation.error.issues 
                        }, null, 2));
                    } else {
                        console.log(chalk.red('Schema validation failed:'));
                        schemaValidation.error.issues.forEach(issue => {
                            console.log(chalk.red(`  ${issue.path.join('.')}: ${issue.message}`));
                        });
                    }
                    process.exit(1);
                }

                const validation = validator.validateImport(data.tasks);

                if (options.json) {
                    console.log(JSON.stringify(validation, null, 2));
                } else {
                    if (validation.valid) {
                        console.log(chalk.green(`✓ All ${validation.summary.total} tasks are valid!`));
                    } else {
                        console.log(chalk.red(`✗ ${validation.errors.length} validation errors found:`));
                        validation.errors.forEach(error => {
                            console.log(chalk.red(`  Task ${error.task} - ${error.field}: ${error.error}`));
                        });
                    }
                }

                process.exit(validation.valid ? 0 : 1);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    console.log(chalk.red('Invalid JSON format:', error.message));
                    process.exit(1);
                }
                throw error;
            }
        });

    // Export tasks to JSON
    program
        .command('export')
        .description('Export tasks as JSON')
        .option('-f, --file <file>', 'output file path')
        .option('--pretty', 'pretty-printed JSON output')
        .option('--status <status>', 'filter by status')
        .option('--completed', 'include completed tasks')
        .action(async (options) => {
            const config = options._config as TodoqConfig;
            const taskService = options._taskService as TaskService;

            try {
                const listOptions: any = {};

                if (options.status) {
                    listOptions.status = options.status;
                }

                if (options.completed || config.display.showCompleted) {
                    listOptions.includeCompleted = true;
                }

                const tasks = taskService.list(listOptions);

                // Convert tasks to export format
                const exportTasks = tasks.map(task => ({
                    number: task.taskNumber,
                    name: task.name,
                    description: task.description,
                    parent: task.parentId ? tasks.find(t => t.id === task.parentId)?.taskNumber : null,
                    status: task.status,
                    priority: task.priority,
                    docs_references: task.docsReferences,
                    testing_strategy: task.testingStrategy,
                    files: task.files,
                    notes: task.notes,
                    completion_notes: task.completionNotes
                })).filter(task => 
                    // Remove undefined/null values
                    Object.keys(task).reduce((acc: any, key) => {
                        if (task[key as keyof typeof task] !== undefined && task[key as keyof typeof task] !== null) {
                            acc[key] = task[key as keyof typeof task];
                        }
                        return acc;
                    }, {})
                );

                const exportData = { tasks: exportTasks };
                const jsonOutput = options.pretty 
                    ? JSON.stringify(exportData, null, 2)
                    : JSON.stringify(exportData);

                if (options.file) {
                    writeFileSync(options.file, jsonOutput);
                    console.log(chalk.green(`Exported ${tasks.length} tasks to ${options.file}`));
                } else {
                    console.log(jsonOutput);
                }
            } catch (error) {
                throw error;
            }
        });
}

function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = '';
        
        process.stdin.setEncoding('utf8');
        process.stdin.on('readable', () => {
            let chunk;
            while (null !== (chunk = process.stdin.read())) {
                data += chunk;
            }
        });
        
        process.stdin.on('end', () => {
            resolve(data);
        });
        
        process.stdin.on('error', reject);
    });
}