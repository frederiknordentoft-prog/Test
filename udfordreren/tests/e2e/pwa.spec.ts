import { expect, test, type Page } from '@playwright/test';

// Fase 8 (spec 3 "Levering" og 4): installerbar PWA, der virker offline, og gem/indlæs, der tåler private vinduer
// og korrupte filer. Kører mod produktionsbuilden (npm run build + vite preview), hvor service workeren findes.

type Manifest = {
  name: string;
  short_name: string;
  lang: string;
  display: string;
  start_url: string;
  scope: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

function lytEfterFejl(page: Page): string[] {
  const fejl: string[] = [];
  page.on('pageerror', (e) => fejl.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') fejl.push(m.text());
  });
  return fejl;
}

async function nytSpil(page: Page) {
  await page.getByTestId('stifter-oddssaetteren').click();
  await page.getByTestId('stifter-udvikleren').click();
  await page.getByTestId('vertikal-betting').click();
  await page.getByTestId('start-spil').click();
  await expect(page.getByTestId('spilskaerm')).toBeVisible();
}

test.describe('PWA', () => {
  test('manifestet har navn, sprog, standalone og ikonerne 192, 512 og maskable 512', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('titelskaerm')).toBeVisible();
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifestUrl = new URL(href!, page.url()).href;
    const res = await page.request.get(manifestUrl);
    expect(res.ok()).toBe(true);
    const m = (await res.json()) as Manifest;
    expect(m.name).toBe('Spilhuset: Udfordreren');
    expect(m.short_name).toBe('Udfordreren');
    expect(m.lang).toBe('da');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);

    const ikon = (sizes: string, purpose: string) => m.icons.find((i) => i.sizes === sizes && (i.purpose ?? 'any').split(' ').includes(purpose));
    const krav = [ikon('192x192', 'any'), ikon('512x512', 'any'), ikon('512x512', 'maskable')];
    for (const i of krav) {
      expect(i, 'ikon mangler i manifestet').toBeTruthy();
      const url = new URL(i!.src, manifestUrl).href;
      const billede = await page.evaluate(async (u) => {
        const r = await fetch(u);
        const bmp = await createImageBitmap(await r.blob());
        return { ok: r.ok, type: r.headers.get('content-type') ?? '', b: bmp.width, h: bmp.height };
      }, url);
      expect(billede.ok).toBe(true);
      expect(billede.type).toContain('image/png');
      expect(`${billede.b}x${billede.h}`).toBe(i!.sizes);
    }
    // iOS: hjemmeskærmsikon og app-tilstand
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  });

  test('service workeren registreres, og efter første indlæsning virker spillet offline', async ({ page, context }) => {
    const fejl = lytEfterFejl(page);
    await page.goto('/');
    await expect(page.getByTestId('titelskaerm')).toBeVisible();
    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, script: reg.active?.scriptURL ?? '' };
    });
    expect(sw.script).toMatch(/\/sw\.js$/);
    // Første gang: en venlig besked om, at spillet er klar til offline brug
    await expect(page.getByTestId('pwa-offline')).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByTestId('titelskaerm')).toBeVisible({ timeout: 15_000 });
      // Og der kan spilles uden net
      await nytSpil(page);
    } finally {
      await context.setOffline(false);
    }
    expect(fejl).toEqual([]);
  });
});

test.describe('Gem og indlæs', () => {
  test('uden lokal lagring (privat vindue) kører spillet videre med en synlig besked, og eksport virker', async ({ page }) => {
    const fejl = lytEfterFejl(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
    });
    await page.goto('/');
    await expect(page.getByTestId('pwa-lagring')).toBeVisible({ timeout: 10_000 });
    await nytSpil(page);
    await page.getByTestId('gem-knap').click();
    await expect(page.getByTestId('lagring-advarsel')).toBeVisible();
    await expect(page.getByTestId('gem-slot1')).toBeDisabled();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('eksporter-nu').click()]);
    expect(dl.suggestedFilename()).toMatch(/^udfordreren-.*\.json$/);
    expect(fejl).toEqual([]);
  });

  test('korrupte filer giver en venlig fejl uden nedbrud', async ({ page }) => {
    const fejl = lytEfterFejl(page);
    await page.goto('/');
    await nytSpil(page);
    await page.getByTestId('gem-knap').click();
    await expect(page.getByTestId('dialog-gemIndlaes')).toBeVisible();
    const filer: [string, string, RegExp][] = [
      ['ugyldig.json', '{"app":"udfordreren","state":{"version":2,', /ikke gyldig JSON/],
      ['version.json', JSON.stringify({ app: 'udfordreren', state: { version: 99, uge: 3 } }), /nyere version/],
      ['mangler.json', JSON.stringify({ app: 'udfordreren', state: { version: 2, uge: 3, kapital: 1, seed: 1 } }), /mangler dele af spillet/],
      ['fremmed.json', JSON.stringify({ hej: 'verden' }), /ikke en gemt fil fra Udfordreren/],
    ];
    for (const [navn, indhold, forventet] of filer) {
      await page.getByTestId('importer-fil').setInputFiles({ name: navn, mimeType: 'application/json', buffer: Buffer.from(indhold) });
      await expect(page.getByTestId('import-fejl')).toContainText(navn);
      await expect(page.getByTestId('import-fejl')).toContainText(forventet);
      await expect(page.getByTestId('spilskaerm')).toBeVisible();
    }
    expect(fejl).toEqual([]);
  });
});
