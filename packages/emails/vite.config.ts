import { defineConfig } from 'vite-plus'
import { baseRules, fmt, ignoredPaths, testRules, vitePlusLintPlugin } from '../../tooling/vite-plus.ts'

export default defineConfig({
  // The API runs plain Node, which cannot load TSX. Templates are bundled to dist/index.js,
  // with React Email's components inlined so the API only needs react and @react-email/render.
  pack: {
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'node',
    dts: false,
    deps: { onlyBundle: ['react-email'] },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'vitest'],
    categories: { correctness: 'error' },
    env: { builtin: true, es2026: true, node: true },
    ignorePatterns: ignoredPaths,
    rules: { ...baseRules, 'react/react-in-jsx-scope': 'off' },
    overrides: [{ files: ['**/*.test.ts'], rules: testRules }],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [vitePlusLintPlugin],
  },
  fmt,
})
