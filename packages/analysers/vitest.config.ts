import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // parsing a fixture replay takes a few seconds
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
