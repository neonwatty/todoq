import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/claude/**/*.test.ts'],
    testTimeout: 180000, // 3 minutes for Claude Code integration tests
    hookTimeout: 30000, // 30 second timeout for setup/teardown
    setupFiles: ['tests/functional/setup.ts'], // Reuse functional test setup
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'tests/**', 'dist/**'],
      reporter: ['text', 'json-summary', 'html', 'text-summary'],
      thresholds: {
        global: {
          branches: 40, // Lower thresholds for integration tests
          functions: 40,
          lines: 40,
          statements: 40
        }
      }
    },
    // Run tests sequentially to avoid Claude Code conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
});