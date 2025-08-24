import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { getDefaultConfig } from '../../adapters/config/index.js';
import { TodoqConfig } from '../../core/types.js';

export function registerInitCommands(program: Command): void {
    program
        .command('init')
        .description('Initialize database and config')
        .option('-i, --interactive', 'interactive setup with prompts')
        .option('--from-json <file>', 'initialize from existing JSON')
        .action(async (options) => {
            try {
                console.log(chalk.bold.blue('Initializing TodoQ...'));

                let config = getDefaultConfig();

                if (options.interactive) {
                    config = await interactiveSetup(config);
                }

                // Ensure database directory exists
                const dbDir = path.dirname(config.database.path);
                if (!existsSync(dbDir)) {
                    mkdirSync(dbDir, { recursive: true });
                    console.log(chalk.green(`Created directory: ${dbDir}`));
                }

                // Create default config file
                const configPath = path.join(process.cwd(), '.todoqrc.json');
                if (!existsSync(configPath)) {
                    writeFileSync(configPath, JSON.stringify(config, null, 2));
                    console.log(chalk.green(`Created config file: ${configPath}`));
                }

                // Initialize database (will be done by the preAction hook)
                console.log(chalk.green('Database initialized successfully!'));

                if (options.fromJson) {
                    console.log(chalk.blue(`\nTo import tasks, run: todoq import ${options.fromJson}`));
                }

                console.log(chalk.blue('\nTodoQ is ready to use! Try these commands:'));
                console.log('  todoq template    # Generate a task template');
                console.log('  todoq import      # Import tasks from JSON');
                console.log('  todoq current     # Show current task');
                console.log('  todoq list        # List all tasks');
                console.log('  todoq help        # Show all commands');
            } catch (error) {
                throw error;
            }
        });

    program
        .command('template')
        .description('Generate empty JSON template')
        .option('-i, --interactive', 'interactive template creation')
        .option('-o, --output <file>', 'output file path')
        .action(async (options) => {
            try {
                let template: any;

                if (options.interactive) {
                    template = await createInteractiveTemplate();
                } else {
                    template = getDefaultTemplate();
                }

                const output = JSON.stringify(template, null, 2);

                if (options.output) {
                    writeFileSync(options.output, output);
                    console.log(chalk.green(`Template written to ${options.output}`));
                } else {
                    console.log(output);
                }
            } catch (error) {
                throw error;
            }
        });
}

async function interactiveSetup(defaultConfig: TodoqConfig): Promise<TodoqConfig> {
    console.log(chalk.yellow('\nInteractive setup - press Enter to use defaults\n'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'databasePath',
            message: 'Database path:',
            default: defaultConfig.database.path,
            validate: (input: string) => input.length > 0 || 'Database path is required'
        },
        {
            type: 'list',
            name: 'displayFormat',
            message: 'Default display format:',
            choices: ['tree', 'list', 'table'],
            default: defaultConfig.display.format
        },
        {
            type: 'confirm',
            name: 'showColors',
            message: 'Use colors in output?',
            default: defaultConfig.display.colors
        },
        {
            type: 'confirm',
            name: 'showCompleted',
            message: 'Show completed tasks by default?',
            default: defaultConfig.display.showCompleted
        },
        {
            type: 'list',
            name: 'defaultStatus',
            message: 'Default status for new tasks:',
            choices: ['pending', 'in_progress'],
            default: defaultConfig.defaults.status
        },
        {
            type: 'number',
            name: 'defaultPriority',
            message: 'Default priority for new tasks (0-10):',
            default: defaultConfig.defaults.priority,
            validate: (input: number) => (input >= 0 && input <= 10) || 'Priority must be between 0 and 10'
        }
    ]);

    return {
        database: {
            path: answers.databasePath,
            autoMigrate: defaultConfig.database.autoMigrate,
            walMode: defaultConfig.database.walMode
        },
        display: {
            format: answers.displayFormat,
            colors: answers.showColors,
            showCompleted: answers.showCompleted
        },
        defaults: {
            status: answers.defaultStatus,
            priority: answers.defaultPriority
        }
    };
}

async function createInteractiveTemplate(): Promise<any> {
    console.log(chalk.yellow('\nCreating interactive template...\n'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: 'My Project'
        },
        {
            type: 'number',
            name: 'taskCount',
            message: 'Number of sample tasks to create:',
            default: 3,
            validate: (input: number) => input > 0 || 'Must create at least 1 task'
        }
    ]);

    const tasks = [];
    
    for (let i = 1; i <= answers.taskCount; i++) {
        const taskAnswers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: `Task ${i} name:`,
                default: `Task ${i}: ${answers.projectName} feature`
            },
            {
                type: 'input',
                name: 'description',
                message: `Task ${i} description:`
            },
            {
                type: 'list',
                name: 'priority',
                message: `Task ${i} priority:`,
                choices: [
                    { name: 'Low (0)', value: 0 },
                    { name: 'Medium (1)', value: 1 },
                    { name: 'High (2)', value: 2 }
                ],
                default: 0
            }
        ]);

        tasks.push({
            number: `${i}.0`,
            name: taskAnswers.name,
            description: taskAnswers.description || undefined,
            status: 'pending',
            priority: taskAnswers.priority
        });
    }

    return { tasks };
}

function getDefaultTemplate(): any {
    return {
        tasks: [
            {
                number: '1.0',
                name: 'Project Setup',
                description: 'Initialize project structure and dependencies',
                status: 'pending',
                priority: 1,
                docs_references: [],
                testing_strategy: 'Unit tests for core functionality',
                dependencies: [],
                files: [],
                notes: 'This is a sample task'
            },
            {
                number: '1.1',
                name: 'Setup Configuration',
                description: 'Create configuration files',
                parent: '1.0',
                status: 'pending',
                priority: 0,
                dependencies: []
            },
            {
                number: '1.2',
                name: 'Install Dependencies',
                description: 'Install required packages',
                parent: '1.0',
                status: 'pending',
                priority: 0,
                dependencies: ['1.1']
            },
            {
                number: '2.0',
                name: 'Core Implementation',
                description: 'Implement main features',
                status: 'pending',
                priority: 2,
                dependencies: ['1.0']
            }
        ]
    };
}