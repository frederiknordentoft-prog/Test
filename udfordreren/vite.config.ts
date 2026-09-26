import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

// PWA (spec 4 og fase 8): installerbar og offline via en precachende service worker (sw.js + manifest.webmanifest,
// som netlify.toml sætter no-cache på). Ikonerne tegnes procedural af `npm run ikoner` (scripts/ikoner.mjs).
const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: false, // registreres i src/ui/lib/pwa.ts (med venlige beskeder i stedet for et tvunget reload)
  filename: 'sw.js',
  manifestFilename: 'manifest.webmanifest',
  includeManifestIcons: false, // ikonerne kommer med via globPatterns (ellers står de to gange i precachen)
  manifest: {
    name: 'Spilhuset: Udfordreren',
    short_name: 'Udfordreren',
    description: 'Byg en dansk spiludbyder fra garagen i 2012 til AI-æraen i 2035. Et tycoonspil med anmeldelser, hitlister og guldkuponer.',
    lang: 'da',
    dir: 'ltr',
    display: 'standalone',
    orientation: 'any',
    start_url: './',
    scope: './',
    theme_color: '#171a2b',
    background_color: '#171a2b',
    categories: ['games', 'entertainment'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Alt, der bygges: js, css, html og ikonerne (manifestet lægger pluginet selv i precachen)
    globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
    // autoUpdate: en ny version tager over med det samme (pluginet sætter det kun selv ved injectRegister: 'auto').
    // Den kørende side genindlæses ikke — spilleren får en besked, og den nye version bruges ved næste indlæsning.
    skipWaiting: true,
    clientsClaim: true,
    // Hovedbundtet og Tone.js skal med i precachen, ellers virker spillet ikke offline
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  },
});

// Single-builden har ingen service worker: registreringen bliver en tom stub
const pwaStub = {
  name: 'udfordreren-pwa-stub',
  resolveId: (id: string) => (id === 'virtual:pwa-register' ? '\0pwa-stub' : null),
  load: (id: string) => (id === '\0pwa-stub' ? 'export function registerSW() { return async () => {}; }' : null),
};

// `--mode single` bygger én selvstændig HTML-fil (bruges til preview-deling).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile(), pwaStub] : [pwa])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Tone.js (musikken) hentes dovent i sin egen chunk — med et navn, man kan genkende i netværksfanen og precachen
        chunkFileNames: (chunk: { name: string; moduleIds: string[] }) =>
          chunk.moduleIds.some((id) => /[\\/]node_modules[\\/]tone[\\/]/.test(id)) ? 'assets/tone-[hash].js' : 'assets/[name]-[hash].js',
      },
    },
  },
  server: { host: true, port: 5173 },
}));
