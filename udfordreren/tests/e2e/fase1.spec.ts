import { expect, test, type Page } from '@playwright/test';

async function nytSpil(page: Page) {
  await page.goto('/?debug=1');
  await page.getByTestId('stifter-oddssaetteren').click();
  await page.getByTestId('stifter-udvikleren').click();
  await page.getByTestId('vertikal-betting').click();
  await page.getByTestId('start-spil').click();
  await expect(page.getByTestId('spilskaerm')).toBeVisible();
}

/** Luk signal-dialoger og fortsæt, indtil betingelsen er opfyldt */
async function spilIndtil(page: Page, betingelse: () => Promise<boolean>, maxMs: number) {
  const slut = Date.now() + maxMs;
  while (Date.now() < slut) {
    if (await betingelse()) return true;
    const dialog = page.locator('[role=dialog]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const knapper = dialog.locator('footer button, [data-testid^=valg-]');
      const n = await knapper.count();
      if (n > 0) await knapper.last().click().catch(() => {});
      else await page.keyboard.press('Escape');
    }
    const fortsaet = page.getByTestId('fortsaet');
    if (await fortsaet.isVisible().catch(() => false)) await fortsaet.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  return false;
}

test('nyt spil → kontraktopgave → første produkt → anmeldelse inden for 90 sek.', async ({ page }) => {
  const fejl: string[] = [];
  page.on('pageerror', (e) => fejl.push(String(e)));
  const t0 = Date.now();
  await nytSpil(page);
  // Kontraktopgave, mens licensen behandles
  await page.getByTestId('fane-kontrakter').click();
  const tag = page.locator('[data-testid^=tag-kontrakt-]').first();
  await tag.click();
  // Første produkt
  await page.getByTestId('fane-projekter').click();
  await page.getByTestId('nyt-produkt').click();
  await expect(page.getByTestId('dialog-nytProdukt')).toBeVisible();
  await page.getByTestId('start-udvikling').click();
  await expect(page.getByTestId('dialog-nytProdukt')).toBeHidden();
  // Spil (4x) til projektet er klar og licensen er aktiv, lancér
  await page.getByTestId('tempo-4').click();
  const lanceret = await spilIndtil(
    page,
    async () => {
      const knap = page.locator('[data-testid^=lancer-]').first();
      if ((await knap.isVisible().catch(() => false)) && (await knap.isEnabled().catch(() => false))) {
        await knap.click();
        return true;
      }
      return false;
    },
    80_000,
  );
  expect(lanceret).toBe(true);
  await expect(page.getByTestId('dialog-anmeldelse')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(90_000);
  expect(fejl).toEqual([]);
});

test('reload midt i spillet genopretter autosave', async ({ page }) => {
  await nytSpil(page);
  await page.getByTestId('tempo-4').click();
  // Spil ind i andet kvartal (autosave ved kvartalsskift)
  await spilIndtil(page, async () => (await page.getByTestId('dato').textContent())?.includes('apr.') ?? false, 60_000);
  await page.reload();
  await expect(page.getByTestId('fortsaet-auto')).toBeVisible();
  await page.getByTestId('fortsaet-auto').click();
  await expect(page.getByTestId('spilskaerm')).toBeVisible();
});
