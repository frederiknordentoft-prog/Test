// Turn the single-file Vite build into an Artifact page body:
// the Artifact skeleton supplies <!doctype>/<html>/<head>/<body>, so strip ours and put <title> first.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
const src = 'dist/index.html';
const out = 'dist/nordlys.html';
let html = readFileSync(src, 'utf8');
const title = (html.match(/<title>[\s\S]*?<\/title>/) || ['<title>NORDLYS</title>'])[0];
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]);
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || ['', ''])[1].replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
const guard = '<style>:root{background:#050B1A;color-scheme:dark}html,body{margin:0;height:100%;overflow:hidden;background:#050B1A;color:#EAF8FF}</style>';
const page = [title, '<meta name="description" content="NORDLYS · SOLSTORM G5 — procedural casino-automat UI-demo med legepenge.">', guard, ...styles, body.trim(), ...scripts].join('\n');
writeFileSync(out, page);
const kb = (statSync(out).size / 1024).toFixed(0);
const first8k = page.slice(0, 8192);
const problems = [];
if (!/<title>/.test(first8k)) problems.push('title not in first 8KB');
if (/<(html|head|body)[\s>]/i.test(page.replace(/<script[\s\S]*?<\/script>/g, ''))) problems.push('skeleton tags present');
const ext = [...page.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)/g)].map((m) => m[1]).filter((u) => !/stopspillet|spillemyndigheden/.test(u));
if (ext.length) problems.push('external refs: ' + ext.join(', '));
if (statSync(out).size > 16 * 1024 * 1024) problems.push('> 16MB');
console.log(`artifact: ${out} ${kb} KB${problems.length ? ' — PROBLEMS: ' + problems.join('; ') : ' — ok'}`);
if (problems.length) process.exit(1);
