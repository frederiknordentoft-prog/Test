#!/usr/bin/env node
/**
 * build.mjs — bundle the dev page into one distributable HTML file.
 *
 *   node build.mjs                      → dist/speedometer.html
 *   node build.mjs --in x.html --out y  → custom input / output (used by tests)
 *   node build.mjs --artifact --out z    → same bundle without the <!DOCTYPE>/<html>/<head>/<body>
 *                                          wrapper, for hosts that wrap the page themselves
 *                                          (the claude.ai Artifact publisher)
 *
 * What it does
 *   • reads index.html next to this script
 *   • every LOCAL <link rel="stylesheet" href="…"> becomes an inline <style>
 *   • every LOCAL <script src="…"> (vendor/, src/) becomes an inline <script>
 *   • remote (https://, //, data:) links and scripts are left untouched — the
 *     Google Fonts stylesheet and the PptxGenJS CDN script keep working
 *   • "</script" inside inlined JS is escaped as "<\/script" so the HTML
 *     parser cannot close the tag early ("</style" in CSS likewise)
 *   • prepends a one-line HTML comment with the build date
 *   • prints the output size; exits non-zero if a local file is missing
 *
 * No dependencies — Node 18+ built-ins only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const args = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(here, args.in || 'index.html');
const outputPath = path.resolve(here, args.out || path.join('dist', 'speedometer.html'));

/** Tiny --key value / --flag parser (no dependencies). */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else { out[key] = true; }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Parse the attributes of one HTML start tag into a lower-cased map. */
function parseAttributes(tagBody) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(tagBody)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[name] = value;
  }
  return attrs;
}

/** True when a URL points at a file on disk rather than the network. */
function isLocalRef(url) {
  if (!url) return false;
  const u = url.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return false;   // https:, data:, blob:, …
  if (u.startsWith('//')) return false;                // protocol-relative
  return true;
}

/** Map a local href/src to an absolute path relative to the input page. */
function resolveLocal(ref) {
  let clean = ref.trim().split(/[?#]/)[0];
  clean = clean.replace(/^\.\//, '');
  if (clean.startsWith('/')) {
    console.warn(`  warning: "${ref}" is root-relative; treating it as relative to the page`);
    clean = clean.replace(/^\/+/, '');
  }
  try { clean = decodeURIComponent(clean); } catch (_) { /* keep as-is */ }
  return path.resolve(path.dirname(inputPath), clean);
}

/** Read a referenced local file or fail the whole build with a clear message. */
function readLocal(ref, kind) {
  const abs = resolveLocal(ref);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    console.error(`\nERROR: ${kind} "${ref}" not found (looked for ${abs})`);
    process.exit(1);
  }
  return { abs, text: fs.readFileSync(abs, 'utf8') };
}

/** Escape sequences that would terminate the inline element early. */
function escapeInlineScript(js) {
  return js.replace(/<\/script/gi, (m) => '<\\/' + m.slice(2));   // keeps the original casing
}
function escapeInlineStyle(css) {
  return css.replace(/<\/style/gi, (m) => '<\\/' + m.slice(2));
}

/** Rebuild the attribute string minus the ones that make no sense inline. */
function keepAttributes(attrs, drop) {
  return Object.entries(attrs)
    .filter(([k]) => !drop.includes(k))
    .map(([k, v]) => (v === '' ? k : `${k}="${v.replace(/"/g, '&quot;')}"`))
    .join(' ');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

if (!fs.existsSync(inputPath)) {
  console.error(`ERROR: input page not found: ${inputPath}`);
  process.exit(1);
}

console.log(`Building ${path.relative(here, inputPath) || inputPath}`);
let html = fs.readFileSync(inputPath, 'utf8');
const inlined = [];

/* 1. Local stylesheets → <style> */
html = html.replace(/<link\b([^>]*?)\/?>/gi, (tag, body) => {
  const attrs = parseAttributes(body);
  const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
  if (!rel.includes('stylesheet') || !isLocalRef(attrs.href)) return tag;   // remote or not a stylesheet
  const { abs, text } = readLocal(attrs.href, 'stylesheet');
  inlined.push({ kind: 'css', ref: attrs.href, bytes: Buffer.byteLength(text) });
  if (/url\(\s*['"]?(?!data:|https?:|\/\/|#)[^)'"]+/i.test(text)) {
    console.warn(`  warning: ${attrs.href} contains relative url() references that will not resolve inline`);
  }
  const extra = keepAttributes(attrs, ['rel', 'href', 'type', 'crossorigin', 'integrity', 'as']);
  return `<style${extra ? ' ' + extra : ''}>\n/* inlined from ${attrs.href} */\n${escapeInlineStyle(text)}\n</style>`;
});

/* 2. Local scripts → inline <script> */
html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (tag, body, inner) => {
  const attrs = parseAttributes(body);
  if (!('src' in attrs) || !isLocalRef(attrs.src)) return tag;             // inline already, or remote (CDN)
  if (inner.trim()) console.warn(`  warning: <script src="${attrs.src}"> had inline content; it is discarded (as browsers do)`);
  const { text } = readLocal(attrs.src, 'script');
  inlined.push({ kind: 'js', ref: attrs.src, bytes: Buffer.byteLength(text) });
  // src/defer/async/integrity/crossorigin have no meaning on inline scripts.
  const extra = keepAttributes(attrs, ['src', 'defer', 'async', 'integrity', 'crossorigin']);
  return `<script${extra ? ' ' + extra : ''}>\n/* inlined from ${attrs.src} */\n${escapeInlineScript(text)}\n</script>`;
});

/* 3. Optional: artifact mode. The claude.ai Artifact publisher wraps the file in
   its own <!DOCTYPE html><html><head>…</head><body> skeleton (charset + viewport
   included), so emit only the document's content: the <head> children (minus
   charset/viewport) followed by the <body> children. Everything else is identical. */
if (args.artifact) {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!headMatch || !bodyMatch) {
    console.error('ERROR: --artifact needs a page with <head> and <body>');
    process.exit(1);
  }
  const head = headMatch[1]
    .replace(/<meta\s+charset=[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="viewport"[^>]*>\s*/gi, '');
  html = head.trim() + '\n' + bodyMatch[1].trim() + '\n';
  console.log('  artifact mode: stripped the document wrapper (host supplies doctype/html/head/body)');
}

/* 4. Build stamp (a comment before <!DOCTYPE> keeps standards mode). */
const stamp = `<!-- Speedometer til PowerPoint — single-file build ${new Date().toISOString()} (generated by build.mjs; edit index.html + src/ instead) -->\n`;
html = stamp + html.replace(/^\uFEFF/, '');

/* 5. Write */
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

for (const f of inlined) console.log(`  inlined ${f.kind.padEnd(3)} ${f.ref} (${formatSize(f.bytes)})`);
if (inlined.length === 0) console.warn('  warning: nothing was inlined — does index.html reference local css/js?');

const size = fs.statSync(outputPath).size;
console.log(`Wrote ${path.relative(here, outputPath) || outputPath} — ${formatSize(size)} (${size.toLocaleString('en-US')} bytes, ${inlined.length} files inlined)`);
