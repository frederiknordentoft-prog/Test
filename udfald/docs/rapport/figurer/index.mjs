/*
 * Figures for the report as inline SVG strings, drawn from data/*.json. Colours are the app's own
 * data colours (so charts match the screenshots); text stays in text tokens; every series is
 * direct-labelled or in a legend. One y-axis per panel.
 */
const C = {
  fck: '#5ce1ff', x: '#a7b0be', bif: '#ffd200', over: '#ff5fa2', up: '#3ddc97', down: '#ff6b5e', trap: '#c58bff',
  text: '#e8edf2', text2: '#b9c2ce', muted: '#8a94a3', grid: '#1f2630', axis: '#3a4350', surface: '#0e1217', surface2: '#151a21', line: '#232a35',
};
const NUM = 'UDF Flex, Inter, DejaVu Sans, sans-serif';
const UI = 'UDF Tight, Inter, DejaVu Sans, sans-serif';
const nf = (v, d = 0) => new Intl.NumberFormat('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v).replace('-', '−');
const kr = (v) => `${nf(v, Math.abs(v - Math.round(v)) > 0.004 ? 2 : 0)} kr`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clock = (t) => {
  let m = Math.floor(t + 1e-9);
  let s = Math.round((t - m) * 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
};

function svg(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
function T(x, y, s, o = {}) {
  const a = [`x="${x.toFixed(1)}"`, `y="${y.toFixed(1)}"`, `font-family="${o.num ? NUM : UI}"`, `font-size="${o.size ?? 10}"`, `fill="${o.fill ?? C.text2}"`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.italic) a.push('font-style="italic"');
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}
const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${o.stroke ?? C.grid}" stroke-width="${o.w ?? 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.op ? ` stroke-opacity="${o.op}"` : ''} stroke-linecap="round"/>`;
const P = (pts, o = {}) => `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')}" fill="none" stroke="${o.stroke}" stroke-width="${o.w ?? 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.op ? ` stroke-opacity="${o.op}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
const R = (x, y, w, h, o = {}) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="${o.rx ?? 0}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.w ?? 1}"` : ''}${o.op ? ` fill-opacity="${o.op}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
const Ci = (x, y, r, o = {}) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.w ?? 1.5}"` : ''}/>`;
const HATCH = `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#8a8f98" stroke-width="1.2" stroke-opacity="0.55"/></pattern><pattern id="hatchc" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${C.down}" stroke-width="1" stroke-opacity="0.35"/></pattern><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L8,4L0,8z" fill="${C.muted}"/></marker></defs>`;
const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.muted}" stroke-width="1.2" marker-end="url(#arr)"/>`;
function box(x, y, w, h, title, lines = [], o = {}) {
  let s = R(x, y, w, h, { rx: 8, fill: o.fill ?? C.surface2, stroke: o.stroke ?? C.line, w: o.sw ?? 1 });
  s += T(x + 9, y + 17, title, { size: o.ts ?? 10.5, weight: 650, fill: C.text });
  lines.forEach((l, i) => { s += T(x + 9, y + 31 + i * 12.5, l, { size: 8.6, fill: typeof l === 'string' && l.startsWith('★') ? C.over : C.text2 }); });
  return s;
}
function legend(x, y, items) {
  let s = '';
  let cx = x;
  for (const it of items) {
    s += it.dot ? Ci(cx + 6, y - 3, 3.5, { fill: it.color }) : L(cx, y - 3, cx + 16, y - 3, { stroke: it.color, w: it.w ?? 2, dash: it.dash });
    s += T(cx + 21, y, it.label, { size: 9 });
    cx += 30 + it.label.length * 5.1;
  }
  return s;
}
function axisY(x0, x1, ys, ticks, fmt, o = {}) {
  let s = '';
  for (const v of ticks) {
    const y = ys(v);
    s += L(x0, y, x1, y, { stroke: C.grid });
    s += T(x0 - 6, y + 3, fmt(v), { num: true, size: 8.5, anchor: 'end', fill: C.muted });
  }
  if (o.title) s += T(x0 - 6, ys(ticks[ticks.length - 1]) - 10, o.title, { size: 8.5, anchor: 'end', fill: C.muted });
  return s;
}

// --- 1. Kampen vi følger ------------------------------------------------------------------------
function tidslinje({ story }) {
  const W = 712, H = 250;
  const x = (t) => 46 + (t / 93) * 640;
  const ev = story.events;
  let s = HATCH;
  s += T(10, 14, 'KAMPEN', { size: 8, weight: 700, fill: C.muted });
  s += T(10, 140, 'DINE HANDLER', { size: 8, weight: 700, fill: C.muted });
  const ay = 112;
  s += L(x(0), ay, x(93), ay, { stroke: C.axis, w: 1.5 });
  for (const t of [0, 15, 30, 45, 60, 75, 90]) {
    s += L(x(t), ay - 4, x(t), ay + 4, { stroke: C.axis });
    s += T(x(t), ay + 16, `${t}′`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  }
  // Halftime: the pool locks.
  s += L(x(45), 22, x(45), 236, { stroke: C.muted, dash: '2 4' });
  s += T(x(45) + 5, 30, 'Pause · puljen låses', { size: 8.8, fill: C.text2 });
  // Whales.
  const whales = ev.filter((e) => e.kind === 'whale');
  whales.forEach((w, i) => {
    const cx = x(w.t);
    const col = w.team === 0 ? C.fck : w.team === 1 ? C.bif : C.x;
    s += `<path d="M${cx},${ay - 21}l5,5l-5,5l-5,-5z" fill="${col}"/>`;
    s += T(cx, ay - 28 - (i % 2) * 11, `hval ${nf(Number(w.text))} kr`, { size: 8, anchor: 'middle', fill: C.text2 });
  });
  // Goals and halts.
  for (const g of ev.filter((e) => e.kind === 'goal')) {
    const cx = x(g.t);
    const reopen = ev.find((e) => e.kind === 'reopen' && e.k > g.k);
    s += R(cx - 1, ay - 60, Math.max(4, x(reopen.t) - cx + 2), 50, { fill: 'url(#hatch)' });
    s += Ci(cx, ay - 16, 6.5, { fill: g.team === 0 ? C.fck : C.bif });
    s += T(cx + (g.t > 80 ? -8 : 8), ay - 64, `Mål ${g.team === 0 ? 'FCK' : 'BIF'} ${clock(g.t)}`, { size: 9.5, weight: 650, fill: C.text, anchor: g.t > 80 ? 'end' : 'start' });
    const gap = reopen.gap;
    s += T(cx + (g.t > 80 ? -8 : 8), ay - 52, `handelsstop til ${clock(reopen.t)} · gab ${gap.map((v) => (v > 0 ? `+${v}` : nf(v))).join(' / ')}`, { size: 8, fill: C.text2, anchor: g.t > 80 ? 'end' : 'start' });
  }
  s += T(x(93), ay - 64, `Slut ${story.final.score.replace('-', '–')}`, { size: 9.5, weight: 650, fill: C.text, anchor: 'end' });
  // Your trades.
  const ty = 158;
  const mk = (t, col, lines, anchor = 'start', dy = 0) => {
    const cx = x(t);
    let r = L(cx, ay + 6, cx, ty - 8 + dy, { stroke: col, op: 0.6 });
    r += Ci(cx, ty - 4 + dy, 4, { fill: col });
    lines.forEach((l, i) => { r += T(cx + (anchor === 'end' ? -8 : 8), ty + i * 11 + dy, l, { size: 8.6, fill: i ? C.text2 : C.text, anchor, weight: i ? 400 : 600 }); });
    return r;
  };
  const log = story.final.log;
  const take = story.final.exits.find((e) => e.kind === 'take' && e.status === 'udløst');
  const stop = story.final.exits.find((e) => e.kind === 'stop' && e.status === 'udløst');
  s += mk(20, C.text, ['20′: køb FCK, BIF, Over 2,5, 1–1', `200 kr i puljen på X · Sikring på BIF og Over`], 'end');
  s += mk(take.fill.t, C.up, [`Sikr gevinst Over @ ${take.fill.price}`, `+${kr(take.fill.kr)} · ${clock(take.fill.t)}`]);
  s += mk(stop.fill.t + 0.6, C.down, [`Stop-loss BIF @ ${stop.fill.price}`, `${kr(stop.fill.kr)} · ${clock(stop.fill.t)}`], 'start', 28);
  const late = log.find((e) => e.kind === 'buy' && e.contract === 'cs:2-1');
  s += mk(late.t, C.text, ['35′: køb slutresultat 2–1'], 'start', 58);
  const pool = story.final.poolResult;
  const cs11 = log.find((e) => e.kind === 'settle' && e.contract === 'cs:1-1');
  s += mk(93, C.up, [`Puljen +${kr(pool.payout)}`, `1–1 +${kr(cs11.payout)}`], 'end');
  return svg(W, H, s, 'Tidslinje for kampen vi følger');
}

// --- 2. Kurs og chance ------------------------------------------------------------------------
function kursChance({ story, fakta }) {
  const W = 712, H = 132;
  const b = story.before;
  const chance = b.mid[0] * 100;
  const kurs = b.ask[0];
  const x0 = 40, x1 = 470;
  const x = (v) => x0 + (v / 100) * (x1 - x0);
  let s = HATCH;
  s += R(x0, 44, x1 - x0, 22, { rx: 4, fill: C.surface2 });
  s += R(x0, 44, x(chance) - x0, 22, { rx: 4, fill: C.fck, op: 0.85 });
  s += R(x(chance), 44, x(kurs) - x(chance), 22, { fill: C.text, op: 0.9 });
  for (const v of [0, 25, 50, 75, 100]) {
    s += L(x(v), 70, x(v), 74, { stroke: C.axis });
    s += T(x(v), 86, String(v), { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  }
  s += T(x0, 34, `Chance ${nf(chance, 1)} %`, { size: 10, weight: 650, fill: C.text });
  s += L(x(kurs), 40, x(kurs), 70, { stroke: C.text, w: 1.5 });
  s += T(x(kurs) + 6, 34, `Kurs ${kurs} = chance + husets andel`, { size: 10, weight: 650, fill: C.text });
  s += T(x0, 108, `${fakta['koeb.fck.indsats']} ved kurs ${kurs} = ${fakta['koeb.fck.andele']} hele andele for ${fakta['koeb.fck.kr']}.`, { size: 9.5, fill: C.text2 });
  s += T(x0, 122, `Vinder FCK, betaler hver andel 1 kr: ${fakta['koeb.fck.andele']} kr. Ellers 0.`, { size: 9.5, fill: C.text2 });
  s += box(500, 30, 200, 76, '1 andel', ['koster kursen / 100 kr', `her ${nf(kurs / 100, 2)} kr`, 'betaler 1 kr, hvis udfaldet sker', 'kan sælges igen, undtagen under handelsstop']);
  return svg(W, H, s, 'Kurs mod chance');
}

// --- 3. Skærmkort -------------------------------------------------------------------------------
function skaermkort() {
  const W = 712, H = 236;
  let s = HATCH;
  s += box(14, 86, 120, 56, 'Lobby', ['derbyet og hallen live', 'demo og portefølje']);
  s += box(14, 10, 120, 46, 'Demo', ['85 s med spøgelsestommel']);
  s += box(14, 172, 120, 46, 'Hallen', ['Aalborg–GOG, oscilloskop']);
  s += box(196, 64, 160, 100, 'Kampen', ['FCK–Brøndby live', 'fremtidsvifte, andelsbar,', 'Målvejret, positionskort,', 'Sikring, bundbjælke'], { stroke: C.fck, sw: 1.5, ts: 12 });
  const right = [['Byg', 'byg en fremtid af 2–3 ben', false], ['Mål', '★ mål i alt og slutresultat', true], ['Pulje', '★ Parken-puljen på 1X2', true], ['Portefølje', 'positioner, Sikring, pulje', false]];
  right.forEach(([t, d, ny], i) => { s += box(420, 6 + i * 56, 150, 46, t, [d], ny ? { stroke: C.over, sw: 1.5 } : {}); });
  s += box(600, 174, 100, 46, 'Afregning', ['flod, karakterer']);
  s += arrow(134, 114, 194, 114);
  s += arrow(74, 86, 74, 58);
  s += arrow(74, 142, 74, 170);
  s += arrow(134, 33, 230, 62);
  right.forEach((_, i) => { s += arrow(356, 114, 418, 29 + i * 56); });
  s += arrow(570, 197, 598, 197);
  s += T(387, 238 - 4, 'bundbjælken: Byg · Mål · Pulje · Portefølje', { size: 8.5, anchor: 'middle', fill: C.muted });
  s += T(276, 182, 'chevron ‹ tilbage til lobbyen', { size: 8.5, anchor: 'middle', fill: C.muted });
  s += T(600, 166, '★ = nyt', { size: 8.5, fill: C.over });
  return svg(W, H, s, 'Kort over skærmene');
}

// --- 4. Systemet --------------------------------------------------------------------------------
function system() {
  const W = 712, H = 268;
  let s = HATCH;
  const bw = 104, gap = 13, y = 14, h = 146;
  const cols = [
    ['Tidslinje', ['seed + hændelser', '(fri kamp eller', 'demo-manuskript)', 'hash01(seed, k, …)']],
    ['Simulation', ['1 substep = 1,5 s', 'pres (OU), zone,', 'hjørner, chancer,', 'mål, kort, VAR']],
    ['Prissætter (DP)', ['rate-gitter', '→ 1X2, næste mål,', 'vinduer', '★ Over 2,5, slut-', '★ resultatgitter']],
    ['Markedslag', ['ordreflow, hvaler,', 'støj, overshoot,', 'handelsstop, gab,', 'kurser m. margin']],
    ['Store', ['bog, købsgrænser,', '★ Sikring, ★ pulje,', 'afregning,', 'prislås 1,5 s']],
    ['Skærm', ['React ≤ 4 Hz,', 'canvas tegnet', 'imperativt', '(vifte, linjer)']],
  ];
  cols.forEach(([t, ls], i) => {
    const bx = 8 + i * (bw + gap);
    s += box(bx, y, bw, h, t, ls, i === 2 || i === 4 ? { stroke: C.over } : {});
    if (i < cols.length - 1) s += arrow(bx + bw + 1, y + h / 2, bx + bw + gap - 1, y + h / 2);
  });
  s += box(8 + 3 * (bw + gap), 196, 2 * bw + gap, 60, 'Monte Carlo-worker', ['5.000 stier pr. kørsel (fælles tilfældige tal)', '→ 100 stier stratificeret, så tally = viste chance', '★ også for Over 2,5'], { stroke: C.over });
  s += arrow(8 + 4 * (bw + gap) + 40, y + h + 1, 8 + 4 * (bw + gap) + 40, 194);
  s += arrow(8 + 5 * (bw + gap) - gap + 2, 226, 8 + 5 * (bw + gap) + 40, y + h + 3);
  s += T(8, 252, 'Tilstand = f(seed, tidslinje, k). Simulationen læser aldrig bogen, puljen eller Monte Carlo.', { size: 8.8, fill: C.text2 });
  s += T(8, 264, '★ = nyt i denne version', { size: 8.5, fill: C.over });
  return svg(W, H, s, 'Systemets dele');
}

// --- 5. Tidsskala -----------------------------------------------------------------------------------
function tidsskala({ story }) {
  const W = 712, H = 120;
  const x0 = 40, x1 = 680;
  let s = '';
  s += L(x0, 50, x1, 50, { stroke: C.axis, w: 1.5 });
  for (let i = 0; i <= 40; i++) {
    const xx = x0 + (i / 40) * (x1 - x0);
    const big = i % 10 === 0;
    s += L(xx, 50 - (big ? 14 : 6), xx, 50, { stroke: big ? C.text2 : C.axis, w: big ? 1.5 : 1 });
    if (big) s += T(xx, 74, `${i * 1.5} s`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  }
  s += T(x0, 24, '1 kampminut = 40 substeps = 4 sekunder ved ×1', { size: 10, weight: 650, fill: C.text });
  s += T(x1, 24, 'lange streger: DP-trin à 15 kampsekunder', { size: 8.8, anchor: 'end', fill: C.text2 });
  const k = story.final.k;
  s += T(x0, 96, `1 substep = 1,5 kampsekunder = 100 ms ved ×1. Hele kampen i historien: ${nf(k)} substeps (kampstart-auktion, 93′, pause og lukning) ≈ ${Math.floor(k / 600)} min ${Math.round((k / 10) % 60)} s ved ×1.`, { size: 9, fill: C.text2 });
  s += T(x0, 110, 'Demoen kører hurtigt i rolige perioder (op til ×16) og ved ×1, når noget sker.', { size: 9, fill: C.text2 });
  return svg(W, H, s, 'Tidsskala');
}

// --- 6. 5.000 stier → 100 ----------------------------------------------------------------------------
function stier({ mc20 }) {
  const W = 712, H = 262;
  const cols = [C.fck, C.x, C.bif];
  const names = ['FCK', 'X', 'BIF'];
  let s = HATCH;
  const n = mc20.n;
  s += box(8, 14, 178, 112, `${nf(n)} simulerede kampe`, ['fra NU (20′) til slutfløjt,', 'samme intensiteter som DP', '', ...mc20.mcShares.map((p, i) => `${names[i]} vinder i ${nf(p * 100, 1)} %`)]);
  s += box(8, 140, 178, 98, 'Stratificér efter viste chance', [`vist chance ${mc20.probs.map((p) => nf(p * 100, 0)).join(' / ')} %`, 'største rest-afrunding →', `${mc20.counts.join(' / ')} stier`, 'så tally = viste chance, altid']);
  s += arrow(188, 70, 214, 110);
  s += arrow(188, 190, 214, 150);
  const px0 = 236, px1 = 640, py0 = 16, py1 = 236;
  const t0 = mc20.tPts[0], tN = mc20.tPts[mc20.tPts.length - 1];
  const xs = (t) => px0 + ((t - t0) / (tN - t0)) * (px1 - px0);
  const ys = (v) => py1 - (v / 100) * (py1 - py0);
  s += axisY(px0, px1, ys, [0, 50, 100], (v) => String(v));
  for (const st of mc20.strands) s += P(st.v.map((v, i) => [xs(mc20.tPts[i]), ys(v)]), { stroke: cols[st.o], w: 0.8, op: 0.4 });
  s += T(px0, py1 + 16, `NU ${Math.floor(t0)}′`, { num: true, size: 8.5, fill: C.muted });
  s += T(px1, py1 + 16, '90+', { num: true, size: 8.5, anchor: 'end', fill: C.muted });
  const ends = [[0, 100], [1, 54], [2, 0]];
  ends.forEach(([o, y], i) => {
    s += Ci(px1 + 12, ys(i === 1 ? 12 : y) - 4, 3.5, { fill: cols[o] });
    s += T(px1 + 20, ys(i === 1 ? 12 : y), `${mc20.counts[o]} ${names[o]}`, { num: true, size: 10, weight: 650, fill: C.text });
  });
  s += T(px1 + 8, ys(70), 'kurs for', { size: 8.5, fill: C.muted });
  s += T(px1 + 8, ys(70) + 11, 'FCK langs', { size: 8.5, fill: C.muted });
  s += T(px1 + 8, ys(70) + 22, 'hver sti', { size: 8.5, fill: C.muted });
  return svg(W, H, s, 'Fra 5.000 til 100 stier');
}

// --- 7. Over 2,5 gennem kampen -----------------------------------------------------------------------
function over25Kamp({ story }) {
  const W = 712, H = 236;
  const x0 = 46, x1 = 640, y0 = 30, y1 = 196;
  const xs = (t) => x0 + (t / 93) * (x1 - x0);
  const ys = (v) => y1 - (v / 100) * (y1 - y0);
  let s = HATCH;
  s += axisY(x0, x1, ys, [0, 25, 50, 75, 100], (v) => String(v), { title: 'kurs' });
  for (const t of [0, 15, 30, 45, 60, 75, 90]) s += T(xs(t), y1 + 15, `${t}′`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  const ser = story.series.filter((p) => p.phase !== 'closed');
  s += P(ser.map((p) => [xs(p.t), ys(p.o25.fair * 100)]), { stroke: C.text, w: 1.2, dash: '3 3', op: 0.7 });
  s += P(ser.map((p) => [xs(p.t), ys(p.o25.ask[0])]), { stroke: C.over, w: 2 });
  for (const g of story.events.filter((e) => e.kind === 'goal')) {
    const r = story.events.find((e) => e.kind === 'reopen' && e.k > g.k);
    s += L(xs(g.t), y0, xs(g.t), y1, { stroke: C.muted, dash: '2 3' });
    s += T(xs(g.t) + (g.t > 80 ? -5 : 5), y0 + 10, `Mål ${g.team === 0 ? 'FCK' : 'BIF'} ${clock(g.t)} · ${r.gapO25 > 0 ? '+' : ''}${r.gapO25} point`, { size: 8.8, fill: C.text, anchor: g.t > 80 ? 'end' : 'start' });
  }
  const buy = story.final.log.find((e) => e.contract === 'tot:2.5:O' && e.kind === 'buy');
  const take = story.final.exits.find((e) => e.contract === 'tot:2.5:O' && e.kind === 'take');
  s += Ci(xs(buy.t), ys(buy.price), 4.5, { stroke: C.text, w: 1.6 });
  s += T(xs(buy.t) - 2, ys(buy.price) + 16, `køb @ ${buy.price}`, { size: 8.8, anchor: 'middle', fill: C.text });
  s += Ci(xs(take.fill.t), ys(take.fill.price), 4.5, { fill: C.up });
  s += T(xs(take.fill.t) - 8, ys(take.fill.price) - 2, `Sikr gevinst @ ${take.fill.price}`, { size: 8.8, fill: C.text, anchor: 'end' });
  s += L(xs(buy.t), ys(take.level), xs(take.fill.t), ys(take.level), { stroke: C.up, dash: '6 4', op: 0.8 });
  s += legend(x0, H - 4, [{ label: 'Over 2,5: kurs', color: C.over }, { label: 'fair chance × 100', color: C.text, dash: '3 3', w: 1.2 }, { label: 'Sikr gevinst 50', color: C.up, dash: '6 4' }]);
  s += T(x1 + 6, ys(story.series.filter((p) => p.t <= 92.9).at(-1).o25.ask[0]) + 3, 'udløber ved 1–1', { size: 8.5, fill: C.text2 });
  return svg(W, H, s, 'Over 2,5 gennem kampen');
}

// --- 8/9. Kalibrering ------------------------------------------------------------------------------
function kal(rows, label, col, intervals = false) {
  const W = 712, H = 272;
  const x0 = 48, x1 = 300, y0 = 26, y1 = 246;
  const xs = (v) => x0 + (v / 100) * (x1 - x0);
  const ys = (v) => y1 - (v / 100) * (y1 - y0);
  let s = '';
  s += axisY(x0, x1, ys, [0, 25, 50, 75, 100], (v) => String(v), { title: 'faktisk %' });
  for (const v of [0, 25, 50, 75, 100]) s += T(xs(v), y1 + 14, String(v), { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  s += T(x1, y1 + 26, 'pris %', { size: 8.5, anchor: 'end', fill: C.muted });
  s += L(xs(0), ys(0), xs(100), ys(100), { stroke: C.text2, dash: '3 4', op: 0.7 });
  for (const r of rows) {
    const se = r.se ?? Math.sqrt((r.p * (1 - r.p)) / r.n);
    s += L(xs(r.p * 100), ys(Math.max(0, (r.y - 3 * se) * 100)), xs(r.p * 100), ys(Math.min(1, (r.y + 3 * se)) * 100), { stroke: col, w: 1.4, op: 0.7 });
    s += Ci(xs(r.p * 100), ys(r.y * 100), 3.6, { fill: col });
  }
  // Table view beside the plot.
  const tx = 360;
  s += T(tx, 22, intervals ? 'Prisinterval' : 'Decil', { size: 8.8, weight: 650, fill: C.muted });
  s += T(tx + 110, 22, 'Pris', { size: 8.8, weight: 650, fill: C.muted, anchor: 'end' });
  s += T(tx + 190, 22, 'Faktisk', { size: 8.8, weight: 650, fill: C.muted, anchor: 'end' });
  s += T(tx + 260, 22, 'Afvigelse', { size: 8.8, weight: 650, fill: C.muted, anchor: 'end' });
  s += T(tx + 330, 22, 'Antal', { size: 8.8, weight: 650, fill: C.muted, anchor: 'end' });
  rows.forEach((r, i) => {
    const yy = 40 + i * 19.5;
    s += L(tx, yy + 6, tx + 336, yy + 6, { stroke: C.grid });
    const lo = Math.floor(r.p * 10) * 10;
    s += T(tx, yy, intervals ? `${lo}–${lo + 10} %` : String(i + 1), { num: true, size: 9, fill: C.text2 });
    s += T(tx + 110, yy, `${nf(r.p * 100, 1)} %`, { num: true, size: 9, anchor: 'end', fill: C.text });
    s += T(tx + 190, yy, `${nf(r.y * 100, 1)} %`, { num: true, size: 9, anchor: 'end', fill: C.text });
    const d = (r.y - r.p) * 100;
    s += T(tx + 260, yy, Math.abs(d) < 0.05 ? '0,0' : `${d >= 0 ? '+' : '−'}${nf(Math.abs(d), 1)}`, { num: true, size: 9, anchor: 'end', fill: C.text2 });
    s += T(tx + 330, yy, nf(r.n), { num: true, size: 9, anchor: 'end', fill: C.text2 });
  });
  s += Ci(x0 + 10, y0 + 8, 3.6, { fill: col });
  s += T(x0 + 18, y0 + 11, label, { size: 8.8, fill: C.text2 });
  s += L(x0 + 10, y0 + 20, x0 + 10, y0 + 30, { stroke: col, w: 1.4 });
  s += T(x0 + 18, y0 + 28, '± 3 standardfejl', { size: 8.8, fill: C.text2 });
  return svg(W, H, s, `Kalibrering: ${label}`);
}

// --- 10. Sikring-sporet -----------------------------------------------------------------------------
function sikringSpor({ story }) {
  const W = 712, H = 348;
  const tr = story.trace;
  const k0 = 1170, k1 = 1215;
  const x0 = 46, x1 = 520;
  const xs = (k) => x0 + ((k - k0) / (k1 - k0)) * (x1 - x0);
  const goal = story.events.find((e) => e.kind === 'goal');
  const reopen = story.events.find((e) => e.kind === 'reopen' && e.k > goal.k);
  const ex = Object.fromEntries(story.final.exits.map((e) => [`${e.contract}:${e.kind}`, e]));
  let s = HATCH;
  const panel = (py0, py1, vmax, title) => {
    const ys = (v) => py1 - (v / vmax) * (py1 - py0);
    let r = R(xs(goal.k), py0, xs(reopen.k) - xs(goal.k), py1 - py0, { fill: 'url(#hatch)' });
    r += R(xs(reopen.k), py0, xs(reopen.k + 8) - xs(reopen.k), py1 - py0, { fill: C.down, op: 0.07 });
    r += R(xs(reopen.k), py0, xs(reopen.k + 8) - xs(reopen.k), py1 - py0, { fill: 'url(#hatchc)' });
    const step = vmax > 60 ? 25 : 10;
    const ticks = [];
    for (let v = 0; v <= vmax; v += step) ticks.push(v);
    r += axisY(x0, x1, ys, ticks, (v) => String(v));
    r += T(x0, py0 - 6, title, { size: 10, weight: 650, fill: C.text });
    return { r, ys };
  };
  // BIF.
  const A = panel(30, 150, 50, 'BIF vinder: 769 andele @ kurs 26');
  s += A.r;
  s += P(tr.map((p) => [xs(p.k), A.ys(p.ask[2])]), { stroke: C.bif, w: 2 });
  s += P(tr.map((p) => [xs(p.k), A.ys(p.bid[2])]), { stroke: C.bif, w: 1.3, dash: '4 3', op: 0.8 });
  const stop = ex['1x2:B:stop'];
  const take = ex['1x2:B:take'];
  s += L(xs(k0), A.ys(stop.level), xs(stop.fill.k), A.ys(stop.level), { stroke: C.down, w: 1.4, dash: '2 4' });
  s += L(xs(k0), A.ys(take.level), xs(stop.fill.k), A.ys(take.level), { stroke: C.up, w: 1.4, dash: '6 4' });
  s += T(x0 + 4, A.ys(stop.level) - 4, `Stop ${stop.level}`, { size: 8.8, fill: C.text });
  s += T(x0 + 4, A.ys(take.level) - 4, `Sikr gevinst ${take.level} (annulleres)`, { size: 8.8, fill: C.text });
  const bidAtReopen = story.counterfactual.bidAtReopen;
  s += Ci(xs(reopen.k), A.ys(bidAtReopen), 4.5, { stroke: C.down, w: 1.6 });
  s += Ci(xs(stop.fill.k), A.ys(stop.fill.price), 4.5, { fill: C.down });
  s += T(x1 + 12, A.ys(26), 'Uden vagt: solgt ved genåbning', { size: 8.8, fill: C.text2 });
  s += T(x1 + 12, A.ys(26) + 12, `@ ${bidAtReopen} = ${kr(story.counterfactual.noGuardKr)} (hul ring)`, { size: 8.8, fill: C.text2 });
  s += T(x1 + 12, A.ys(14), `Med vagt: solgt ${clock(stop.fill.t)}`, { size: 8.8, fill: C.text });
  s += T(x1 + 12, A.ys(14) + 12, `@ ${stop.fill.price} = ${kr(stop.fill.kr)} (fyldt prik)`, { size: 8.8, fill: C.text });
  // Over.
  const B = panel(196, 300, 80, 'Over 2,5: 512 andele @ kurs 39');
  s += B.r;
  s += P(tr.map((p) => [xs(p.k), B.ys(p.o25.bid[0])]), { stroke: C.over, w: 2 });
  const otake = ex['tot:2.5:O:take'];
  const ostop = ex['tot:2.5:O:stop'];
  s += L(xs(k0), B.ys(otake.level), xs(otake.fill.k), B.ys(otake.level), { stroke: C.up, w: 1.4, dash: '6 4' });
  s += L(xs(k0), B.ys(ostop.level), xs(otake.fill.k), B.ys(ostop.level), { stroke: C.muted, w: 1.4, dash: '2 4' });
  s += T(x0 + 4, B.ys(otake.level) - 4, `Sikr gevinst ${otake.level}`, { size: 8.8, fill: C.text });
  s += T(x0 + 4, B.ys(ostop.level) + 12, `Stop ${ostop.level} (annulleres)`, { size: 8.8, fill: C.text2 });
  s += Ci(xs(otake.fill.k), B.ys(otake.fill.price), 4.5, { fill: C.up });
  s += T(x1 + 12, B.ys(56), `Sikr gevinst: solgt ${clock(otake.fill.t)}`, { size: 8.8, fill: C.text });
  s += T(x1 + 12, B.ys(56) + 12, `@ ${otake.fill.price} = ${kr(otake.fill.kr)}`, { size: 8.8, fill: C.text });
  s += T(x1 + 12, B.ys(56) + 24, 'ingen vagt: salgskurs ≥ niveau', { size: 8.8, fill: C.text2 });
  // Shared x axis.
  for (const k of [1170, goal.k, reopen.k, reopen.k + 8, 1215]) {
    const p = tr.find((q) => q.k === k) ?? tr[0];
    s += L(xs(k), 302, xs(k), 306, { stroke: C.axis });
    s += T(xs(k), 318, `${clock(p.t)}`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
    s += T(xs(k), 329, `k ${k}`, { num: true, size: 7.5, anchor: 'middle', fill: C.muted });
  }
  s += legend(x0, H - 2, [{ label: 'købskurs', color: C.bif }, { label: 'salgskurs', color: C.bif, dash: '4 3', w: 1.3 }, { label: 'Over salgskurs', color: C.over }]);
  s += R(x1 - 150, H - 12, 14, 9, { fill: 'url(#hatch)' }) + T(x1 - 132, H - 4, 'handelsstop', { size: 8.8 });
  s += R(x1 - 60, H - 12, 14, 9, { fill: C.down, op: 0.07 }) + R(x1 - 60, H - 12, 14, 9, { fill: 'url(#hatchc)' }) + T(x1 - 42, H - 4, 'vagt: 8 substeps', { size: 8.8 });
  return svg(W, H, s, 'Sikring gennem målet');
}

// --- 11. Puljens pengestrøm ---------------------------------------------------------------------------
function puljeFlow({ story }) {
  const W = 712, H = 214;
  const pc = story.poolClose;
  const total = pc.total;
  const cols = [C.fck, C.x, C.bif];
  const names = ['FCK', 'Uafgjort', 'BIF'];
  let s = HATCH;
  const maxw = 170;
  pc.sides.forEach((v, i) => {
    const y = 22 + i * 52;
    s += T(10, y + 4, names[i], { size: 10, weight: 650, fill: C.text });
    s += R(10, y + 10, (v / total) * maxw * 1.35, 12, { rx: 3, fill: cols[i], op: 0.9 });
    s += T(10, y + 36, `${kr(Math.round(v))}${pc.user[i] ? ` (heraf dine ${kr(pc.user[i])})` : ''}`, { num: true, size: 9, fill: C.text2 });
  });
  s += arrow(250, 90, 290, 90);
  s += box(292, 50, 130, 80, 'Puljen ved pausen', [kr(Math.round(total)), `${nf(pc.n)} indsatser`, 'låst: odds står fast']);
  s += arrow(422, 76, 462, 40);
  s += arrow(422, 104, 462, 140);
  s += box(464, 14, 120, 50, `Huset ${Math.round(pc.take * 100)} %`, [kr(Math.round(total * pc.take))]);
  s += box(464, 112, 120, 62, 'Til vinderne 90 %', [kr(Math.round(total * 0.9)), `vinder: ${names[story.final.poolResult.winner]} (1–1)`], { stroke: C.up });
  s += arrow(584, 143, 604, 143);
  const w = story.final.poolResult.winner;
  s += box(606, 100, 100, 86, 'Din andel', [`${kr(pc.user[w])} / ${kr(Math.round(pc.sides[w]))}`, `× ${kr(Math.round(total * 0.9))}`, `= ${kr(story.final.poolResult.payout)}`], { stroke: C.up });
  s += T(10, H - 6, 'Publikum er simuleret: siderne følger modellens fair pris med en lille hjemmebias. Din indsats ligger i din side.', { size: 8.8, fill: C.text2 });
  return svg(W, H, s, 'Puljens pengestrøm');
}

// --- 12. Puljen i første halvleg ----------------------------------------------------------------------
function puljeHalvleg({ story, stats }) {
  const W = 712, H = 246;
  const x0 = 46, x1 = 590, y0 = 28, y1 = 206;
  const vmin = 0.8, vmax = 1.0;
  const xs = (t) => x0 + (t / 45) * (x1 - x0);
  const ys = (v) => y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0);
  const ser = story.series.filter((p) => p.t <= 45 && p.phase !== 'HT' && p.t > 0.4);
  let s = '';
  s += axisY(x0, x1, ys, [0.8, 0.85, 0.9, 0.95, 1.0], (v) => nf(v, 2), { title: 'kr pr. krone' });
  for (const t of [0, 15, 30, 45]) s += T(xs(t), y1 + 15, `${t}′`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  const cols = [C.fck, C.x, C.bif];
  const names = ['FCK', 'X', 'BIF'];
  for (let i = 0; i < 3; i++) {
    const pts = ser.map((p) => [xs(p.t), ys(Math.max(vmin, Math.min(vmax, p.fair[i] * p.pool.odds[i])))]);
    s += P(pts, { stroke: cols[i], w: 1.5, op: 0.9 });
  }
  // At the close the sides snap to fair: these are the values that count.
  const pc = story.poolClose;
  const ev = pc.fair.map((f, i) => f * pc.odds[i]);
  const order = [0, 1, 2].sort((a, b) => ev[b] - ev[a]);
  let lastY = -1e9;
  for (const i of order) {
    s += Ci(xs(45), ys(ev[i]), 3.8, { fill: cols[i], stroke: C.surface, w: 1.5 });
    let ly = ys(ev[i]) + 3;
    if (ly - lastY < 11) ly = lastY + 11;
    lastY = ly;
    s += T(x1 + 10, ly, `${names[i]} ${nf(ev[i], 3)}`, { num: true, size: 9, fill: C.text });
  }
  s += T(x1 + 10, ys(ev[order[0]]) - 12, 'ved lukning', { size: 8.5, fill: C.muted });
  s += L(x0, ys(stats.poolBoundMax), x1, ys(stats.poolBoundMax), { stroke: C.text, dash: '5 4', op: 0.8 });
  s += T(x0 + 4, ys(stats.poolBoundMax) - 4, `strukturel grænse ${nf(stats.poolBoundMax, 3)}`, { size: 8.8, fill: C.text });
  s += legend(x0, H - 4, names.map((n, i) => ({ label: `${n}: fair × puljeodds lige nu`, color: cols[i], w: 1.8 })));
  return svg(W, H, s, 'Puljen i første halvleg');
}

// --- 13. Grænsen -----------------------------------------------------------------------------------
function puljeGraense({ stats }) {
  const W = 712, H = 218;
  const x0 = 46, x1 = 600, y0 = 26, y1 = 180;
  const vmin = 0.84, vmax = 0.96;
  const xs = (q) => x0 + ((q - 0.05) / 0.9) * (x1 - x0);
  const ys = (v) => y1 - ((v - vmin) / (vmax - vmin)) * (y1 - y0);
  let s = '';
  s += axisY(x0, x1, ys, [0.84, 0.88, 0.92, 0.96], (v) => nf(v, 2), { title: 'kr pr. krone' });
  for (const q of [0.05, 0.25, 0.5, 0.75, 0.95]) s += T(xs(q), y1 + 15, `${nf(q * 100)} %`, { num: true, size: 8.5, anchor: 'middle', fill: C.muted });
  s += T(x1, y1 + 28, 'FCK’s chance (X og BIF deler resten 55:45)', { size: 8.5, anchor: 'end', fill: C.muted });
  const b = stats.poolBound;
  s += P(b.map((r) => [xs(r.qf), ys(r.perKr[0])]), { stroke: C.fck, w: 2 });
  s += P(b.map((r) => [xs(r.qf), ys(r.perKr[1])]), { stroke: C.bif, w: 2 });
  s += T(x1 + 8, ys(b.at(-1).perKr[1]) + 3, 'X og BIF', { size: 9, fill: C.text });
  s += T(x1 + 8, ys(b.at(-1).perKr[0]) + 3, 'FCK', { size: 9, fill: C.text });
  s += L(x0, ys(0.95), x1, ys(0.95), { stroke: C.text, dash: '5 4', op: 0.7 });
  s += T(x0 + 4, ys(0.95) - 4, 'testgrænse 0,95', { size: 8.8, fill: C.text });
  s += T(x0 + 4, ys(stats.poolBoundMax) + 12, `maksimum 0,9 · 1,035 / 0,985 = ${nf(stats.poolBoundMax, 3)}`, { size: 8.8, fill: C.text2 });
  return svg(W, H, s, 'Grænsen for forventet udbytte');
}

export function figures(ctx) {
  return {
    tidslinje: tidslinje(ctx),
    'kurs-chance': kursChance(ctx),
    skaermkort: skaermkort(ctx),
    system: system(ctx),
    tidsskala: tidsskala(ctx),
    stier: stier(ctx),
    'over25-kamp': over25Kamp(ctx),
    'kal-o25': kal(ctx.stats.calO25, 'Over 2,5: pris mod faktisk', C.over),
    'kal-1x2': kal(ctx.stats.cal1x2, 'FCK vinder: pris mod faktisk', C.fck, true),
    'sikring-spor': sikringSpor(ctx),
    'pulje-flow': puljeFlow(ctx),
    'pulje-halvleg': puljeHalvleg(ctx),
    'pulje-graense': puljeGraense(ctx),
  };
}
