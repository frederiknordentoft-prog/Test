import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the build is published as a multi-file Claude artifact.
export default defineConfig({
  plugins: [react()],
  base: './',
  // Classic (iife) workers: in an opaque-origin sandbox only classic blob workers run (F0 finding).
  worker: { format: 'iife' },
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0 },
});
