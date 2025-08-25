import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
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

export async function executeClaudeCommand(
    testDir: string,
    commandName: string,
    args: string = '',
    options: { expectError?: boolean; timeout?: number; skipIfNotAvailable?: boolean; allowCommandHang?: boolean } = {}
): Promise<ClaudeCommandResult> {
    const startTime = Date.now();
    
    // Get the path to Claude Code
    const claudePath = await getClaudePath();
    if (!claudePath) {
        const duration = Date.now() - startTime;
        
        if (options.skipIfNotAvailable) {
            return {
                stdout: 'SKIPPED: Claude Code not available',
                stderr: 'Claude Code not found in test environment',
                code: options.expectError ? 1 : 0,
                command: `[SKIPPED] claude --dangerously-skip-permissions -p "/todoq:${commandName}${args ? ' ' + args : ''}"`,
                duration
            };
        }
        
        throw new Error(`Claude Code not available in test environment (command: ${commandName})`);
    }
    
    // Find the project root and CLI binary
    const projectRoot = path.dirname(path.dirname(__dirname)); // Go up from tests/functional to project root
    const todoCLIPath = path.join(projectRoot, 'dist', 'cli', 'index.js');
    
    // Create a todoq wrapper script in the test directory
    const todoqWrapperPath = path.join(testDir, 'todoq');
    const wrapperScript = `#!/bin/bash\nnode "${todoCLIPath}" "$@"`;
    require('fs').writeFileSync(todoqWrapperPath, wrapperScript);
    require('fs').chmodSync(todoqWrapperPath, '755');
    
    // Set up environment with TodoQ wrapper in PATH
    // Disable hooks to prevent post-execution delays in test environment
    const claudeArgs = ['--dangerously-skip-permissions', '--debug', '-p', `/todoq:${commandName}`];
    if (args) {
        claudeArgs.push(args);
    }
    const timeout = options.timeout || 30000; // 30 second timeout - optimized for Claude Code integration tests
    
    // Verify CLI exists before executing
    if (!existsSync(todoCLIPath)) {
        throw new Error(`TodoQ CLI not found at ${todoCLIPath}`);
    }
    
    try {
        const execStart = Date.now();
        
        const result = await execa(claudePath, claudeArgs, {
            timeout,
            cwd: testDir,
            reject: false, // Don't throw on non-zero exit codes
            stdio: ['inherit', 'pipe', 'pipe'], // Give tool access to stdin while capturing output
            env: {
                ...process.env,
                PATH: `${testDir}:${process.env.PATH}`,
                CLAUDE_HOOKS_DISABLED: '1'
            }
        });
        
        const duration = Date.now() - startTime;
        const execDuration = Date.now() - execStart;
        const { stdout, stderr, exitCode } = result;
        
        // Handle successful completion (exit code 0)
        if (exitCode === 0) {
            return { 
                stdout, 
                stderr, 
                code: exitCode, 
                command: `${claudePath} ${claudeArgs.join(' ')}`,
                duration
            };
        }
        
        // Handle non-zero exit codes (might be expected)
        if (options.expectError) {
            return { 
                stdout, 
                stderr, 
                code: exitCode, 
                command: `${claudePath} ${claudeArgs.join(' ')}`,
                duration
            };
        }
        
        // Non-zero exit code when not expected - treat as error
        throw new Error(`Claude command failed with exit code ${exitCode}: ${stderr || stdout}`);
    } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Handle expected errors gracefully
        if (options.expectError || options.allowCommandHang) {
            return { 
                stdout: error.stdout || '', 
                stderr: error.stderr || error.message || '', 
                code: error.exitCode || 1,
                command: `${claudePath} ${claudeArgs.join(' ')}`,
                duration
            };
        }
        
        throw error;
    }
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