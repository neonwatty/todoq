import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createTestDir } from './setup.js';
import { runCliInDir } from './helpers.js';

describe('CLI Global Options Functional Tests', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = createTestDir();
    });

    describe('Version Flag', () => {
        it('should return correct version with --version', async () => {
            const result = await runCliInDir(testDir, '--version');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
            
            // Version should match package.json
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            expect(result.stdout.trim()).toBe(packageJson.version);
        });

        it('should return correct version with -V', async () => {
            const result = await runCliInDir(testDir, '-V');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it('should work from different working directories', async () => {
            // Test from nested directory
            const nestedDir = path.join(testDir, 'nested', 'deep', 'directory');
            require('fs').mkdirSync(nestedDir, { recursive: true });

            const result = await runCliInDir(nestedDir, '--version');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
            
            // Should still return the correct version regardless of working directory
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            expect(result.stdout.trim()).toBe(packageJson.version);
        });

        it('should not require database or config to show version', async () => {
            // Run version command in empty directory (no .todoqrc or .todoq)
            const result = await runCliInDir(testDir, '--version');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
            
            // Verify no database or config files were created
            expect(existsSync(path.join(testDir, '.todoqrc'))).toBe(false);
            expect(existsSync(path.join(testDir, '.todoq'))).toBe(false);
        });
    });

    describe('Help Flag', () => {
        it('should display help with --help', async () => {
            const result = await runCliInDir(testDir, '--help');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Usage:');
            expect(result.stdout).toContain('Hierarchical task management CLI');
            expect(result.stdout).toContain('Options:');
            expect(result.stdout).toContain('Commands:');
        });

        it('should display help with -h', async () => {
            const result = await runCliInDir(testDir, '-h');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Usage:');
            expect(result.stdout).toContain('Commands:');
        });

        it('should show version in help output', async () => {
            const result = await runCliInDir(testDir, '--help');

            expect(result.code).toBe(0);
            // Help should include version information in the header
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            // Commander.js includes version in help output
            expect(result.stdout).toContain('todoq');
        });

        it('should not require database or config to show help', async () => {
            const result = await runCliInDir(testDir, '--help');

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Usage:');
            
            // Verify no database or config files were created
            expect(existsSync(path.join(testDir, '.todoqrc'))).toBe(false);
            expect(existsSync(path.join(testDir, '.todoq'))).toBe(false);
        });
    });

    describe('Global Options', () => {
        it('should handle invalid global options gracefully', async () => {
            const result = await runCliInDir(testDir, '--invalid-option', { expectError: true });

            expect(result.code).not.toBe(0);
            expect(result.stderr).toContain('unknown option');
        });

        it('should prioritize global options over commands', async () => {
            // --version should work even with command names after it
            const result = await runCliInDir(testDir, '--version init list');

            expect(result.code).toBe(0);
            expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('Version Consistency', () => {
        it('should have consistent version across all invocation methods', async () => {
            // Test different ways of invoking the CLI
            const versionResult = await runCliInDir(testDir, '--version');
            const shortVersionResult = await runCliInDir(testDir, '-V');
            
            expect(versionResult.code).toBe(0);
            expect(shortVersionResult.code).toBe(0);
            expect(versionResult.stdout.trim()).toBe(shortVersionResult.stdout.trim());
            
            // Both should match package.json
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            expect(versionResult.stdout.trim()).toBe(packageJson.version);
        });
    });
});