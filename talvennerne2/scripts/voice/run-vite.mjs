#!/usr/bin/env node
// Runs a TypeScript build script with the app's own modules, loaded through Vite's ssrLoadModule —
// so `import.meta.glob` (the clip catalogue, the skill registry) works exactly as in the app.
//
//   node scripts/voice/run-vite.mjs scripts/voice/inventory.ts [args …]
//
// The script module exports `main(args: string[]): Promise<number | void>`; its return value is
// the exit code. Paths are relative to talvennerne2/.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../../', import.meta.url))
const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('brug: node scripts/voice/run-vite.mjs <script.ts> [argumenter …]')
  process.exit(2)
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
})
let code = 0
try {
  const id = '/' + path.relative(root, path.resolve(root, script)).split(path.sep).join('/')
  const mod = await server.ssrLoadModule(id)
  if (typeof mod.main !== 'function') throw new Error(`${script} eksporterer ingen main()`)
  const result = await mod.main(args)
  code = typeof result === 'number' ? result : 0
} catch (err) {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  code = 1
} finally {
  await server.close()
}
process.exit(code)
