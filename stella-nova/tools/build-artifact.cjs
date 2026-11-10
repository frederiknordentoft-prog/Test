#!/usr/bin/env node
/**
 * Turn the single-file build (dist/index.html) into a page fragment for
 * hosts that wrap the page in their own document skeleton: no doctype, html,
 * head or body tags, just title, meta, styles, markup and the inlined script.
 *
 *   npm run build:artifact   →   dist/stella-nova.html
 */
const fs = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '..', 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const pick = (re) => [...html.matchAll(re)].map((m) => m[0]);
const title = (html.match(/<title>[\s\S]*?<\/title>/) || ['<title>Stella Nova</title>'])[0];
const links = pick(/<link\b[^>]*rel="stylesheet"[^>]*>/g);
const styles = pick(/<style\b[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script\b[^>]*>[\s\S]*?<\/script>/g);
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || ['', ''])[1].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').trim();

if (!scripts.length) throw new Error('no inlined script found in dist/index.html; run "vite build" first');
if (scripts.some((s) => /\bsrc=/.test(s.slice(0, s.indexOf('>'))))) throw new Error('the build still references an external script');

const out = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<meta name="theme-color" content="#03050d">',
  ...links,
  ...styles,
  body,
  ...scripts,
  '',
].join('\n');

const file = path.join(dist, 'stella-nova.html');
fs.writeFileSync(file, out);
console.log(`wrote ${path.relative(process.cwd(), file)} (${(out.length / 1024).toFixed(0)} kB)`);

// The same fragment inside a stand-in for the host's skeleton, for local testing.
const preview = `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n${out}</body></html>`;
fs.writeFileSync(path.join(dist, 'preview.html'), preview);
