// Amplify a screenshot region to reveal banding: node dev/sky-amp.mjs <in.png> <out.png> <x,y,w,h> [gain]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [inp, out, clip, gain = '5'] = process.argv.slice(2);
const [x, y, w, h] = clip.split(',').map(Number);
const b64 = readFileSync(inp).toString('base64');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: w * 2, height: h * 2 } });
await page.setContent(`<body style="margin:0;background:#000;overflow:hidden"><div style="width:${w * 2}px;height:${h * 2}px;overflow:hidden"><img src="data:image/png;base64,${b64}" style="transform-origin:0 0;transform:scale(2) translate(${-x}px,${-y}px);image-rendering:pixelated;filter:brightness(${gain})"></div></body>`);
await page.waitForTimeout(200);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
