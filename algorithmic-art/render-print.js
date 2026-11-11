#!/usr/bin/env node
// Renders a Tidal Memory composition at print resolution in headless Chromium.
// The page runs the exact same seeded simulation as the preview, drawn through a scale
// transform, so the print is the preview stroke for stroke, only sharper.
//
// Usage:
//   node render-print.js --settings '<JSON from "Copy settings">' --long 9000 --out print.png
//   node render-print.js --settings settings.json --long 9000 --out print.jpg --quality 0.95
//
// --long     pixel length of the long side (2:3 format with --long 9000 gives 6000 × 9000)
// --caption  add the seed/particle caption (off by default for prints)

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

function arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
}

(async () => {
    const raw = arg('settings', '{}');
    const settings = JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
    if (!process.argv.includes('--caption')) settings.caption = false;
    const longSide = Number(arg('long', 9000));
    const out = path.resolve(arg('out', 'tidal-memory-print.png'));
    const mime = /\.jpe?g$/i.test(out) ? 'image/jpeg' : 'image/png';
    const quality = Number(arg('quality', 0.95));

    // The artifact source has no document skeleton; give it one for local rendering.
    const html = fs.readFileSync(path.join(__dirname, 'tidal-memory.html'), 'utf8');
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tidal-')), 'page.html');
    fs.writeFileSync(tmp, `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${html}</body></html>`);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('pageerror', (e) => { console.error('Page error:', e.message); process.exit(1); });
    await page.goto(`file://${tmp}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof canvasEl !== 'undefined' && canvasEl !== null, null, { timeout: 60000 });

    const t0 = Date.now();
    const info = await page.evaluate(async ({ settings, longSide, mime, quality }) => {
        const colors = { ...params.colors, ...(settings.colors || {}) };
        Object.assign(params, settings, { colors });
        applyFormat();
        const scale = longSide / Math.max(W, H);
        const c = renderStill(scale);
        const blob = await new Promise((resolve) => c.toBlob(resolve, mime, quality));
        if (!blob) throw new Error('The browser could not encode a canvas this large.');
        window.__printBytes = new Uint8Array(await blob.arrayBuffer());
        return { width: c.width, height: c.height, bytes: window.__printBytes.length, scale, params };
    }, { settings, longSide, mime, quality });

    // Move the encoded file out of the page in chunks; one giant string is slow and fragile.
    const fd = fs.openSync(out, 'w');
    const CHUNK = 4 * 1024 * 1024;
    for (let off = 0; off < info.bytes; off += CHUNK) {
        const b64 = await page.evaluate(({ off, CHUNK }) => {
            const part = window.__printBytes.subarray(off, off + CHUNK);
            let bin = '';
            for (let i = 0; i < part.length; i += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000));
            return btoa(bin);
        }, { off, CHUNK });
        fs.writeSync(fd, Buffer.from(b64, 'base64'));
    }
    fs.closeSync(fd);
    await browser.close();

    const mb = (info.bytes / 1048576).toFixed(1);
    console.log(`${out}\n${info.width} × ${info.height} px · scale ${info.scale} · ${mb} MB · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    console.log(`settings: ${JSON.stringify(info.params)}`);
})();
