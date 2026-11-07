import { defineConfig } from 'vite-plus'
import { baseRules, fmt, ignoredPaths, testRules, vitePlusLintPlugin } from '../../tooling/vite-plus.ts'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'vitest'],
    categories: { correctness: 'error' },
    env: { builtin: true, es2026: true },
    ignorePatterns: ignoredPaths,
    rules: baseRules,
    overrides: [{ files: ['**/*.test.ts'], rules: testRules }],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [vitePlusLintPlugin],
  },
  fmt,
})
