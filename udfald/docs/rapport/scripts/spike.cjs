const path = require('node:path');
const { serve } = require('./serve.cjs');
const { chromium } = require('playwright');
(async () => {
  const s = await serve(4311);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://127.0.0.1:4311/out/spike/spike.html');
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, '..', 'out', 'spike', 'spike.pdf'), printBackground: true, preferCSSPageSize: true, outline: true, tagged: true });
  await b.close(); s.close();
})();
