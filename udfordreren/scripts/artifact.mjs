// Laver en artifact-venlig side ud fra `npm run build:single`: fjerner doctype/html/head/body-tags
// (artifact-værten lægger sit eget skelet omkring) og beholder <title>, <meta>, <style> og <script>.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = src.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const title = '<title>Udfordreren</title>';
const styles = [...head.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[\s\S]*?<\/script>/gi)].map((m) => m[0]).join('\n');
const extra = '<style>html,body{height:100%;background:#171a2b;color:#f3efe2}</style>';
const out = `${title}\n${extra}\n${styles}\n${body.trim()}\n${scripts}\n`;
mkdirSync(new URL('../dist-single/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist-single/udfordreren.html', import.meta.url), out);
console.log(`dist-single/udfordreren.html: ${(out.length / 1024).toFixed(0)} KB`);
