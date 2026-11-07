import type { UserConfig } from 'vite-plus'

type LintConfig = NonNullable<UserConfig['lint']>
type FmtConfig = NonNullable<UserConfig['fmt']>

/**
 * Lint and format settings shared by every workspace. Each workspace's vite.config.ts
 * spreads these and adds its own environment, plugins and test settings.
 */

export const ignoredPaths: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.output/**',
  '**/.tanstack/**',
  '**/coverage/**',
  '**/routeTree.gen.ts',
]

export const fmt: FmtConfig = {
  semi: false,
  singleQuote: true,
  printWidth: 110,
  arrowParens: 'avoid',
  trailingComma: 'es5',
  sortPackageJson: false,
  ignorePatterns: ['coverage/', 'dist/', '.output/', 'package-lock.json', 'data/', '**/routeTree.gen.ts'],
}

export const baseRules: NonNullable<LintConfig['rules']> = {
  'no-case-declarations': 'error',
  'no-empty': 'error',
  'no-fallthrough': 'error',
  'no-prototype-builtins': 'error',
  'no-redeclare': 'error',
  'no-regex-spaces': 'error',
  'no-unexpected-multiline': 'error',
  'no-useless-assignment': 'error',
  'preserve-caught-error': 'error',
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'prefer-const': 'error',
  'prefer-template': 'warn',
  'typescript/consistent-type-imports': 'error',
  'typescript/no-explicit-any': 'error',
  'typescript/no-floating-promises': 'error',
  'typescript/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
  'vite-plus/prefer-vite-plus-imports': 'error',
}

export const testRules: NonNullable<LintConfig['rules']> = {
  'vitest/expect-expect': 'error',
  'vitest/no-commented-out-tests': 'error',
  'vitest/no-conditional-expect': 'error',
  'vitest/no-disabled-tests': 'warn',
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/valid-expect': 'error',
  'vitest/valid-title': 'error',
}

export const vitePlusLintPlugin = { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }
