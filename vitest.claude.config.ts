import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/claude/**/*.test.ts'],
    testTimeout: 300000,
    setupFiles: [],
  },
});