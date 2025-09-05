import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { TodoqConfig } from '../../core/types.js';
import { getDefaultConfig } from '../../adapters/config/index.js';

export function registerConfigCommands(program: Command): void {
    const configCmd = program
        .command('config')
        .description('Configuration management');

    // Get config value
    configCmd
        .command('get')
        .description('Get configuration value')
        .argument('<key>', 'configuration key (e.g., database.path)')
        .action(async (key, options) => {
            const config = options._config as TodoqConfig;

            try {
                const value = getConfigValue(config, key);

                if (options.json) {
                    console.log(JSON.stringify({ key, value }, null, 2));
                } else {
                    if (value !== undefined) {
                        console.log(value);
                    } else {
                        console.log(chalk.red(`Configuration key "${key}" not found`));
                    }
                }
            } catch (error) {
                throw error;
            }
        });

    // Set config value
    configCmd
        .command('set')
        .description('Set configuration value')
        .argument('<key=value>', 'configuration key-value pair')
        .action(async (keyValue) => {
            try {
                const [key, ...valueParts] = keyValue.split('=');
                const value = valueParts.join('=');

                if (!key || value === undefined) {
                    console.log(chalk.red('Invalid format. Use: key=value'));
                    return;
                }

                // Parse value based on type
                let parsedValue: any = value;
                if (value === 'true') parsedValue = true;
                else if (value === 'false') parsedValue = false;
                else if (/^\d+$/.test(value)) parsedValue = parseInt(value);
                else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

                // Update config file
                const configPath = findConfigFile();
                let config = getDefaultConfig();

                if (configPath && existsSync(configPath)) {
                    const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
                    config = { ...config, ...existingConfig };
                }

                setConfigValue(config, key, parsedValue);

                const outputPath = configPath || path.join(process.cwd(), '.todoqrc.json');
                writeFileSync(outputPath, JSON.stringify(config, null, 2));

                console.log(chalk.green(`Set ${key} = ${parsedValue}`));
                console.log(chalk.dim(`Updated ${outputPath}`));
            } catch (error) {
                throw error;
            }
        });

    // List all config
    configCmd
        .command('list')
        .alias('show')
        .description('Show all configuration')
        .option('--json', 'output as JSON')
        .action(async (options) => {
            const config = options._config as TodoqConfig;

            if (options.json) {
                console.log(JSON.stringify(config, null, 2));
            } else {
                console.log(chalk.bold('TodoQ Configuration:'));
                console.log('');
                printConfigSection('Database', config.database);
                printConfigSection('Display', config.display);
                printConfigSection('Defaults', config.defaults);
                if (config.claude) {
                    printConfigSection('Claude', config.claude);
                }
            }
        });

    // Edit config file
    configCmd
        .command('edit')
        .description('Open config in editor')
        .action(async (options) => {
            try {
                let configPath = findConfigFile();
                
                if (!configPath) {
                    configPath = path.join(process.cwd(), '.todoqrc.json');
                    const defaultConfig = getDefaultConfig();
                    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
                    console.log(chalk.green(`Created config file: ${configPath}`));
                }

                const editor = process.env.EDITOR || process.env.VISUAL || 'vim';
                
                try {
                    execSync(`${editor} "${configPath}"`, { stdio: 'inherit' });
                } catch (error) {
                    console.log(chalk.red('Failed to open editor. Try setting EDITOR environment variable.'));
                }
            } catch (error) {
                throw error;
            }
        });

    // Reset config to defaults
    configCmd
        .command('reset')
        .description('Reset configuration to defaults')
        .option('-f, --force', 'skip confirmation')
        .action(async (options) => {
            try {
                if (!options.force) {
                    const inquirer = await import('inquirer');
                    const { confirmed } = await inquirer.default.prompt([{
                        type: 'confirm',
                        name: 'confirmed',
                        message: 'Reset configuration to defaults?',
                        default: false
                    }]);

                    if (!confirmed) {
                        console.log(chalk.yellow('Cancelled'));
                        return;
                    }
                }

                const configPath = findConfigFile() || path.join(process.cwd(), '.todoqrc.json');
                const defaultConfig = getDefaultConfig();
                
                writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
                console.log(chalk.green(`Reset configuration to defaults: ${configPath}`));
            } catch (error) {
                throw error;
            }
        });
}

function getConfigValue(config: any, key: string): any {
    const keys = key.split('.');
    let current = config;

    for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
            current = current[k];
        } else {
            return undefined;
        }
    }

    return current;
}

function setConfigValue(config: any, key: string, value: any): void {
    const keys = key.split('.');
    let current = config;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
            current[k] = {};
        }
        current = current[k];
    }

    current[keys[keys.length - 1]] = value;
}

function printConfigSection(title: string, section: any): void {
    console.log(chalk.blue(`${title  }:`));
    Object.entries(section).forEach(([key, value]) => {
        console.log(`  ${chalk.cyan(key)}: ${chalk.white(String(value))}`);
    });
    console.log('');
}

function findConfigFile(): string | null {
    const possiblePaths = [
        '.todoqrc.json',
        '.todoqrc',
        'todoq.config.json',
        'todoq.config.js'
    ];

    for (const p of possiblePaths) {
        const fullPath = path.join(process.cwd(), p);
        if (existsSync(fullPath)) {
            return fullPath;
        }
    }

    return null;
}