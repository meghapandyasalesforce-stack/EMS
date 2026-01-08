import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // CRITICAL: Prefer logger utility over console, but allow console methods used by logger
      // The logger utility (utils/logger.js) uses console internally, so we allow those methods
      'no-console': ['warn', { 
        allow: ['warn', 'error', 'info', 'debug'] // Allow console methods used by logger utility
      }],
      // CRITICAL: Prevent alert() calls - use toast notifications instead
      'no-alert': 'error',
    },
  },
]
