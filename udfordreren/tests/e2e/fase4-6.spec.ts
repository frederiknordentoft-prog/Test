import { expect, test, type Page } from '@playwright/test';

// Fase 4-6 integreret: alle faner åbner deres panel, AI-lab er låst før 2026 og åbent bagefter,
// og debug-hoppet til december 2035 ender på slutskærmen. Uden fejl i konsollen.

const PANELER = ['projekter', 'personale', 'kontrakter', 'hitliste', 'produkter', 'marked', 'konkurrenter', 'platform', 'by', 'firma', 'ailab', 'kombinationer', 'nyheder', 'arkiv'];

type Krog = { useGame: { getState(): { debugHopTilAar(aar: number): void; game: { uge: number; slut: unknown } | null } } };

async function nytSpil(page: Page) {
  await page.goto('/?debug=1');
  await page.getByTestId('stifter-oddssaetteren').click();
  await page.getByTestId('stifter-udvikleren').click();
  await page.getByTestId('vertikal-betting').click();
  await page.getByTestId('start-spil').click();
  await expect(page.getByTestId('spilskaerm')).toBeVisible();
}

async function hop(page: Page, aar: number) {
  await page.evaluate((a) => (window as unknown as { __udfordreren: Krog }).__udfordreren.useGame.getState().debugHopTilAar(a), aar);
}

test('alle faner, AI-lab før og efter 2026, og slutskærmen', async ({ page }) => {
  const fejl: string[] = [];
  page.on('pageerror', (e) => fejl.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') fejl.push(m.text());
  });
  await nytSpil(page);

  // Hver fane viser sit panel (panel-<id>)
  for (const id of PANELER) {
    await page.getByTestId(`fane-${id}`).click();
    await expect(page.getByTestId(`panel-${id}`).first()).toBeVisible();
  }

  // AI-lab er låst med en teaser før 2026
  await expect(page.getByTestId('fane-laas-ailab')).toBeVisible();
  await page.getByTestId('fane-ailab').click();
  await expect(page.getByTestId('ailab-teaser')).toBeVisible();

  // Efter akt-skiftet er laboratoriet åbent
  await hop(page, 2026);
  await expect(page.getByTestId('fane-laas-ailab')).toHaveCount(0);
  await expect(page.getByTestId('ailab-teaser')).toHaveCount(0);
  await expect(page.getByTestId('deploy-agent')).toBeVisible();

  // Hop til slutningen (december 2035)
  await hop(page, 2036);
  await expect(page.getByTestId('dialog-slut')).toBeVisible();
  expect(fejl).toEqual([]);
});
