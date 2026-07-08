// v1.1 visual gate: default shape at load, legend on pressure overlay,
// portrait + landscape phone viewports, desktop gauges with fluctuation band.
import { chromium } from 'playwright';

const outDir = process.argv[2] ?? '.';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});

// Desktop: default load (circle should be in the wind immediately) + gauges band
const desk = await browser.newPage({ viewport: { width: 1100, height: 800 } });
desk.on('pageerror', (e) => console.error('[pageerror]', e.message));
await desk.goto('http://localhost:4173/Test/vindtunnel/', { waitUntil: 'load' });
await desk.waitForTimeout(9000);
await desk.screenshot({ path: `${outDir}/v11-desktop-default.png` });

// Pressure overlay → legend visible
await desk.locator('select').first().selectOption('pressure');
await desk.waitForTimeout(2500);
await desk.screenshot({ path: `${outDir}/v11-desktop-tryk-legende.png` });
await desk.close();

// Portrait phone
const port = await browser.newPage({ viewport: { width: 390, height: 844 } });
await port.goto('http://localhost:4173/Test/vindtunnel/', { waitUntil: 'load' });
await port.waitForTimeout(5000);
await port.screenshot({ path: `${outDir}/v11-portrait.png` });
await port.close();

// Landscape phone
const land = await browser.newPage({ viewport: { width: 844, height: 390 } });
await land.goto('http://localhost:4173/Test/vindtunnel/', { waitUntil: 'load' });
await land.waitForTimeout(5000);
await land.screenshot({ path: `${outDir}/v11-landscape.png` });
await land.close();

await browser.close();
console.log('v1.1 screenshots ok');
