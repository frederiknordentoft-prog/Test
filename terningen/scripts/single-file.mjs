/**
 * Pakker produktionsbuildet til én selvstændig HTML-fil (dist/terningen.html), der kan
 * åbnes direkte i en browser eller sendes som én fil — ingen server, ingen installation.
 *
 *   npm run build:single
 *
 * Med --artifact skrives desuden en variant uden <html>/<head>/<body> (kun title, style,
 * rod og script) til den sti, der gives som argument — til hosting, der selv leverer skelettet.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)
const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)
if (!scriptMatch || !cssMatch) throw new Error('Kunne ikke finde script/stylesheet i dist/index.html — kør npm run build først')

const js = readFileSync(join(dist, scriptMatch[1]), 'utf8')
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--')
const css = readFileSync(join(dist, cssMatch[1]), 'utf8').replace(/<\/style/gi, '<\\/style')

const standalone = html
  .replace(scriptMatch[0], '')
  .replace(cssMatch[0], `<style>\n${css}\n</style>`)
  .replace('</body>', `<script type="module">\n${js}\n</script>\n</body>`)
writeFileSync(join(dist, 'terningen.html'), standalone)
console.log(`dist/terningen.html: ${(standalone.length / 1024).toFixed(0)} kB`)

const artifactIndex = process.argv.indexOf('--artifact')
if (artifactIndex !== -1 && process.argv[artifactIndex + 1]) {
  const out = process.argv[artifactIndex + 1]
  const artifact = `<title>Terningen</title>\n<style>\n${css}\n</style>\n<div id="root"></div>\n<script type="module">\n${js}\n</script>\n`
  writeFileSync(out, artifact)
  console.log(`${out}: ${(artifact.length / 1024).toFixed(0)} kB`)
}
