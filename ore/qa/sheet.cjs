/* Builds side-by-side contact sheets from qa/out/lookdev-*.png. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(__filename);
let pw; for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = req(c); break; } catch (_) {} }
const OUT = path.join(__dirname, 'out');
const sets = [['844', '27'], ['844', '70'], ['664', '27']];
const names = { lyn: 'A · Lyn', langtid: 'B · Langtid', spaghetti: 'C · Spaghetti' };
(async () => {
  const b = await pw.chromium.launch();
  for (const [h, sc] of sets) {
    const imgs = ['lyn', 'langtid', 'spaghetti'].map((v) => {
      const data = fs.readFileSync(path.join(OUT, `lookdev-${h}-${sc}-${v}.png`)).toString('base64');
      return `<figure><img src="data:image/png;base64,${data}"><figcaption>${names[v]}</figcaption></figure>`;
    }).join('');
    const p = await b.newPage({ viewport: { width: 3 * 390 + 4 * 24, height: Number(h) + 90 }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#000;font:600 18px Arial;color:#b9c2ce;display:flex;gap:24px;padding:16px 24px">
      <style>figure{margin:0}img{width:390px;height:${h}px;display:block;border:1px solid #232a35;border-radius:18px}figcaption{padding-top:10px;text-align:center}</style>${imgs}</body>`);
    const file = path.join(OUT, `sheet-${h}-${sc}.png`);
    await p.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await b.close();
})();
