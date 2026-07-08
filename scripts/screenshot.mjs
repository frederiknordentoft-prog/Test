// Visual smoke test: load the app, drop a primitive in the wind, screenshot.
import { chromium } from 'playwright';

const outDir = process.argv[2] ?? '.';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('http://localhost:4173/Test/vindtunnel/', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}/shot-1-tom.png` });

// square in the wind, speed overlay
await page.getByRole('button', { name: /Firkant/ }).click();
await page.locator('select').first().selectOption('speed');
await page.waitForTimeout(12000);
await page.screenshot({ path: `${outDir}/shot-2-firkant-fart.png` });

// teardrop with vorticity
await page.getByRole('button', { name: /Dråbe/ }).click();
await page.locator('select').first().selectOption('vorticity');
await page.waitForTimeout(8000);
await page.screenshot({ path: `${outDir}/shot-3-draabe-hvirvler.png` });

// smoke only
await page.locator('select').first().selectOption('none');
await page.getByRole('button', { name: /Firkant/ }).click();
await page.waitForTimeout(14000);
await page.screenshot({ path: `${outDir}/shot-4-roeg.png` });

await browser.close();
console.log('screenshots gemt');
