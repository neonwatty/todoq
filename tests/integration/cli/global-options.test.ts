import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { readFileSync } from 'fs';

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), 'dist', 'cli', 'index.js');

// Helper function to run CLI commands
async function runCLI(command: string, options: { expectError?: boolean; cwd?: string } = {}): Promise<{ stdout: string; stderr: string; code: number }> {
    const fullCommand = `node "${CLI_PATH}" ${command}`;
    
    try {
        const { stdout, stderr } = await execAsync(fullCommand, {
            cwd: options.cwd || process.cwd()
        });
        return { stdout, stderr, code: 0 };
    } catch (error: any) {
        if (options.expectError) {
            return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code || 1 };
        }
        throw error;
    }
}

describe('CLI Global Options Integration Tests', () => {
    beforeEach(() => {
        // Ensure CLI is built
        if (!existsSync(CLI_PATH)) {
            throw new Error(`CLI not found at ${CLI_PATH}. Please run 'npm run build' first.`);
        }
    });

    describe('Version Command Integration', () => {
        it('should return consistent version across different invocations', async () => {
            const results = await Promise.all([
                runCLI('--version'),
                runCLI('-V')
            ]);

            // All should succeed
            results.forEach(result => {
                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
            });

            // All should return the same version
            const versions = results.map(r => r.stdout.trim());
            expect(versions[0]).toBe(versions[1]);
            
            // Version should match package.json
            const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
            expect(versions[0]).toBe(packageJson.version);
        });

        it('should work from different working directories', async () => {
            const tempDir = require('os').tmpdir();
            
            const result = await runCLI('--version', { cwd: tempDir });
            
            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
            
            // Should match package.json version regardless of working directory
            const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
            expect(result.stdout.trim()).toBe(packageJson.version);
        });

        it('should be fast and not perform heavy operations', async () => {
            const startTime = Date.now();
            
            const result = await runCLI('--version');
            
            const duration = Date.now() - startTime;
            
            expect(result.code).toBe(0);
            // Version should be returned quickly (under 2 seconds)
            expect(duration).toBeLessThan(2000);
        });

        it('should not create any files or side effects', async () => {
            const tempDir = path.join(require('os').tmpdir(), `todoq-version-test-${Date.now()}`);
            require('fs').mkdirSync(tempDir, { recursive: true });
            
            try {
                const result = await runCLI('--version', { cwd: tempDir });
                
                expect(result.code).toBe(0);
                
                // Check that no TodoQ files were created
                const todoqDir = path.join(tempDir, '.todoq');
                const configFile = path.join(tempDir, '.todoqrc');
                
                expect(existsSync(todoqDir)).toBe(false);
                expect(existsSync(configFile)).toBe(false);
                
                // Check directory contents - should be empty
                const files = require('fs').readdirSync(tempDir);
                expect(files).toHaveLength(0);
            } finally {
                // Cleanup
                require('fs').rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Help Command Integration', () => {
        it('should display comprehensive help information', async () => {
            const result = await runCLI('--help');
            
            expect(result.code).toBe(0);
            
            // Should contain key help sections
            expect(result.stdout).toContain('Usage:');
            expect(result.stdout).toContain('Hierarchical task management CLI');
            expect(result.stdout).toContain('Options:');
            expect(result.stdout).toContain('Commands:');
            
            // Should mention key commands
            expect(result.stdout).toContain('init');
            expect(result.stdout).toContain('list');
            expect(result.stdout).toContain('import');
            expect(result.stdout).toContain('export');
        });

        it('should work with short flag', async () => {
            const result = await runCLI('-h');
            
            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Usage:');
            expect(result.stdout).toContain('Commands:');
        });

        it('should not create files when showing help', async () => {
            const tempDir = path.join(require('os').tmpdir(), `todoq-help-test-${Date.now()}`);
            require('fs').mkdirSync(tempDir, { recursive: true });
            
            try {
                const result = await runCLI('--help', { cwd: tempDir });
                
                expect(result.code).toBe(0);
                
                // Check that no TodoQ files were created
                const files = require('fs').readdirSync(tempDir);
                expect(files).toHaveLength(0);
            } finally {
                require('fs').rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle invalid global options', async () => {
            const result = await runCLI('--invalid-global-option', { expectError: true });
            
            expect(result.code).not.toBe(0);
            expect(result.stderr).toContain('unknown option');
        });

        it('should handle conflicting options gracefully', async () => {
            // Test what happens when version and help are both specified
            const result = await runCLI('--version --help');
            
            // Commander typically processes the first option it encounters
            expect(result.code).toBe(0);
            // Should either show version or help, not error
            expect(result.stdout).toBeTruthy();
        });
    });

    describe('Command Precedence Integration', () => {
        it('should handle global options with command arguments', async () => {
            // Global options should take precedence over commands
            const result = await runCLI('--version init help');
            
            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
        });

        it('should process version flag early in parsing', async () => {
            // Even with potentially problematic arguments, version should work
            const result = await runCLI('--version --invalid-flag nonexistent-command');
            
            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
        });
    });

    describe('Output Format Integration', () => {
        it('should output clean version string without extra formatting', async () => {
            const result = await runCLI('--version');
            
            expect(result.code).toBe(0);
            
            const version = result.stdout.trim();
            // Should be just the version, no extra text
            expect(version).toMatch(/^\d+\.\d+\.\d+$/);
            
            // Should not contain ANSI color codes or extra whitespace
            expect(version).not.toContain('\u001b[');
            expect(version.split('\n')).toHaveLength(1);
        });

        it('should handle JSON flag with version (if implemented)', async () => {
            // Test if --json affects version output
            const result = await runCLI('--version --json', { expectError: true });
            
            // Either it should work or fail gracefully
            if (result.code === 0) {
                // If it works, output should still be the version
                expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
            } else {
                // If it fails, should be a reasonable error about incompatible flags
                expect(result.stderr).toBeTruthy();
            }
        });
    });

    describe('Performance Integration', () => {
        it('should handle multiple rapid version requests', async () => {
            // Test rapid sequential calls
            const promises = Array.from({ length: 5 }, () => runCLI('--version'));
            
            const results = await Promise.all(promises);
            
            results.forEach(result => {
                expect(result.code).toBe(0);
                expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
            });
            
            // All should return the same version
            const versions = results.map(r => r.stdout.trim());
            const uniqueVersions = [...new Set(versions)];
            expect(uniqueVersions).toHaveLength(1);
        });
    });
});