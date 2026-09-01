// Inlines src/* into a single dependency-free index.html (and an artifact fragment).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, 'src', f), 'utf8');
const tpl = read('template.html');
const parts = {
  style: `<style>\n${read('styles.css')}\n</style>`,
  engine: `<script>\n${read('engine.js')}\n</script>`,
  cards: `<script>\n${read('cards.js')}\n</script>`,
  audio: `<script>\n${read('audio.js')}\n</script>`,
  app: `<script>\n${read('app.js')}\n</script>`,
};
let html = tpl;
for (const [k, v] of Object.entries(parts)) html = html.replace(`<!-- @${k} -->`, () => v);
if (/<!-- @\w+ -->/.test(html)) throw new Error('Unreplaced placeholder');
writeFileSync(join(here, 'index.html'), html);
// Artifact fragment: everything between <body> and </body>, plus <title> and <style> from head.
const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const meta = (html.match(/<meta name="theme-color"[^>]*>/) || [''])[0];
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
writeFileSync(join(here, 'dist-artifact.html'), `${title}\n${meta}\n${parts.style}\n${body}`);
console.log('built index.html (%d KB) and dist-artifact.html', Math.round(html.length / 1024));
