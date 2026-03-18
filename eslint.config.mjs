import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const sharedIgnores = [
  'dist',
  'dev-dist',
  'build',
  'coverage',
  '.turbo',
  'node_modules',
  '.storybook',
  'storybook-static',
];

const sharedTypeCheckedRules = {
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/no-misused-promises': 'off',
  '@typescript-eslint/no-unnecessary-condition': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/prefer-nullish-coalescing': 'off',
  '@typescript-eslint/require-await': 'off',
  'no-console': 'off',
  'preserve-caught-error': 'off',
  'unused-imports/no-unused-imports': 'error',
};

const reactHooksRecommendedConfig =
  reactHooks.configs.flat?.recommended ??
  reactHooks.configs['recommended-latest'] ??
  reactHooks.configs.recommended;

export function createCoreLintConfig(tsconfigRootDir) {
  return defineConfig([
    globalIgnores(sharedIgnores),
    {
      files: ['src/**/*.ts'],
      extends: [
        js.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
      ],
      languageOptions: {
        ecmaVersion: 2022,
        globals: {
          ...globals.es2022,
          ...globals.node,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
        sourceType: 'module',
      },
      plugins: {
        'unused-imports': unusedImports,
      },
      rules: sharedTypeCheckedRules,
    },
  ]);
}

export function createWebLintConfig(tsconfigRootDir) {
  return defineConfig([
    globalIgnores(sharedIgnores),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [
        js.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        reactHooksRecommendedConfig,
        reactRefresh.configs.vite,
      ],
      languageOptions: {
        ecmaVersion: 2022,
        globals: {
          ...globals.browser,
          ...globals.es2022,
        },
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
        sourceType: 'module',
      },
      plugins: {
        'unused-imports': unusedImports,
      },
      rules: {
        ...sharedTypeCheckedRules,
        'react-hooks/set-state-in-effect': 'off',
      },
    },
    {
      files: ['**/*.tsx'],
      extends: [jsxA11y.flatConfigs.recommended],
      rules: {
        'jsx-a11y/label-has-associated-control': 'off',
        'jsx-a11y/no-autofocus': 'off',
      },
    },
    {
      files: ['vite.config.ts', 'jest.config.cjs'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
    },
  ]);
}
