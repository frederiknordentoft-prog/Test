/* Bygger en enkeltfils-udgave af LYSBRUD: dist/lysbrud.html
   Ingen afhængigheder. Samler ES-modulerne til klassiske script-blokke,
   så filen kan åbnes direkte fra disk eller lægges i en iframe.
   node build.mjs                                                         */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENTRY = 'src/main.js';

/* --------------------------------------------------------- modulparsing */

const IMPORT_RE = /^[ \t]*import\s+(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"];?[ \t]*$/gm;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) throw new Error(`Kun relative imports understøttes: ${spec} (i ${fromFile})`);
  return normalize(join(dirname(fromFile), spec)).replace(/\\/g, '/');
}

/** Finder eksporterede navne og fjerner export-nøgleordet. */
function stripExports(src, file) {
  const names = new Set();
  let out = src;

  if (/^\s*export\s+default\b/m.test(out)) throw new Error(`export default understøttes ikke (${file})`);

  out = out.replace(/^[ \t]*export\s+(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm, (m, a, n) => {
    names.add(n); return `${a || ''}function ${n}`;
  });
  out = out.replace(/^[ \t]*export\s+class\s+([A-Za-z_$][\w$]*)/gm, (m, n) => { names.add(n); return `class ${n}`; });
  out = out.replace(/^[ \t]*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, k, n) => { names.add(n); return `${k} ${n}`; });
  out = out.replace(/^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm, (m, list) => {
    for (const part of list.split(',')) {
      const t = part.trim(); if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
    return '';
  });

  if (/^\s*export\s/m.test(out)) throw new Error(`Uhåndteret export-form i ${file}`);
  return { code: out, names: [...names] };
}

/** Omskriver imports til opslag i modulregisteret. */
function rewriteImports(src, file, deps) {
  return src.replace(IMPORT_RE, (m, clause, spec) => {
    const target = resolveSpec(file, spec);
    deps.push(target);
    if (!clause) return `__req(${JSON.stringify(target)});`;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (!named) throw new Error(`Kun navngivne imports understøttes: ${m.trim()} (i ${file})`);
    const bindings = named[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const as = s.split(/\s+as\s+/);
      return as.length > 1 ? `${as[0].trim()}: ${as[1].trim()}` : as[0].trim();
    });
    return `const { ${bindings.join(', ')} } = __req(${JSON.stringify(target)});`;
  });
}

/* ------------------------------------------------------------- samling */

const modules = new Map();   // sti → {code, names, deps}

async function load(file) {
  if (modules.has(file)) return;
  const raw = await readFile(join(ROOT, file), 'utf8');
  const deps = [];
  const rewritten = rewriteImports(raw, file, deps);
  const { code, names } = stripExports(rewritten, file);
  modules.set(file, { code, names, deps });
  for (const d of deps) await load(d);
}

function topoSort(entry) {
  const order = [], mark = new Map();
  const visit = (f, stack) => {
    if (mark.get(f) === 2) return;
    if (mark.get(f) === 1) throw new Error(`Cirkulær afhængighed: ${[...stack, f].join(' → ')}`);
    mark.set(f, 1);
    for (const d of modules.get(f).deps) visit(d, [...stack, f]);
    mark.set(f, 2);
    order.push(f);
  };
  visit(entry, []);
  return order;
}

/* ---------------------------------------------------------------- output */

await load(ENTRY);
const order = topoSort(ENTRY);

const bundle = `(function(){
'use strict';
var __defs = {}, __cache = {};
function __req(id){
  if (__cache[id]) return __cache[id].e;
  var m = __defs[id];
  if (!m) throw new Error('Ukendt modul: ' + id);
  var rec = __cache[id] = { e: {} };
  m(rec.e, __req);
  return rec.e;
}
${order.map(f => {
  const m = modules.get(f);
  const assign = m.names.length
    ? `\n  Object.defineProperties(exports, {${m.names.map(n => `${JSON.stringify(n)}: { get: function(){ return ${n}; }, enumerable: true }`).join(', ')}});`
    : '';
  return `__defs[${JSON.stringify(f)}] = function(exports, __req){\n${m.code}${assign}\n};`;
}).join('\n')}
__req(${JSON.stringify(ENTRY)});
})();`;

let html = await readFile(join(ROOT, 'index.html'), 'utf8');
const css = await readFile(join(ROOT, 'styles.css'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="styles\.css" \/>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="src\/main\.js"><\/script>/, `<script>\n${bundle}\n</script>`);

if (html.includes('styles.css') || html.includes('src/main.js')) {
  throw new Error('Erstatning i index.html slog fejl — tjek tag-formen.');
}

await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(join(ROOT, 'dist', 'lysbrud.html'), html);

const kb = n => (n / 1024).toFixed(1) + ' kB';
console.log(`dist/lysbrud.html — ${kb(Buffer.byteLength(html))}`);
console.log(`  ${order.length} moduler: ${order.map(f => relative('src', f) || f).join(', ')}`);
