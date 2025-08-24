import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { existsSync, rmSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import os from 'os';

// Global test state
let testDirectories: string[] = [];
let cliPath: string;

// Helper to create unique test directory
export function createTestDir(): string {
    const testDir = path.join(os.tmpdir(), `todoq-functional-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    testDirectories.push(testDir);
    
    // Ensure the directory exists
    if (!existsSync(testDir)) {
        mkdirSync(testDir, { recursive: true });
    }
    
    return testDir;
}

// Helper to get CLI path
export function getCliPath(): string {
    return cliPath;
}

// Verify CLI exists before running tests
beforeAll(async () => {
    cliPath = path.join(process.cwd(), 'dist', 'cli', 'index.js');
    
    if (!existsSync(cliPath)) {
        throw new Error(
            `CLI not found at ${cliPath}. Please run 'npm run build' before running functional tests.`
        );
    }
    
    // Verify the CLI is executable
    try {
        const stats = statSync(cliPath);
        if (!stats.isFile()) {
            throw new Error(`CLI path ${cliPath} is not a file`);
        }
    } catch (error) {
        throw new Error(`Failed to verify CLI at ${cliPath}: ${error}`);
    }
});

// Global cleanup after each test
afterEach(async () => {
    // Clean up all test directories created during the test
    const cleanupPromises = testDirectories.map(async (dir) => {
        if (existsSync(dir)) {
            try {
                // Add a small delay to ensure file handles are closed
                await new Promise(resolve => setTimeout(resolve, 100));
                rmSync(dir, { recursive: true, force: true });
            } catch (error) {
                console.warn(`Failed to cleanup test directory ${dir}:`, error);
                
                // Try again after a longer delay
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    rmSync(dir, { recursive: true, force: true });
                } catch (retryError) {
                    console.error(`Failed to cleanup test directory ${dir} on retry:`, retryError);
                }
            }
        }
    });
    
    await Promise.all(cleanupPromises);
    testDirectories = [];
});

// Final cleanup
afterAll(async () => {
    // Ensure any remaining directories are cleaned up
    for (const dir of testDirectories) {
        if (existsSync(dir)) {
            try {
                rmSync(dir, { recursive: true, force: true });
            } catch (error) {
                console.warn(`Failed final cleanup of test directory ${dir}:`, error);
            }
        }
    }
    testDirectories = [];
});

/**
 * Cleanup utility for manual cleanup in tests if needed
 */
export function cleanupTestDir(testDir: string): void {
    const index = testDirectories.indexOf(testDir);
    if (index > -1) {
        testDirectories.splice(index, 1);
    }
    
    if (existsSync(testDir)) {
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn(`Failed to cleanup test directory ${testDir}:`, error);
        }
    }
}