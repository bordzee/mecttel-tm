import { defineConfig } from 'vitest/config'

// Firestore rules tests need the emulator: npm run test:rules
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
