const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');
const playwright = require('eslint-plugin-playwright');
const unusedImports = require('eslint-plugin-unused-imports');
const prettierConfig = require('eslint-config-prettier');

/**
 * Extract type-checked rules from @typescript-eslint/eslint-plugin
 * Safely handles both legacy and new config formats
 */
const typeCheckedRules = (() => {
  try {
    return (
      tsPlugin.configs?.['recommended-type-checked']?.rules ||
      tsPlugin.configs?.['recommended-requiring-type-checking']?.rules ||
      {}
    );
  } catch {
    return {};
  }
})();

/**
 * Extract Playwright recommended config safely
 * Supports both flat config and legacy formats
 */
const playwrightRecommended = (() => {
  try {
    if (playwright.configs?.['flat/recommended']) {
      return playwright.configs['flat/recommended'];
    }
    return playwright.configs?.recommended || {};
  } catch {
    return {};
  }
})();

module.exports = [
  // Ignore build artifacts and common files
  {
    ignores: [
      'node_modules',
      'playwright-report',
      'test-results',
      'coverage',
      'dist',
      'build',
      '**/*-snapshots/',
      'eslint.config.js',
      'scripts/**/*.js',
      'scripts/**/*.ts', // Scripts have separate tsconfig
      'jest.config.js',
      'jest.setup.js',
      '.husky/**',
      '.git/**',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      // Exclude k6 load tests (use separate .eslintrc.k6.js config)
      'tests/load/**',
    ],
  },

  // Main config for all TS/JS files
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser,
      },
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // Base ESLint rules
      ...js.configs.recommended.rules,

      // TypeScript rules
      ...tsPlugin.configs.recommended.rules,
      ...typeCheckedRules,

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // Import organization
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          'newlines-between': 'always-and-inside-groups',
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'import/newline-after-import': ['error', { count: 1 }],
      'import/no-unresolved': [
        'error',
        {
          ignore: [
            '@playwright/test',
            '@fixtures',
            '@pages',
            '@utils',
            '@support',
            '@factories',
            '@types',
            '^\\.',
            '^\\.\\./',
          ],
          caseSensitive: true,
        },
      ],
      'import/no-cycle': ['warn', { maxDepth: 5 }],
      'import/no-default-export': 'off',
      'import/no-unused-modules': 'off',

      // Clean up unused code
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      // Code quality
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'prefer-arrow-callback': 'warn',
      'no-var': 'error',
    },
  },

  // Test file overrides - relax strict rules for Playwright
  {
    files: [
      'tests/**/*.ts',
      'tests/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.smoke.ts',
      '**/*.spec.ts',
      '**/*.test.ts',
    ],
    languageOptions: {
      globals: {
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      playwright,
    },
    rules: {
      ...(playwrightRecommended.rules || {}),

      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off', // Allow any in test assertions
      'prefer-arrow-callback': 'off',
      'no-console': 'off',
      'no-empty-pattern': 'off',
      'import/no-default-export': 'off',

      // Allow intentional test patterns
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'playwright/no-wait-for-timeout': 'off',
      'playwright/expect-expect': 'off',
      'playwright/no-force-option': 'off',
      'playwright/no-wait-for-selector': 'off',
      'playwright/no-standalone-expect': 'off', // Allow expect in helper functions
      'playwright/no-networkidle': 'off', // Allow networkidle for legacy compatibility
      'playwright/no-skipped-test': 'warn', // Warn only, don't block CI

      // Allow intentionally unused variables (error handlers, etc.)
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // Utilities and scripts
  {
    files: ['src/scripts/**/*.ts', 'src/utils/**/*.ts', 'src/support/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-control-regex': 'off', // Allow ANSI escape codes
      'no-useless-escape': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // Jest test files
  {
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // Fixtures
  {
    files: ['fixtures/**/*.ts'],
    rules: {
      'prefer-arrow-callback': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      'unused-imports/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // Page Objects and Models
  {
    files: ['src/pages/**/*.ts', 'src/models/**/*.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },

  // Prettier compatibility
  {
    name: 'prettier-overrides',
    rules: {
      ...(prettierConfig.rules || {}),
    },
  },
];
