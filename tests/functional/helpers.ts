import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { getCliPath } from './setup.js';

export interface CLIResult {
    stdout: string;
    stderr: string;
    code: number;
}

/**
 * Run a CLI command in a specific directory
 */
export async function runCliInDir(
    testDir: string, 
    command: string, 
    options: { expectError?: boolean; timeout?: number } = {}
): Promise<CLIResult> {
    const cliPath = getCliPath();
    const commandArgs = command.split(' ');
    const timeout = options.timeout || 30000;
    
    try {
        const result = await execa('node', [cliPath, ...commandArgs], {
            timeout,
            cwd: testDir,
            stdio: ['inherit', 'pipe', 'pipe'] // Give tool access to stdin while capturing output
        });
        return { stdout: result.stdout, stderr: result.stderr, code: 0 };
    } catch (error: any) {
        if (options.expectError) {
            return { 
                stdout: error.stdout || '', 
                stderr: error.stderr || error.message || '', 
                code: error.exitCode || error.code || 1 
            };
        }
        throw error;
    }
}

/**
 * Create and write a tasks JSON file for testing
 */
export function createTasksFile(testDir: string, filename: string, tasks: any[]): string {
    const taskData = { tasks };
    const filePath = path.join(testDir, filename);
    writeFileSync(filePath, JSON.stringify(taskData, null, 2));
    return filePath;
}

/**
 * Read and parse a JSON config file
 */
export function readConfigFile(testDir: string): any {
    const configPath = path.join(testDir, '.todoqrc');
    if (!existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}`);
    }
    return JSON.parse(readFileSync(configPath, 'utf-8'));
}

/**
 * Check if database file exists and is accessible
 */
export function checkDatabaseExists(testDir: string): boolean {
    const dbPath = path.join(testDir, '.todoq', 'todoq.db');
    return existsSync(dbPath);
}

/**
 * Verify standard TodoQ file structure exists
 */
export function verifyTodoQStructure(testDir: string): {
    configExists: boolean;
    dbExists: boolean;
    todoqDirExists: boolean;
} {
    const configPath = path.join(testDir, '.todoqrc');
    const dbPath = path.join(testDir, '.todoq', 'todoq.db');
    const todoqDir = path.join(testDir, '.todoq');

    return {
        configExists: existsSync(configPath),
        dbExists: existsSync(dbPath),
        todoqDirExists: existsSync(todoqDir)
    };
}

/**
 * Sample task data for testing
 */
export const sampleTasks = {
    simple: [
        { number: '1.0', name: 'Simple Task', status: 'pending', priority: 1 }
    ],
    hierarchical: [
        { number: '1.0', name: 'Parent Task', status: 'pending', priority: 1 },
        { number: '1.1', name: 'Child Task 1', parent: '1.0', status: 'pending', priority: 0 },
        { number: '1.2', name: 'Child Task 2', parent: '1.0', status: 'pending', priority: 0 }
    ],
    withDependencies: [
        { number: '1.0', name: 'Setup Task', status: 'pending', priority: 1 },
        { number: '2.0', name: 'Main Task', status: 'pending', priority: 1, dependencies: ['1.0'] },
        { number: '3.0', name: 'Cleanup Task', status: 'pending', priority: 0, dependencies: ['2.0'] }
    ],
    complex: [
        {
            number: '1.0',
            name: 'Project Setup',
            description: 'Initialize project structure',
            status: 'pending',
            priority: 2,
            files: ['package.json', 'tsconfig.json'],
            docs_references: ['https://docs.example.com'],
            testing_strategy: 'Unit tests for setup functions'
        },
        {
            number: '1.1',
            name: 'Install Dependencies',
            parent: '1.0',
            status: 'pending',
            priority: 1,
            dependencies: []
        },
        {
            number: '2.0',
            name: 'Core Implementation',
            description: 'Implement main features',
            status: 'pending',
            priority: 2,
            dependencies: ['1.0'],
            files: ['src/core.ts']
        }
    ]
};

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Assert that CLI result is successful
 */
export function assertCliSuccess(result: CLIResult, expectedContent?: string): void {
    if (result.code !== 0) {
        throw new Error(`CLI command failed with code ${result.code}. Stderr: ${result.stderr}`);
    }
    
    if (expectedContent && !result.stdout.includes(expectedContent)) {
        throw new Error(`Expected stdout to contain "${expectedContent}", but got: ${result.stdout}`);
    }
}

/**
 * Assert that CLI result is an error
 */
export function assertCliError(result: CLIResult, expectedErrorContent?: string): void {
    if (result.code === 0) {
        throw new Error(`Expected CLI command to fail, but it succeeded. Stdout: ${result.stdout}`);
    }
    
    if (expectedErrorContent && !result.stderr.includes(expectedErrorContent)) {
        throw new Error(`Expected stderr to contain "${expectedErrorContent}", but got: ${result.stderr}`);
    }
}