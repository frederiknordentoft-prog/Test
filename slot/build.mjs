// Inlines styles.css and js/*.js into a single self-contained dist/index.html (for hosting as one file).
// Run: node slot/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css" />', () => `<style>\n${css}\n</style>`);
html = html.replace(/<script src="js\/([a-z]+)\.js"><\/script>/g, (m, name) => `<script>\n${readFileSync(join(root, 'js', name + '.js'), 'utf8')}\n</script>`);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html);
console.log('wrote slot/dist/index.html', (html.length / 1024).toFixed(0), 'kB');

// Optional: --fragment <path> writes a body-only fragment (title + style + markup + scripts) for hosts
// that wrap content in their own document skeleton.
const fi = process.argv.indexOf('--fragment');
if (fi > -1 && process.argv[fi + 1]) {
  const themeScript = html.match(/<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/)[0];
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  const fragment = `<title>Objekt</title>\n${themeScript}\n<style>\n${css}\n</style>\n${body}`;
  writeFileSync(process.argv[fi + 1], fragment);
  console.log('wrote fragment', process.argv[fi + 1], (fragment.length / 1024).toFixed(0), 'kB');
}
