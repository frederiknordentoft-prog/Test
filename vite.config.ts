import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Sættes til "/Test/" i GitHub Pages-build (via VITE_BASE), "/" lokalt.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
});
