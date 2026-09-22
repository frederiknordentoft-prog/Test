// Dev-server config for the post harness: same as vite.config.ts but without HMR, so long headless runs are not
// reloaded when other agents save files (modules are still invalidated → every fresh page load is current).
import { defineConfig } from 'vite';
export default defineConfig({ root: new URL('..', import.meta.url).pathname, server: { hmr: false } });
