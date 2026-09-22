// Contact sheet: node dev/sky-sheet.mjs <out.png> <cols> <cellW> <label=path>...
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, cols, cellW, ...items] = process.argv.slice(2);
const cells = items.map((it) => { const [label, path] = it.split('='); const b64 = readFileSync(path).toString('base64'); return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${label}</figcaption></figure>`; }).join('');
const html = `<html><body style="margin:0;background:#111;color:#ccc;font:12px system-ui"><div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:6px;padding:6px">${cells}</div><style>figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 0}</style></body></html>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: cols * (+cellW + 6) + 6, height: 400 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(out);
