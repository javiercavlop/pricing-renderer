import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    // Several suites type-check a snippet through the TypeScript compiler API, which builds a
    // program per case and takes more than the 5s default on a cold or loaded machine. The
    // timeout is a guard against a hang, not a performance budget.
    testTimeout: 30_000,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts', 'src/yaml/**/*.ts'],
    },
  },
});
