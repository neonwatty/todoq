import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs';
import path from 'path';
import chalk from 'chalk';

export interface ClaudeCommandResult {
    stdout: string;
    stderr: string;
    code: number;
    command: string;
    duration: number;
}

/**
 * Debug logging with chalk colors and timestamps
 */
export function debugStep(category: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const colorMap: Record<string, chalk.Chalk> = {
        'setup': chalk.blue,
        'generate': chalk.green,
        'show': chalk.yellow,
        'work': chalk.magenta,
        'cleanup': chalk.red,
        'error': chalk.redBright,
        'success': chalk.greenBright,
        'info': chalk.cyan
    };
    
    const colorFn = colorMap[category] || chalk.white;
    console.log(colorFn(`[${timestamp}] [${category.toUpperCase()}] ${message}`));
    
    if (data) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
    }
}

/**
 * Execute a Claude Code command with comprehensive logging
 */
/**
 * Get the path to Claude Code CLI
 */
async function getClaudePath(): Promise<string | null> {
    // First try the standard PATH-based approach
    try {
        await execa('claude', ['--version'], { timeout: 5000 });
        return 'claude'; // Available in PATH
    } catch (pathError: any) {
        // If that fails, try common Claude Code installation paths
        const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
        const possiblePaths = [
            `${homeDir}/.claude/local/claude`,
            '/usr/local/bin/claude',
            '/opt/homebrew/bin/claude',
            // Windows paths
            `${process.env.APPDATA}/claude/claude.exe`,
            `${process.env.LOCALAPPDATA}/claude/claude.exe`
        ];
        
        for (const claudePath of possiblePaths) {
            try {
                await execa(claudePath, ['--version'], { timeout: 5000 });
                return claudePath;
            } catch (error: any) {
                continue;
            }
        }
        
        return null;
    }
}

/**
 * Check if Claude Code is available in the current environment
 */
export async function isClaudeCodeAvailable(): Promise<boolean> {
    const claudePath = await getClaudePath();
    return claudePath !== null;
}

export async function runTodoqCommand(
    testDir: string,
    command: string,
    options: { expectError?: boolean; timeout?: number; skipIfNotAvailable?: boolean; allowCommandHang?: boolean } = {}
): Promise<ClaudeCommandResult> {
    const startTime = Date.now();
    
    // Find the project root and CLI binary
    const projectRoot = path.dirname(path.dirname(__dirname)); // Go up from tests/claude to project root
    const todoCLIPath = path.join(projectRoot, 'dist', 'cli', 'index.js');
    
    // Verify CLI exists before executing
    if (!existsSync(todoCLIPath)) {
        throw new Error(`TodoQ CLI not found at ${todoCLIPath}`);
    }
    
    // Create isolated database config for this test
    const testId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dbPath = `.todoq/test-${testId}.db`;
    const configPath = path.join(testDir, '.todoqrc');
    
    // Create .todoqrc with isolated database path if it doesn't exist
    if (!existsSync(configPath)) {
        const config = {
            database: {
                path: dbPath,
                autoMigrate: true,
                walMode: true
            },
            display: {
                format: 'tree',
                colors: true,
                showCompleted: false
            },
            defaults: {
                status: 'pending',
                priority: 0
            }
        };
        writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    
    // Execute TodoQ directly with isolated config
    const commandArgs = command.split(' ');
    const timeout = options.timeout || 30000;
    
    try {
        const result = await execa('node', [
            todoCLIPath,
            '--config', configPath,
            ...commandArgs
        ], {
            cwd: testDir,
            timeout,
            reject: false, // Don't throw on non-zero exit codes
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        const duration = Date.now() - startTime;
        const { stdout, stderr, exitCode } = result;
        const finalExitCode = exitCode ?? 0; // Handle undefined exit codes
        
        // Handle successful completion (exit code 0)
        if (finalExitCode === 0) {
            return { 
                stdout, 
                stderr, 
                code: finalExitCode, 
                command: `todoq ${command}`,
                duration
            };
        }
        
        // Handle non-zero exit codes (might be expected)
        if (options.expectError) {
            return { 
                stdout, 
                stderr, 
                code: finalExitCode, 
                command: `todoq ${command}`,
                duration
            };
        }
        
        // Non-zero exit code when not expected - treat as error
        throw new Error(`TodoQ command failed with exit code ${finalExitCode}: ${stderr || stdout}`);
    } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Handle expected errors gracefully
        if (options.expectError || options.allowCommandHang) {
            return { 
                stdout: error.stdout || '', 
                stderr: error.stderr || error.message || '', 
                code: error.exitCode ?? 1, // Handle undefined exit codes
                command: `todoq ${command}`,
                duration
            };
        }
        
        throw error;
    }
}

// Keep the old function name for backward compatibility but redirect to new implementation
export async function executeClaudeCommand(
    testDir: string,
    commandName: string,
    args: string = '',
    options: { expectError?: boolean; timeout?: number; skipIfNotAvailable?: boolean; allowCommandHang?: boolean } = {}
): Promise<ClaudeCommandResult> {
    // For work-next commands, we still need Claude Code availability check
    if (commandName.includes('work-next')) {
        const claudeAvailable = await isClaudeCodeAvailable();
        if (!claudeAvailable && options.skipIfNotAvailable) {
            return {
                stdout: 'SKIPPED: Claude Code not available',
                stderr: 'Claude Code not found in test environment',
                code: options.expectError ? 1 : 0,
                command: `[SKIPPED] todoq ${commandName}${args ? ' ' + args : ''}`,
                duration: 0
            };
        }
        if (!claudeAvailable) {
            throw new Error(`Claude Code not available in test environment (command: ${commandName})`);
        }
    }
    
    // Build full command
    const fullCommand = args ? `${commandName} ${args}` : commandName;
    return runTodoqCommand(testDir, fullCommand, options);
}

/**
 * Copy a fixture file to the test directory
 */
export function createFixtureInTestDir(
    testDir: string, 
    fixtureName: string, 
    targetName?: string
): string {
    const fixturePath = path.join(__dirname, '../functional/fixtures', fixtureName);
    const targetPath = path.join(testDir, targetName || fixtureName);
    
    if (!existsSync(fixturePath)) {
        throw new Error(`Fixture not found: ${fixturePath}`);
    }
    
    copyFileSync(fixturePath, targetPath);
    return targetPath;
}

/**
 * Verify test isolation by checking directory structure
 */
export function verifyIsolation(testDir: string): {
    isIsolated: boolean;
    hasOwnTodoq: boolean;
    hasOwnConfig: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    
    // Check if we're in a temp directory (includes macOS /var/folders/ and common temp paths)
    const isIsolated = testDir.includes('tmp') || testDir.includes('temp') || 
                      testDir.includes('/var/folders/') || testDir.includes('todoq-functional-test');
    if (!isIsolated) {
        issues.push('Test directory is not in a temporary location');
    }
    
    // Check for independent TodoQ setup
    const configPath = path.join(testDir, '.todoqrc');
    const dbPath = path.join(testDir, '.todoq', 'todoq.db');
    
    const hasOwnConfig = existsSync(configPath);
    const hasOwnTodoq = existsSync(dbPath);
    
    if (!hasOwnConfig) {
        issues.push('Test directory missing .todoqrc config');
    }
    
    if (!hasOwnTodoq) {
        issues.push('Test directory missing todoq.db database');
    }
    
    // Silent verification - details logged only if needed
    
    return {
        isIsolated,
        hasOwnTodoq,
        hasOwnConfig,
        issues
    };
}

/**
 * Validate TodoQ command output for expected patterns
 */
export function validateTodoqOutput(output: string, expectedPatterns: string[]): {
    isValid: boolean;
    matchedPatterns: string[];
    missingPatterns: string[];
} {
    const matchedPatterns: string[] = [];
    const missingPatterns: string[] = [];
    
    for (const pattern of expectedPatterns) {
        if (output.includes(pattern)) {
            matchedPatterns.push(pattern);
        } else {
            missingPatterns.push(pattern);
        }
    }
    
    const isValid = missingPatterns.length === 0;
    
    // Silent validation - return results for caller to handle
    
    return {
        isValid,
        matchedPatterns,
        missingPatterns
    };
}

/**
 * Wait for TodoQ database to be ready
 */
export async function waitForTodoqReady(
    testDir: string,
    timeout: number = 10000
): Promise<boolean> {
    const dbPath = path.join(testDir, '.todoq', 'todoq.db');
    const configPath = path.join(testDir, '.todoqrc');
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
        if (existsSync(dbPath) && existsSync(configPath)) {
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
}