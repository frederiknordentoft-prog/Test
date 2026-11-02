/*
 * Builds docs/UDFALD-rapport.pdf from docs/rapport/:
 *   1. assembles kapitler/*.html (order: 00, k01…k21, b-a…b-d) into out/rapport.html,
 *      replacing {{keys}} from data/fakta.json (unknown keys fail the build), adding the
 *      screenshots (img/*.jpg) and the SVG figures (figurer/index.mjs);
 *   2. renders a PDF with Chromium (dark A4, CSS page size, margin-box page numbers);
 *   3. reads each chapter's page from the PDF's named destinations (scripts/toc.py), writes the
 *      page numbers into the table of contents and renders again until they are stable.
 * Usage: node docs/rapport/build.mjs [--draft]   (--draft: one pass, out/rapport.pdf only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { figures } from './figurer/index.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { serve } = require('./scripts/serve.cjs');
const { chromium } = require('playwright');
const DRAFT = process.argv.includes('--draft');
const OUT = path.join(here, 'out');
const FINAL = path.join(here, '..', 'UDFALD-rapport.pdf');
const KDIR = process.env.KAPITLER || path.join(here, 'kapitler');
fs.mkdirSync(OUT, { recursive: true });

const J = (f) => JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8'));
const fakta = J('fakta.json');
const ctx = { story: J('story.json'), stats: J('stats.json'), mc20: J('mc20.json'), fakta };
const FIGS = figures(ctx);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function chapterFiles() {
  const all = fs.readdirSync(KDIR).filter((f) => f.endsWith('.html'));
  const rank = (f) => (f.startsWith('00') ? 0 : f.startsWith('k') ? 100 + Number(/^k(\d+)/.exec(f)[1]) : f.startsWith('b-') ? 1000 + f.charCodeAt(2) : 5000);
  return all.sort((a, b) => rank(a) - rank(b));
}

/** Numbered badges on the hero screenshot, positioned from the screenshot's sidecar. */
function anatomyBadges() {
  const sc = J('shots/03-kamp-anatomi.json');
  const r = sc.rects;
  const lt = (s) => sc.liveTexts.find((t) => t.text.startsWith(s));
  const at = (x, y) => [x / 390, y / sc.height];
  const cause = lt('Rolig') ?? { px: 20, py: 280 };
  const tag = lt('Mål FCK') ?? { px: 330, py: 350 };
  const tally = sc.liveTexts.find((t) => /^\d+$/.test(t.text) && t.px > 300 && t.py < 320) ?? { px: 330, py: 305 };
  const head = r['.fan-head'];
  const pts = [
    at(r['.kb'][0] + 252, r['.kb'][1] + 10), // 1 Kampbånd (near the status pill)
    at(r['.ih-label'][0] + r['.ih-label'][2] + 8, r['.ih-label'][1] + 12), // 2 label and price
    at(r['.ih-futures'][0] - 8, r['.ih-futures'][1] + 10), // 3 chance and odds
    at(cause.px + 216, cause.py - 4), // 4 cause chip
    at(head[0] - 18, head[1] - 14), // 5 price line and NU
    at(head[0] + 60, head[1] + 40), // 6 fan
    at(tag.px - 8, tag.py - 4), // 7 branch tags
    at(tally.px - 8, tally.py - 12), // 8 tally
    at(r['.ab'][0] + 140, r['.ab'][1] + 8), // 9 share bar
    at(r['.mv-h'][0] + r['.mv-h'][2] + 10, r['.mv-h'][1] + 9), // 10 Målvejret
    at(r['.mv-ag'][0] - 6, r['.mv-ag'][1] + 14), // 11 Over 2,5 chip
    at(r['.pc'][0] + r['.pc'][2] - 10, r['.pc'][1] + 8), // 12 position card + fader
    at(r['.pc-sikring'][0] + r['.pc-sikring'][2] + 8, r['.pc-sikring'][1] + 15), // 13 Sikring chip
    at(r['.bb'][0] + 195, r['.bb'][1] + 6), // 14 bottom bar
  ];
  return pts.map(([x, y], i) => `<span class="badge" style="left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%">${i + 1}</span>`).join('');
}

function shotHeight(id) {
  try {
    return J(`shots/${id}.json`).height ?? 844;
  } catch {
    return 844;
  }
}

function render(src, missing) {
  let s = src.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, k) => {
    if (!(k in fakta)) {
      missing.add(k);
      return `⟦${k}⟧`;
    }
    return esc(fakta[k]);
  });
  s = s.replace(/<figure([^>]*?)class="([^"]*\bphone\b[^"]*)"([^>]*?)data-shot="([^"]+)"([^>]*)>/g, (m, a, cls, b, id, c) => {
    const tall = shotHeight(id) > 900 ? ' tall' : '';
    const img = `<img src="../img/${id}.jpg" alt="">`;
    const inner = /\banat\b/.test(cls) ? `<div class="pic">${img}${anatomyBadges()}</div>` : img;
    return `<figure${a}class="${cls}${tall}"${b}data-shot="${id}"${c}>${inner}`;
  });
  s = s.replace(/<figure([^>]*?)data-fig="([^"]+)"([^>]*)>/g, (m, a, id, c) => {
    if (!FIGS[id]) {
      missing.add(`fig:${id}`);
      return m;
    }
    return `<figure${a}data-fig="${id}"${c}>${FIGS[id]}`;
  });
  return s;
}

function cover() {
  return `<section class="cover">
  <div class="wordmark">UDFALD</div>
  <div class="title">Spillet, de nye mekanismer og maskinrummet</div>
  <div class="sub">En mobil sportsbook, hvor hver kamp er 100 simulerede fremtider, og prisen er en kurs fra 0 til 100. Rapporten gennemgår hele spillet skærm for skærm og går i dybden med de tre nye mekanismer.</div>
  <div class="new">
    <div><b>Mål i alt og slutresultat</b>Over 2,5 som kampens anden kurs, et 6 × 6-kort over slutresultater og Over/Under 0,5–4,5.</div>
    <div><b>Sikring</b>Stop-loss og Sikr gevinst på positionen, med en vagt mod gab ved genåbning.</div>
    <div><b>Parken-puljen</b>En totalisatorpulje på resultatet mod et simuleret publikum, låst ved pausen.</div>
  </div>
  <div class="meta"><b>Prototype · fiktive kurser · ingen rigtige penge</b><br>2. november 2026 · commit ${esc(fakta.commit)}<br>Alle tal og billeder stammer fra én deterministisk kørsel af appen.</div>
  <div class="hero"><img src="../img/07-over25-vifte.jpg" alt=""></div>
</section>`;
}

const NY = new Set(['k6', 'k7', 'k8', 'k16', 'k17', 'k18']);
function toc(entries, pages) {
  const pg = (id) => (pages && pages[id] ? String(pages[id]) : '00');
  let h = '<section class="toc"><h1>Indhold</h1><ol>';
  for (const e of entries) {
    if (e.part) {
      h += `</ol><div class="part">${esc(e.part)}</div><ol>`;
      continue;
    }
    h += `<li class="${NY.has(e.id) ? 'ny' : ''}"><span class="nr">${esc(e.nr)}</span><a class="t" href="#${e.id}">${esc(e.title)}</a><span class="pg">${pg(e.id)}</span></li>`;
  }
  return `${h}</ol></section>`;
}

function assemble(pages) {
  const missing = new Set();
  const files = chapterFiles();
  const bodies = files.map((f) => render(fs.readFileSync(path.join(KDIR, f), 'utf8'), missing));
  const entries = [];
  let bilag = false;
  for (const b of bodies) {
    if (/id="del1"/.test(b)) entries.push({ part: 'Del I · Spillet' });
    if (/id="del2"/.test(b)) entries.push({ part: 'Del II · Maskinrummet' });
    for (const m of b.matchAll(/<h1 class="kapitel" id="([^"]+)" data-nr="([^"]*)">([\s\S]*?)<\/h1>/g)) {
      if (m[1].startsWith('b') && !bilag) {
        entries.push({ part: 'Bilag' });
        bilag = true;
      }
      entries.push({ id: m[1], nr: m[2], title: m[3].replace(/<[^>]+>/g, '').trim() });
    }
  }
  if (missing.size) throw new Error(`build: unknown keys or figures: ${[...missing].join(', ')}`);
  const html = `<!doctype html><html lang="da"><head><meta charset="utf-8"><title>UDFALD · spillet, de nye mekanismer og maskinrummet</title><meta name="author" content="UDFALD-prototypen"><link rel="stylesheet" href="../style.css"></head><body>${cover()}${toc(entries, pages)}${bodies.join('\n')}</body></html>`;
  fs.writeFileSync(path.join(OUT, 'rapport.html'), html);
  return entries.filter((e) => e.id).map((e) => e.id);
}

async function pdf(file) {
  const s = await serve(4312);
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.goto('http://127.0.0.1:4312/out/rapport.html', { waitUntil: 'load' });
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
    });
    await p.pdf({ path: file, printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
  } finally {
    await b.close();
    s.close();
  }
}

function pagesOf(file, ids) {
  const out = execFileSync('python3', [path.join(here, 'scripts', 'toc.py'), file, ...ids]).toString();
  return JSON.parse(out);
}

const ids = assemble(null);
const pass1 = path.join(OUT, 'rapport.pdf');
await pdf(pass1);
if (DRAFT) {
  console.log('draft:', pass1);
  process.exit(0);
}
let pages = pagesOf(pass1, ids);
for (let i = 0; i < 3; i++) {
  assemble(pages);
  await pdf(pass1);
  const again = pagesOf(pass1, ids);
  if (JSON.stringify(again) === JSON.stringify(pages)) {
    if (!process.env.KAPITLER) fs.copyFileSync(pass1, FINAL);
    console.log('built', FINAL, JSON.stringify(pages));
    process.exit(0);
  }
  pages = again;
}
throw new Error('build: table of contents did not stabilise');
