import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vite-plus'
import { baseRules, fmt, ignoredPaths, testRules, vitePlusLintPlugin } from '../tooling/vite-plus.ts'

const testEnvFile = new URL('./.env.test.local', import.meta.url)
const testEnv = existsSync(testEnvFile) ? parseEnv(readFileSync(testEnvFile, 'utf8')) : {}

export default defineConfig({
  // Tests render templates from source; the running API imports the built package.
  resolve: {
    alias: { '@clozera/emails': fileURLToPath(new URL('../packages/emails/src/index.ts', import.meta.url)) },
  },
  test: {
    pool: 'forks',
    fileParallelism: false,
    env: { ...testEnv, NODE_ENV: 'test' } as Record<string, string>,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test-utils/**', 'src/**/*.test.ts', 'src/server.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['src/**/*.integration.test.ts'] },
      },
      { extends: true, test: { name: 'integration', include: ['src/**/*.integration.test.ts'] } },
    ],
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'vitest'],
    categories: { correctness: 'error' },
    env: { builtin: true, es2026: true, node: true },
    ignorePatterns: ignoredPaths,
    rules: baseRules,
    overrides: [{ files: ['**/*.test.ts'], rules: testRules }],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [vitePlusLintPlugin],
  },
  fmt,
})
