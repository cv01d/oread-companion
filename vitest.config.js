import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['node_modules/**', '.claude/**', '**/node_modules/**'],
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'services/**/*.js',
        'controllers/**/*.js',
        'middleware/**/*.js',
        'routes/**/*.js'
      ],
      exclude: [
        'node_modules/**',
        '**/*.test.js',
        'mcp-servers/**',
        'scripts/**'
      ]
    }
  }
});
