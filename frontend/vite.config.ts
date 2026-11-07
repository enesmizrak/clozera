import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig, lazyPlugins } from 'vite-plus'
import { baseRules, fmt, ignoredPaths, testRules, vitePlusLintPlugin } from '../tooling/vite-plus.ts'

const isTest = Boolean(process.env.VITEST)

export default defineConfig({
  server: { port: 5173 },
  resolve: { tsconfigPaths: true },
  // TanStack Start owns the app entry, SSR build and file routes; tests render components directly.
  plugins: lazyPlugins(() => [tailwindcss(), ...(isTest ? [] : [tanstackStart()]), react()]),
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude],
    setupFiles: ['./src/test/setup.ts'],
  },
  lint: {
    plugins: ['eslint', 'oxc', 'typescript', 'unicorn', 'react', 'jsx-a11y', 'vitest'],
    categories: { correctness: 'error' },
    env: { browser: true, builtin: true, es2026: true },
    ignorePatterns: ignoredPaths,
    rules: {
      ...baseRules,
      'react/react-in-jsx-scope': 'off',
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'error',
      // Design-system rules: use theme tokens and classes Tailwind can generate.
      'shadcn/no-raw-colors': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/require-static-classes': 'error',
      'shadcn/no-arbitrary-values': 'warn',
    },
    overrides: [
      { files: ['**/*.test.{ts,tsx}', 'src/test/**'], rules: testRules },
      // Generated shadcn primitives are the design system itself.
      {
        files: ['src/components/ui/**'],
        rules: {
          'shadcn/no-arbitrary-values': 'off',
          'shadcn/no-unknown-classes': 'off',
          'jsx-a11y/prefer-tag-over-role': 'off',
          'jsx-a11y/click-events-have-key-events': 'off',
          'jsx-a11y/no-noninteractive-element-interactions': 'off',
          'jsx-a11y/label-has-associated-control': 'off',
        },
      },
    ],
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [vitePlusLintPlugin, '@shadcn/lint'],
  },
  fmt,
})
