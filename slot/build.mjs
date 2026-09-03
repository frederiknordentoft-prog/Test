// Inlines local CSS and JS into single self-contained pages: dist/index.html and dist/nova.html.
// Run: node slot/build.mjs [--fragment <page> <out>]  (fragment = body-only file for hosts that supply the skeleton)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const TITLES = { 'index.html': 'Objekt', 'nova.html': 'Nova' };

function inline(page) {
  let html = readFileSync(join(root, page), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="([^"]+)" \/>/g, (m, href) => href.startsWith('http') ? m : `<style>\n${readFileSync(join(root, href), 'utf8')}\n</style>`);
  html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (m, src) => src.startsWith('http') ? m : `<script>\n${readFileSync(join(root, src), 'utf8')}\n</script>`);
  return html;
}
mkdirSync(join(root, 'dist'), { recursive: true });
for (const page of Object.keys(TITLES)) {
  const html = inline(page);
  writeFileSync(join(root, 'dist', page), html);
  console.log(`wrote slot/dist/${page}`, (html.length / 1024).toFixed(0), 'kB');
}
const fi = process.argv.indexOf('--fragment');
if (fi > -1 && process.argv[fi + 1] && process.argv[fi + 2]) {
  const page = process.argv[fi + 1];
  const html = inline(page);
  const head = html.match(/<head>([\s\S]*)<\/head>/)[1];
  const themeScript = head.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/)[0];
  const fontLinks = (head.match(/<link rel="(?:preconnect|stylesheet)" href="https:[^"]+" \/>/g) || []).join('\n');
  const styles = (head.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  const fragment = `<title>${TITLES[page] || page}</title>\n${themeScript}\n${fontLinks}\n${styles}\n${body}`;
  writeFileSync(process.argv[fi + 2], fragment);
  console.log('wrote fragment', process.argv[fi + 2], (fragment.length / 1024).toFixed(0), 'kB');
}
