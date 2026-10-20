import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./src/test/setupEnv.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
