/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the built app works when served from a subfolder
// (https://frederiknordentoft-prog.github.io/Test/surdej/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2019',
    // Inline nothing weird; keep a clean index.html + assets/ folder.
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
