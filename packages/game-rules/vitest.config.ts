import { defineConfig } from 'vitest/config'

// M1 exit criterion: 100 % coverage on game rules (docs/milestones.md).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { 100: true },
    },
  },
})
