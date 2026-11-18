import { defineConfig } from 'vitest/config'

// Full-tournament simulation against the Firebase emulators (see integration/README in sim.test.ts).
// Run: npx vitest run --mode development --config vitest.sim.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    testTimeout: 600000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
