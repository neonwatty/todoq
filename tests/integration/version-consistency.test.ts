import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getPackageVersion, getPackageVersionFromPath } from '../../src/cli/version.js';

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), 'dist', 'cli', 'index.js');
const PACKAGE_JSON_PATH = path.join(process.cwd(), 'package.json');

// Helper function to run CLI commands
async function runCLI(command: string): Promise<string> {
    const { stdout } = await execAsync(`node "${CLI_PATH}" ${command}`);
    return stdout.trim();
}

describe('Version Consistency Validation', () => {
    let packageJsonVersion: string;

    beforeAll(() => {
        // Read the actual package.json version
        const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
        packageJsonVersion = packageJson.version;
        
        // Ensure it's a valid semver
        expect(packageJsonVersion).toMatch(/^\d+\.\d+\.\d+/);
    });

    describe('Cross-Layer Version Consistency', () => {
        it('should have consistent version across all access methods', async () => {
            // 1. Direct function call
            const functionVersion = getPackageVersion();
            
            // 2. Function with explicit path
            const pathVersion = getPackageVersionFromPath(PACKAGE_JSON_PATH);
            
            // 3. CLI --version flag
            const cliVersion = await runCLI('--version');
            
            // 4. CLI -V flag  
            const cliShortVersion = await runCLI('-V');
            
            // All methods should return the same version
            expect(functionVersion).toBe(packageJsonVersion);
            expect(pathVersion).toBe(packageJsonVersion);
            expect(cliVersion).toBe(packageJsonVersion);
            expect(cliShortVersion).toBe(packageJsonVersion);
            
            // All CLI methods should match
            expect(cliVersion).toBe(cliShortVersion);
        });

        it('should maintain version consistency during build process', () => {
            // This test ensures that the version is correctly carried through the build
            const version = getPackageVersion();
            
            // Should match package.json exactly
            expect(version).toBe(packageJsonVersion);
            
            // Should be a valid semantic version
            const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
            expect(version).toMatch(semverRegex);
        });

        it('should work correctly after build transpilation', async () => {
            // This test verifies that the ESM import.meta.url resolution works
            // correctly in the transpiled/built version
            
            const cliVersion = await runCLI('--version');
            
            // Should match the source package.json
            expect(cliVersion).toBe(packageJsonVersion);
            
            // Should not be the fallback version
            expect(cliVersion).not.toBe('0.0.1');
        });
    });

    describe('Version Format Validation', () => {
        it('should follow semantic versioning specification', () => {
            const version = packageJsonVersion;
            
            // Basic semver format
            expect(version).toMatch(/^\d+\.\d+\.\d+/);
            
            // Parse version components
            const parts = version.split('.');
            expect(parts).toHaveLength(3);
            
            const [major, minor, patch] = parts.map(p => parseInt(p.split('-')[0], 10));
            
            // All parts should be non-negative integers
            expect(Number.isInteger(major)).toBe(true);
            expect(Number.isInteger(minor)).toBe(true);
            expect(Number.isInteger(patch)).toBe(true);
            expect(major).toBeGreaterThanOrEqual(0);
            expect(minor).toBeGreaterThanOrEqual(0);
            expect(patch).toBeGreaterThanOrEqual(0);
        });

        it('should handle pre-release versions correctly', () => {
            // Test with current version or create test case
            const version = packageJsonVersion;
            
            if (version.includes('-')) {
                // If it's a pre-release version, validate the format
                const [baseVersion, preRelease] = version.split('-');
                
                expect(baseVersion).toMatch(/^\d+\.\d+\.\d+$/);
                expect(preRelease).toBeTruthy();
                expect(preRelease.length).toBeGreaterThan(0);
                
                // Pre-release should follow semver rules
                expect(preRelease).toMatch(/^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/);
            } else {
                // Regular release version
                expect(version).toMatch(/^\d+\.\d+\.\d+$/);
            }
        });
    });

    describe('Version Resolution Robustness', () => {
        it('should resolve version correctly from built distribution', () => {
            // This test specifically validates that the path resolution works
            // when the code is in dist/ and package.json is at project root
            
            const version = getPackageVersion();
            
            // Should successfully read from ../../package.json relative to dist/cli/
            expect(version).toBe(packageJsonVersion);
            expect(version).not.toBe('0.0.1'); // Should not fall back
        });

        it('should handle npm package structure correctly', async () => {
            // When installed via npm, the structure should still work
            const cliVersion = await runCLI('--version');
            
            expect(cliVersion).toBe(packageJsonVersion);
            expect(cliVersion).toMatch(/^\d+\.\d+\.\d+/);
        });
    });

    describe('Error Scenarios and Fallbacks', () => {
        it('should gracefully handle version read errors', () => {
            // Test fallback behavior
            const fallbackVersion = getPackageVersionFromPath('/nonexistent/package.json');
            expect(fallbackVersion).toBe('0.0.1');
        });

        it('should validate that current implementation does not use fallback', () => {
            // Ensure our fix is working and we're not getting the fallback
            const version = getPackageVersion();
            
            expect(version).not.toBe('0.0.1');
            expect(version).toBe(packageJsonVersion);
        });
    });

    describe('Version Update Process Validation', () => {
        it('should detect version changes consistently', () => {
            // This test helps ensure that version updates are reflected everywhere
            
            const packageVersion = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')).version;
            const codeVersion = getPackageVersion();
            
            expect(codeVersion).toBe(packageVersion);
            
            // If these don't match, it suggests a version update wasn't properly propagated
            if (codeVersion !== packageVersion) {
                throw new Error(
                    `Version mismatch detected:\n` +
                    `Package.json: ${packageVersion}\n` +
                    `Code version: ${codeVersion}\n` +
                    `This may indicate an incomplete version update.`
                );
            }
        });

        it('should maintain version consistency during CI builds', async () => {
            // Test that would catch version inconsistencies in CI
            const methods = {
                'package.json': packageJsonVersion,
                'getPackageVersion()': getPackageVersion(),
                'CLI --version': await runCLI('--version'),
                'CLI -V': await runCLI('-V')
            };
            
            const versions = Object.values(methods);
            const uniqueVersions = [...new Set(versions)];
            
            if (uniqueVersions.length > 1) {
                const details = Object.entries(methods)
                    .map(([method, version]) => `  ${method}: ${version}`)
                    .join('\n');
                
                throw new Error(
                    `Version inconsistency detected:\n${details}\n` +
                    `All methods should return the same version.`
                );
            }
            
            expect(uniqueVersions).toHaveLength(1);
            expect(uniqueVersions[0]).toBe(packageJsonVersion);
        });
    });
});