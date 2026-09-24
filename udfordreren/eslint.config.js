import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-single', 'node_modules', 'playwright-report', 'test-results'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Sim-kernen skal være deterministisk: ingen Math.random, Date.now eller React.
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Brug den seedede RNG i src/sim/rng.ts.' },
        { object: 'Date', property: 'now', message: 'Sim-kernen må ikke læse vægurstid.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'zustand', 'dexie', '../ui/*', '../store/*', '../render/*'] }],
    },
  },
);
