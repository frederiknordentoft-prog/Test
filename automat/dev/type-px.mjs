import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
for (const f of process.argv.slice(2)) {
  const [file, ...pts] = f.split(':');
  const data = (await import('fs')).readFileSync(file).toString('base64');
  const out = await page.evaluate(async ([d, pts]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return pts.map((p) => { const [x, y] = p.split(',').map(Number); return [x, y, ...g.getImageData(x, y, 1, 1).data]; });
  }, [data, pts]);
  console.log(file, JSON.stringify(out));
}
await browser.close();
