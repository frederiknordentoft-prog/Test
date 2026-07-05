import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'node_modules/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    rules: {
      // The sim engine must stay framework-free: no React, no store, no UI.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'zustand', 'zustand/*'], message: 'src/engine/** er ren TS — ingen React/Zustand-imports.' },
            { group: ['@/ui/*', '@/state/*', '../ui/*', '../state/*', '../../ui/*', '../../state/*'], message: 'Engine må ikke importere UI eller store.' },
          ],
        },
      ],
    },
  },
);
