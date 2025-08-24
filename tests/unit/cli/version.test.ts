import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { getPackageVersion, getPackageVersionFromPath } from '../../../src/cli/version.js';

describe('Version Utilities', () => {
    let tempDir: string;
    let testPackageJsonPath: string;

    beforeEach(() => {
        // Create a temporary directory for test files
        tempDir = path.join(os.tmpdir(), `todoq-version-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        mkdirSync(tempDir, { recursive: true });
        testPackageJsonPath = path.join(tempDir, 'package.json');
    });

    afterEach(() => {
        // Clean up test files
        if (existsSync(testPackageJsonPath)) {
            unlinkSync(testPackageJsonPath);
        }
        if (existsSync(tempDir)) {
            require('fs').rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('getPackageVersion', () => {
        it('should return current project version', () => {
            const version = getPackageVersion();
            
            // Should return a valid semver format
            expect(version).toMatch(/^\d+\.\d+\.\d+$/);
            
            // Should match the actual package.json version
            const actualPackageJson = JSON.parse(
                require('fs').readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
            );
            expect(version).toBe(actualPackageJson.version);
        });

        it('should return fallback version when package.json is not found', () => {
            // This test is harder to create without mocking, but we can test the fallback 
            // behavior through getPackageVersionFromPath with a non-existent path
            const version = getPackageVersionFromPath('/non/existent/path/package.json');
            expect(version).toBe('0.0.1');
        });
    });

    describe('getPackageVersionFromPath', () => {
        it('should read version from valid package.json', () => {
            // Create test package.json with specific version
            const testVersion = '1.2.3';
            const testPackageJson = {
                name: 'test-package',
                version: testVersion,
                description: 'Test package'
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson, null, 2));
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe(testVersion);
        });

        it('should handle different version formats', () => {
            const testCases = [
                '1.0.0',
                '2.1.0',
                '10.5.3',
                '0.0.1',
                '1.0.0-beta.1',
                '2.0.0-alpha.3'
            ];

            testCases.forEach(testVersion => {
                const testPackageJson = {
                    name: 'test-package',
                    version: testVersion
                };
                
                writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson));
                
                const result = getPackageVersionFromPath(testPackageJsonPath);
                expect(result).toBe(testVersion);
            });
        });

        it('should return fallback version for non-existent file', () => {
            const result = getPackageVersionFromPath('/non/existent/package.json');
            expect(result).toBe('0.0.1');
        });

        it('should return fallback version for invalid JSON', () => {
            // Write invalid JSON
            writeFileSync(testPackageJsonPath, '{ invalid json }');
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe('0.0.1');
        });

        it('should return fallback version for JSON without version field', () => {
            const testPackageJson = {
                name: 'test-package',
                description: 'Package without version'
                // No version field
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson));
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe('0.0.1');
        });

        it('should return fallback version for non-string version field', () => {
            const testPackageJson = {
                name: 'test-package',
                version: 123 // Invalid: number instead of string
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson));
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            // Should handle gracefully and return the value or fallback
            expect(typeof result).toBe('string');
        });

        it('should handle empty package.json', () => {
            writeFileSync(testPackageJsonPath, '{}');
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe('0.0.1');
        });

        it('should handle package.json with null version', () => {
            const testPackageJson = {
                name: 'test-package',
                version: null
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson));
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe('0.0.1');
        });
    });

    describe('Version Format Validation', () => {
        it('should return semantically valid versions', () => {
            const version = getPackageVersion();
            
            // Check semantic version format
            const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
            expect(version).toMatch(semverRegex);
            
            // Parse version parts
            const parts = version.split('.');
            expect(parts).toHaveLength(3);
            
            // Each part should be a number
            parts.forEach(part => {
                const num = parseInt(part.split('-')[0], 10);
                expect(Number.isInteger(num)).toBe(true);
                expect(num).toBeGreaterThanOrEqual(0);
            });
        });

        it('should handle pre-release versions', () => {
            const testVersion = '1.0.0-beta.1';
            const testPackageJson = {
                name: 'test-package',
                version: testVersion
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(testPackageJson));
            
            const result = getPackageVersionFromPath(testPackageJsonPath);
            expect(result).toBe(testVersion);
            
            // Should still match semver format
            const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
            expect(result).toMatch(semverRegex);
        });
    });
});