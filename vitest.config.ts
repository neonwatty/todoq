import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/claude/**'],
    testTimeout: 30000,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'tests/**', 'dist/**'],
      reporter: ['text', 'json-summary', 'html', 'text-summary'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'src/core/**': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85
        },
        'src/adapters/**': {
          branches: 75,
          functions: 80,
          lines: 75,
          statements: 75
        }
      }
    }
  },
});