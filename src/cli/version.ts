import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get package.json version in a way that works with both ESM and npm installations
 * @returns The version string from package.json, or fallback version if not found
 */
export function getPackageVersion(): string {
  try {
    // Get the directory of the current module
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    // Look for package.json in the CLI package directory (../../ from dist/cli/)
    const packageJsonPath = join(moduleDir, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Validate that version exists and is a non-empty string
    if (typeof packageJson.version === 'string' && packageJson.version.trim().length > 0) {
      return packageJson.version;
    }
    
    // If version is not a valid string, return fallback
    return '0.0.1';
  } catch (error) {
    // Fallback version if package.json can't be read
    return '0.0.1';
  }
}

/**
 * Get package.json version from a specific path (for testing)
 * @param packageJsonPath - Path to package.json file
 * @returns The version string from package.json, or fallback version if not found
 */
export function getPackageVersionFromPath(packageJsonPath: string): string {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Validate that version exists and is a non-empty string
    if (typeof packageJson.version === 'string' && packageJson.version.trim().length > 0) {
      return packageJson.version;
    }
    
    // If version is not a valid string, return fallback
    return '0.0.1';
  } catch (error) {
    return '0.0.1';
  }
}