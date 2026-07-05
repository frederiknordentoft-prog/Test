// Quick layout check: wind tunnel with gauges below + the electricity dashboard sub-app.
import { chromium } from 'playwright';

const outDir = process.argv[2] ?? '.';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto('http://localhost:4173/Test/', { waitUntil: 'load' });
await page.getByRole('button', { name: /Firkant/ }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${outDir}/check-gauges.png` });

await page.goto('http://localhost:4173/Test/apps/electricity-price-dashboard-3J4IT/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/check-dashboard.png` });

await page.goto('http://localhost:4173/Test/apps/', { waitUntil: 'load' });
await page.screenshot({ path: `${outDir}/check-apps-index.png` });
await browser.close();
console.log('ok');
