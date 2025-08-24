import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/functional/**/*.test.ts'],
    testTimeout: 45000, // Longer timeout for file system operations and CLI execution
    hookTimeout: 30000, // Longer timeout for setup/teardown
    setupFiles: ['tests/functional/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'tests/**', 'dist/**'],
      reporter: ['text', 'json-summary', 'html', 'text-summary'],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        }
      }
    },
    // Run tests sequentially to avoid file system conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
});