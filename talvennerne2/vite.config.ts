import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import type { BuildEnvironmentOptions } from 'vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const appBuild: BuildEnvironmentOptions = {
  rollupOptions: {
    input: { index: here('./index.html'), lyt: here('./lyt.html'), diag: here('./diag.html') },
  },
}

const sheetsBuild: BuildEnvironmentOptions = {
  outDir: 'artifacts/sheets-app',
  emptyOutDir: true,
  rollupOptions: { input: { sheets: here('./sheets.html') } },
}

// base: './' — served from /Test/talvennerne2/ on the multi-app Pages site, never the root.
// `--mode sheets` builds the dev-only contact-sheet app (src/dev) into artifacts/, never into dist/.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: mode === 'sheets' ? sheetsBuild : appBuild,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    setupFiles: ['src/testing/setup.ts'],
    // the generator sweeps (every fact, 200 instances per family) take seconds, and the container
    // shares its CPU with the voice generation: 5 s made them fail under load, not on their merits
    testTimeout: 30_000,
  },
}))
