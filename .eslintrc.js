/**
 * ESLint configuration – shared across JS & TS files
 * Provides TypeScript parsing, import ordering, prettier integration,
 * and sensible defaults for React + React-Hooks projects.
 */

module.exports = {
  root: true,

  /* ------------------------------------------------------------
   *  Parser & Parser Options
   * ---------------------------------------------------------- */
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    // Point the TS parser at the root tsconfig so that
    // eslint-plugin-import / eslint-import-resolver-typescript
    // can correctly infer paths & aliases.
    project: './tsconfig.json',
  },

  /* ------------------------------------------------------------
   *  Plugins
   * ---------------------------------------------------------- */
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'import',
    'prettier',
  ],

  /* ------------------------------------------------------------
   *  Base Configs to Extend
   * ---------------------------------------------------------- */
  extends: [
    'react-app',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],

  /* ------------------------------------------------------------
   *  Custom Rules
   * ---------------------------------------------------------- */
  rules: {
    /* Hooks */
    'react-hooks/exhaustive-deps': 'warn',

    /* TypeScript */
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    /* Import management & ordering */
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    /* Prettier formatting */
    'prettier/prettier': 'error',
  },

  /* ------------------------------------------------------------
   *  Shared Settings
   * ---------------------------------------------------------- */
  settings: {
    react: {
      version: 'detect',
    },
    // Configure import resolution for both JS & TS.
    // The "typescript" entry leverages eslint-import-resolver-typescript.
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      // Always try to resolve types under `<root>@types` *and* based on paths
      // defined in tsconfig.json (`paths` / `baseUrl`).
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
};
