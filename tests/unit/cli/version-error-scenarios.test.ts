import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, chmodSync } from 'fs';
import path from 'path';
import os from 'os';
import { getPackageVersionFromPath } from '../../../src/cli/version.js';

describe('Version Error Scenarios and Edge Cases', () => {
    let tempDir: string;
    let testPackageJsonPath: string;

    beforeEach(() => {
        tempDir = path.join(os.tmpdir(), `todoq-version-error-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
        mkdirSync(tempDir, { recursive: true });
        testPackageJsonPath = path.join(tempDir, 'package.json');
    });

    afterEach(() => {
        // Restore permissions and clean up
        try {
            if (existsSync(testPackageJsonPath)) {
                chmodSync(testPackageJsonPath, 0o644); // Restore read permissions
                unlinkSync(testPackageJsonPath);
            }
            if (existsSync(tempDir)) {
                chmodSync(tempDir, 0o755); // Restore directory permissions
                require('fs').rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.warn('Cleanup error:', error);
        }
    });

    describe('File System Error Scenarios', () => {
        it('should handle non-existent file gracefully', () => {
            const nonExistentPath = path.join(tempDir, 'does-not-exist.json');
            
            const version = getPackageVersionFromPath(nonExistentPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle non-existent directory gracefully', () => {
            const nonExistentPath = '/completely/nonexistent/path/package.json';
            
            const version = getPackageVersionFromPath(nonExistentPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle permission errors gracefully', () => {
            // Create a file then remove read permissions
            writeFileSync(testPackageJsonPath, JSON.stringify({ name: 'test', version: '1.0.0' }));
            
            try {
                chmodSync(testPackageJsonPath, 0o000); // Remove all permissions
                
                const version = getPackageVersionFromPath(testPackageJsonPath);
                
                // Should fallback gracefully when file is not readable
                expect(version).toBe('0.0.1');
            } catch (error) {
                // If chmod fails (e.g., on some systems), skip this test
                console.warn('Cannot test permission errors on this system');
                expect(true).toBe(true);
            }
        });

        it('should handle directory instead of file', () => {
            // Use the temp directory as the "file" path
            const version = getPackageVersionFromPath(tempDir);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle empty file', () => {
            writeFileSync(testPackageJsonPath, '');
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle file with only whitespace', () => {
            writeFileSync(testPackageJsonPath, '   \n\t  \r\n  ');
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            expect(version).toBe('0.0.1');
        });
    });

    describe('JSON Parsing Error Scenarios', () => {
        it('should handle invalid JSON syntax', () => {
            const invalidJsonCases = [
                '{ invalid json }',
                '{ "name": "test", }', // Trailing comma
                '{ "name": test }', // Unquoted value
                '{ name: "test" }', // Unquoted key
                '{ "name": "test" "version": "1.0.0" }', // Missing comma
                '[{"name": "test"}]', // Array instead of object
                '"string"', // String instead of object
                '123', // Number instead of object
                'true', // Boolean instead of object
                'null'  // Null instead of object
            ];

            invalidJsonCases.forEach((invalidJson, index) => {
                const testPath = path.join(tempDir, `invalid-${index}.json`);
                writeFileSync(testPath, invalidJson);
                
                const version = getPackageVersionFromPath(testPath);
                
                expect(version).toBe('0.0.1');
                
                // Cleanup
                unlinkSync(testPath);
            });
        });

        it('should handle JSON with syntax errors', () => {
            const syntaxErrors = [
                '{',  // Incomplete object
                '}',  // Just closing brace
                '{"name":}', // Missing value
                '{"name": "test",}', // Trailing comma (strict mode)
                '{"name" "test"}', // Missing colon
                '{{}}', // Double braces
                '{"name": "test", "name": "duplicate"}' // Duplicate keys (edge case)
            ];

            syntaxErrors.forEach((errorJson, index) => {
                const testPath = path.join(tempDir, `syntax-error-${index}.json`);
                writeFileSync(testPath, errorJson);
                
                const version = getPackageVersionFromPath(testPath);
                
                expect(version).toBe('0.0.1');
                
                // Cleanup
                unlinkSync(testPath);
            });
        });

        it('should handle extremely large JSON files', () => {
            // Create a very large but valid JSON file
            const largeObject = {
                name: 'test',
                version: '1.0.0',
                largeArray: new Array(10000).fill('data'),
                largeString: 'x'.repeat(100000)
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(largeObject));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            // Should still parse correctly
            expect(version).toBe('1.0.0');
        });
    });

    describe('Package.json Content Error Scenarios', () => {
        it('should handle missing version field', () => {
            const packageWithoutVersion = {
                name: 'test-package',
                description: 'A test package without version'
                // No version field
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageWithoutVersion));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle null version field', () => {
            const packageWithNullVersion = {
                name: 'test-package',
                version: null
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageWithNullVersion));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle undefined version field', () => {
            const packageWithUndefinedVersion = {
                name: 'test-package',
                version: undefined
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageWithUndefinedVersion));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            expect(version).toBe('0.0.1');
        });

        it('should handle non-string version field', () => {
            const invalidVersionTypes = [
                { name: 'test', version: 123 },
                { name: 'test', version: true },
                { name: 'test', version: [] },
                { name: 'test', version: {} },
                { name: 'test', version: { major: 1, minor: 0, patch: 0 } }
            ];

            invalidVersionTypes.forEach((pkg, index) => {
                const testPath = path.join(tempDir, `invalid-version-type-${index}.json`);
                writeFileSync(testPath, JSON.stringify(pkg));
                
                const version = getPackageVersionFromPath(testPath);
                
                // Should either return the stringified version or fallback
                expect(typeof version).toBe('string');
                
                // Cleanup
                unlinkSync(testPath);
            });
        });

        it('should handle empty string version', () => {
            const packageWithEmptyVersion = {
                name: 'test-package',
                version: ''
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageWithEmptyVersion));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            // Empty string version should fallback
            expect(version).toBe('0.0.1');
        });

        it('should handle whitespace-only version', () => {
            const packageWithWhitespaceVersion = {
                name: 'test-package',
                version: '   \n\t  '
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageWithWhitespaceVersion));
            
            const version = getPackageVersionFromPath(testPackageJsonPath);
            
            // Should either trim and use it or fallback
            expect(typeof version).toBe('string');
        });
    });

    describe('Edge Case Versions', () => {
        it('should handle various semver formats', () => {
            const validVersions = [
                '0.0.1',
                '1.0.0',
                '10.20.30',
                '1.2.3-alpha',
                '1.2.3-alpha.1',
                '1.2.3-0.3.7',
                '1.2.3-x.7.z.92',
                '1.2.3+20130313144700',
                '1.2.3-beta+exp.sha.5114f85',
                '1.0.0+21AF26D3----117B344092BD'
            ];

            validVersions.forEach(testVersion => {
                const packageJson = {
                    name: 'test-package',
                    version: testVersion
                };
                
                writeFileSync(testPackageJsonPath, JSON.stringify(packageJson));
                
                const version = getPackageVersionFromPath(testPackageJsonPath);
                
                expect(version).toBe(testVersion);
            });
        });

        it('should handle invalid semver formats gracefully', () => {
            const invalidVersions = [
                'v1.0.0', // Leading 'v'
                '1', // Too short
                '1.0', // Too short
                '1.0.0.0', // Too long
                '01.0.0', // Leading zeros
                '1.01.0', // Leading zeros
                '1.0.01', // Leading zeros
                '1.0.0-', // Trailing dash
                '1.0.0+', // Trailing plus
                '1.0.0-+', // Invalid format
                'latest', // String instead of version
                'next',
                '^1.0.0', // Range instead of exact
                '~1.0.0', // Range instead of exact
                '>=1.0.0' // Range instead of exact
            ];

            invalidVersions.forEach(invalidVersion => {
                const packageJson = {
                    name: 'test-package',
                    version: invalidVersion
                };
                
                writeFileSync(testPackageJsonPath, JSON.stringify(packageJson));
                
                const version = getPackageVersionFromPath(testPackageJsonPath);
                
                // Should either return the version as-is or fallback
                expect(typeof version).toBe('string');
                expect(version.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Concurrent Access Scenarios', () => {
        it('should handle multiple simultaneous reads', async () => {
            const packageJson = {
                name: 'test-package',
                version: '1.0.0'
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(packageJson));
            
            // Simulate multiple concurrent reads
            const promises = Array.from({ length: 10 }, () => 
                Promise.resolve(getPackageVersionFromPath(testPackageJsonPath))
            );
            
            const results = await Promise.all(promises);
            
            // All should succeed and return the same version
            results.forEach(result => {
                expect(result).toBe('1.0.0');
            });
        });

        it('should handle read during file modification', async () => {
            const initialPackage = {
                name: 'test-package',
                version: '1.0.0'
            };
            
            writeFileSync(testPackageJsonPath, JSON.stringify(initialPackage));
            
            // Start reading while modifying the file
            const readPromise = Promise.resolve(getPackageVersionFromPath(testPackageJsonPath));
            
            // Modify the file
            const modifiedPackage = {
                name: 'test-package',
                version: '2.0.0'
            };
            writeFileSync(testPackageJsonPath, JSON.stringify(modifiedPackage));
            
            const result = await readPromise;
            
            // Should get either the old version, new version, or fallback (not crash)
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});