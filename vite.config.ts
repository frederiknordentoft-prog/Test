import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Workers are referenced via `new Worker(new URL(...), { type: 'module' })`,
// which Vite bundles automatically for both dev and build.
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
});
