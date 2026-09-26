import { expect, test as base, type Locator, type Page } from '@playwright/test';

// Definition of Done, end-to-end (spec 3): de syv flows spillet gennem brugerfladen — UI-klik, og debug-menuen til
// hop i tid. Alle kører på laptop. Røgtesten (tagget @roeg: nyt spil + reload) kører også på iPad og mobil med touch
// (se projekterne i playwright.config.ts). Ingen test må give en pageerror eller en fejl i konsollen, og hver test
// skal holde sig under 3 minutter. Selektorerne er data-testid'er.

/** Fast seed: samme verden hver gang (tiden går stadig i vægurstid, så enkelte uger kan variere fra kørsel til kørsel) */
const SEED = 2012;

/** Fanger pageerror og console.error i hver test — og dumper testen, hvis der kom nogen */
const test = base.extend<{ konsolFejl: string[] }>({
  konsolFejl: [
    async ({ page }, brug) => {
      const fejl: string[] = [];
      page.on('pageerror', (e) => fejl.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') fejl.push(`console.error: ${m.text()}`);
      });
      await brug(fejl);
      expect(fejl, 'ingen fejl i konsollen').toEqual([]);
    },
    { auto: true },
  ],
});

// ---------- Hjælpere ----------

type Tilstand = {
  firma: string;
  uge: number;
  kapital: number;
  mentor: string;
  staff: number;
  agenter: number;
  verdensscenarier: number;
  slut: boolean;
  paused: boolean;
};

/** Et øjebliksbillede af spillet via testkrogen window.__udfordreren (findes i dev og med ?debug=1) */
async function tilstand(page: Page): Promise<Tilstand> {
  return page.evaluate(() => {
    type G = {
      firmaNavn: string;
      uge: number;
      kapital: number;
      mentor: string;
      staff: unknown[];
      agenter: unknown[];
      verdensscenarier: Record<string, number>;
      slut: unknown;
    };
    const krog = (window as unknown as { __udfordreren: { useGame: { getState(): { game: G | null; paused: boolean } } } }).__udfordreren;
    const st = krog.useGame.getState();
    const g = st.game;
    if (!g) throw new Error('Der er intet spil i gang');
    return {
      firma: g.firmaNavn,
      uge: g.uge,
      kapital: g.kapital,
      mentor: g.mentor,
      staff: g.staff.length,
      agenter: g.agenter.length,
      verdensscenarier: Object.keys(g.verdensscenarier).length,
      slut: g.slut !== null,
      paused: st.paused,
    };
  });
}

/**
 * Tryk: tap på touch-enheder (iPad og mobil), klik ellers.
 * Kort frist: en uventet dialog skal give en tydelig fejl, ikke en test, der hænger i 3 minutter.
 */
async function tryk(el: Locator, timeout = 15_000): Promise<void> {
  if (test.info().project.use.hasTouch) await el.tap({ timeout });
  else await el.click({ timeout });
}

async function nytSpil(page: Page, { firma = 'Testhuset ApS', tutorial = false }: { firma?: string; tutorial?: boolean } = {}): Promise<void> {
  await page.goto(`/?debug=1&seed=${SEED}`);
  await expect(page.getByTestId('titelskaerm')).toBeVisible();
  await page.getByTestId('firmanavn').fill(firma);
  await tryk(page.getByTestId('stifter-oddssaetteren'));
  await tryk(page.getByTestId('stifter-udvikleren'));
  await expect(page.getByTestId('stifter-antal')).toHaveText('2/2');
  await tryk(page.getByTestId('vertikal-betting'));
  await expect(page.getByTestId('vertikal-betting')).toHaveAttribute('aria-pressed', 'true');
  // Kontakten "Mentor": Knuds tutorial til eller fra
  const kontakt = page.getByTestId('tutorial');
  if ((await kontakt.getAttribute('aria-checked')) !== String(tutorial)) await tryk(kontakt);
  await expect(kontakt).toHaveAttribute('aria-checked', String(tutorial));
  await tryk(page.getByTestId('start-spil'));
  await expect(page.getByTestId('spilskaerm')).toBeVisible();
  await expect(page.getByTestId('hud-firma')).toHaveText(firma);
}

/** Skift fane — på mobil ligger nogle faner under "Mere". Kommer en dialog imellem, lukkes den, og der prøves igen. */
async function fane(page: Page, id: string): Promise<void> {
  const knap = page.getByTestId(`fane-${id}`);
  for (let forsoeg = 0; forsoeg < 6; forsoeg++) {
    await lukDialoger(page);
    try {
      if (!(await knap.isVisible())) await tryk(page.getByTestId('fane-mere'), 3_000);
      await tryk(knap, 3_000);
      await expect(page.getByTestId(`panel-${id}`).first()).toBeVisible({ timeout: 3_000 });
      return;
    } catch {
      // en dialog kom imellem
    }
  }
  throw new Error(`Fanen "${id}" kunne ikke åbnes`);
}

/** Pause eller fortsæt med pauseknappen i HUD'en */
async function saetPause(page: Page, pause: boolean): Promise<void> {
  await lukDialoger(page);
  if ((await tilstand(page)).paused !== pause) await tryk(page.getByTestId('pause-knap'));
  await expect.poll(async () => (await tilstand(page)).paused).toBe(pause);
}

async function tempo(page: Page, x: 1 | 2 | 4): Promise<void> {
  await lukDialoger(page);
  const knap = page.getByTestId(`tempo-${x}`);
  if (await knap.isVisible()) {
    await tryk(knap);
    return;
  }
  // Mobil: én knap, der skifter 1x → 2x → 4x
  const skift = page.getByTestId('tempo-skift');
  for (let i = 0; i < 3 && (await skift.textContent())?.trim() !== `${x}x`; i++) await tryk(skift);
  await expect(skift).toHaveText(`${x}x`);
}

/** Knapper, der lukker en signal-dialog uden at træffe et stort valg (fx aldrig "Sælg firmaet") */
const SIKKER_LUK = [
  'galla-vis-alle', 'galla-ok', 'anmeldelse-ok', 'milepael-ok', 'kvartal-ok', 'messe-ok', 'messe-spring-over', 'markedAabner-senere',
  'aktSkift-luk', 'verdensNyhed-ok', 'regel-ok', 'sanktion-ok', 'reaktion-ok', 'tilbud-senere', 'tilbud-ok', 'sponsor-byd-ikke',
  'sponsor-ok', 'arkiv-luk',
];

/** Luk den øverste dialog (medmindre den skal blive stående). false = der var ingen at lukke. */
async function lukOeversteDialog(page: Page, behold: string[] = []): Promise<boolean> {
  const dialog = page.locator('[role=dialog][aria-modal=true]').last();
  if (!(await dialog.isVisible().catch(() => false))) return false;
  const id = (await dialog.getAttribute('data-testid').catch(() => null)) ?? '';
  if (id === 'dialog-slut' || behold.includes(id)) return false;
  if (id === 'dialog-event') {
    // Hændelser kan ikke lukkes: vælg den første mulighed, der kan vælges
    for (const v of await dialog.getByTestId(/^valg-\d+$/).all()) {
      if (await v.isEnabled().catch(() => false)) {
        await v.click({ timeout: 3_000 }).catch(() => {});
        return true;
      }
    }
  }
  for (const k of SIKKER_LUK) {
    const knap = dialog.getByTestId(k);
    if ((await knap.isVisible().catch(() => false)) && (await knap.isEnabled().catch(() => false))) {
      await knap.click({ timeout: 3_000 }).catch(() => {});
      return true;
    }
  }
  await page.keyboard.press('Escape');
  return true;
}

/** Luk signal-dialoger, indtil der ingen er tilbage (eller den, der skal blive stående, ligger øverst) */
async function lukDialoger(page: Page, behold: string[] = []): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (!(await lukOeversteDialog(page, behold))) return;
    await page.waitForTimeout(150);
  }
  throw new Error('Dialogerne blev ved med at komme');
}

/**
 * Lad tiden gå (luk dialoger og tryk "Fortsæt" ved auto-pauser), indtil betingelsen er opfyldt.
 * behold: dialoger, der ikke må lukkes undervejs (dem venter betingelsen typisk på).
 */
async function spilIndtil(page: Page, hvad: string, betingelse: () => Promise<boolean>, maxMs: number, behold: string[] = []): Promise<void> {
  const slut = Date.now() + maxMs;
  while (Date.now() < slut) {
    if (await betingelse()) return;
    if (!(await lukOeversteDialog(page, behold))) {
      const fortsaet = page.getByTestId('fortsaet');
      if (await fortsaet.isVisible().catch(() => false)) await fortsaet.click({ timeout: 3_000 }).catch(() => {});
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`Nåede ikke "${hvad}" inden for ${Math.round(maxMs / 1000)} sek.`);
}

const synlig = (el: Locator) => el.isVisible().catch(() => false);

/** Debug-menuen (?debug=1): hop til et år (2036 = slutningen i december 2035) */
async function debugHop(page: Page, aar: number): Promise<void> {
  await tryk(page.getByTestId('debug-knap'));
  const d = page.getByTestId('dialog-debug');
  await expect(d).toBeVisible();
  await d.getByTestId('debug-aar').selectOption(String(aar));
  await tryk(d.getByTestId('debug-hop'));
  await expect(d).toBeHidden({ timeout: 60_000 });
}

/** Debug-menuen: sæt kassen, så et hult firma efter et passivt hop har råd til at prøve tingene */
async function debugKapital(page: Page, mio: number): Promise<void> {
  await lukDialoger(page);
  await tryk(page.getByTestId('debug-knap'));
  const d = page.getByTestId('dialog-debug');
  await expect(d).toBeVisible();
  await d.getByTestId('debug-kapital').fill(String(mio));
  await tryk(d.getByTestId('debug-saet'));
  await expect(d.getByRole('status')).toHaveText('Værdier sat.');
  expect((await tilstand(page)).kapital).toBe(mio);
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
}

/** Ugen i autosave-pladsen i IndexedDB (autosave skrives asynkront, så testen poller den) */
async function autosaveUge(page: Page): Promise<number | null> {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some((d) => d.name === 'udfordreren')) return null;
    return new Promise<number | null>((svar) => {
      const req = indexedDB.open('udfordreren');
      req.onerror = () => svar(null);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const get = db.transaction('saves', 'readonly').objectStore('saves').get('auto');
          get.onsuccess = () => {
            svar((get.result as { uge?: number } | undefined)?.uge ?? null);
            db.close();
          };
          get.onerror = () => {
            svar(null);
            db.close();
          };
        } catch {
          svar(null);
          db.close();
        }
      };
    });
  });
}

/** Ingen vandret scroll på siden (layoutkravet på alle tre bredder) */
async function ingenVandretScroll(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'vandret scroll').toBeLessThanOrEqual(0);
}

async function lancerFoersteProdukt(page: Page): Promise<void> {
  await spilIndtil(
    page,
    'lancering',
    async () => {
      const knap = page.locator('[data-testid^=lancer-]').first();
      if (!(await synlig(knap)) || !(await knap.isEnabled().catch(() => false))) return false;
      // En dialog kan dukke op lige før klikket: så lukkes den, og der prøves igen
      return tryk(knap, 2_000).then(
        () => true,
        () => false,
      );
    },
    85_000,
  );
}

async function lukAnmeldelse(page: Page): Promise<void> {
  const d = page.getByTestId('dialog-anmeldelse');
  await expect(d).toBeVisible();
  // Spring optællingen over: alle fire anmeldere og totalen /40 står der bagefter
  const spring = d.getByTestId('anmeldelse-spring');
  if (await synlig(spring)) await tryk(spring);
  await expect(d.getByTestId(/^anmelder-score-/)).toHaveCount(4);
  await expect(d.getByTestId('anmeldelse-total')).toContainText(/\d+/);
  await tryk(d.getByTestId('anmeldelse-ok'));
  await expect(d).toBeHidden();
}

// ---------- 1. Nyt spil → tutorial → første produkt med anmeldelse ----------

test('1. nyt spil → stiftere og vertikal → mentor → første produkt lanceret med anmeldelse inden for 90 sek.', async ({ page }) => {
  const t0 = Date.now();
  await nytSpil(page, { tutorial: true });

  // Trin 1: Knud peger på kontraktopgaverne, mens licensen behandles
  const mentor = page.getByTestId('mentor');
  await expect(mentor).toContainText('trin 1/3');
  await tryk(mentor.getByTestId('mentor-handling'));
  await expect(page.getByTestId('panel-kontrakter')).toBeVisible();
  await tryk(page.locator('[data-testid^=tag-kontrakt-]').first());
  await expect(page.locator('[data-testid^=kontrakt-igang-]')).toHaveCount(1);

  // Trin 2: Knud foreslår det første produkt
  await expect(mentor).toContainText('trin 2/3');
  await tryk(mentor.getByTestId('mentor-handling'));
  await expect(page.getByTestId('dialog-nytProdukt')).toBeVisible();
  await tryk(page.getByTestId('start-udvikling'));
  await expect(page.getByTestId('dialog-nytProdukt')).toBeHidden();
  await expect(page.locator('[data-testid^=projekt-]')).toHaveCount(1);

  // Trin 3: produktet er færdigtestet — Knud sender os til lanceringen
  await tempo(page, 4);
  await spilIndtil(page, 'mentorens trin 3', async () => ((await mentor.textContent().catch(() => '')) ?? '').includes('trin 3/3'), 75_000);
  await tryk(mentor.getByTestId('mentor-handling'));
  await expect(page.getByTestId('panel-projekter')).toBeVisible();
  await lancerFoersteProdukt(page);

  await expect(page.getByTestId('dialog-anmeldelse')).toBeVisible();
  expect(Date.now() - t0, 'fra nyt spil til første anmeldelse').toBeLessThan(90_000);
  await lukAnmeldelse(page);

  // Mentoren trækker sig tilbage efter den første anmeldelse
  await lukDialoger(page);
  await expect.poll(async () => (await tilstand(page)).mentor).toBe('faerdig');
  await expect(mentor).toBeHidden();
});

// ---------- 2. Kontraktopgave → ansæt → Top 10 ----------

test('2. kontraktopgave → ansæt → produktet ses i Top 10', async ({ page }) => {
  await nytSpil(page);
  // Sæt tiden på pause, mens firmaet sættes op
  await saetPause(page, true);

  // Kontraktopgave: én stifter tager den, den anden bliver hjemme og bygger
  await fane(page, 'kontrakter');
  await tryk(page.locator('[data-testid^=tag-kontrakt-]').first());
  await expect(page.locator('[data-testid^=kontrakt-igang-]')).toHaveCount(1);

  // Garagen har kun to pladser: flyt i kælderen, slå en annonce op og ansæt
  await fane(page, 'firma');
  await tryk(page.getByTestId('opgrader-kontor'));
  await lukDialoger(page);
  await expect(page.getByTestId('firma-kontor')).toContainText('Kælder');
  await fane(page, 'personale');
  await expect(page.getByTestId('pladser')).toContainText('2/5');
  await tryk(page.getByTestId('jobannonce-1'));
  const kandidat = page.getByTestId(/^ansaet-/).first();
  await expect(kandidat).toBeEnabled();
  await tryk(kandidat);
  await expect(page.getByTestId('pladser')).toContainText('3/5');
  expect((await tilstand(page)).staff).toBe(3);

  // Første produkt
  await fane(page, 'projekter');
  await tryk(page.getByTestId('nyt-produkt'));
  const navn = (await page.getByTestId('produkt-navn').inputValue()).trim();
  expect(navn.length).toBeGreaterThan(0);
  await tryk(page.getByTestId('start-udvikling'));
  await expect(page.getByTestId('dialog-nytProdukt')).toBeHidden();
  await tempo(page, 4);
  await saetPause(page, false);
  await lancerFoersteProdukt(page);
  await lukAnmeldelse(page);

  // Hitlisten: vent på jeres produkt (milepæls-dialogen "Ind på Top 10!" sender os til listen)
  const egen = page.getByTestId('top10').locator('[data-spiller="1"]').first();
  await spilIndtil(
    page,
    'produktet i Top 10',
    async () => {
      const milepael = page.getByTestId('milepael-hitliste');
      if (await synlig(milepael)) {
        await milepael.click({ timeout: 3_000 }).catch(() => {});
        return false;
      }
      if (!(await synlig(page.getByTestId('panel-hitliste')))) await page.getByTestId('fane-hitliste').click({ timeout: 2_000 }).catch(() => {});
      return synlig(egen);
    },
    60_000,
    ['dialog-milepael'],
  );
  await expect(egen).toContainText(navn);
  await expect(egen).toHaveAttribute('data-testid', /^top10-raekke-(10|[1-9])$/);
});

// ---------- 3. 2016: messe og anden vertikal ----------

test('3. debug-hop til 2016 → messe → anden vertikal', async ({ page }) => {
  await nytSpil(page);
  await debugHop(page, 2016);
  await expect(page.getByTestId('dato')).toContainText('2016');

  // London-messen varsles i årets første uge: book en lille stand (ellers via kalenderen under Firma)
  await lukDialoger(page, ['dialog-messe']);
  const messe = page.getByTestId('dialog-messe');
  if (!(await synlig(messe))) {
    await fane(page, 'firma');
    await tryk(page.getByTestId('kalender-book-london'));
  }
  await expect(messe).toContainText('London-messen');
  await expect(messe.getByTestId('messe-stande')).toBeVisible();
  await tryk(messe.getByTestId('book-stand-1'));
  await expect(messe).toBeHidden();
  await lukDialoger(page);
  await debugKapital(page, 10);
  await fane(page, 'firma');
  await expect(page.getByTestId('kalender')).toContainText('Lille stand booket');

  // Anden vertikal: søg kasinolicens i Danmark
  await fane(page, 'marked');
  await tryk(page.getByTestId('marked-chip-dk'));
  await tryk(page.getByTestId('soeg-licens-dk-kasino'));
  await expect(page.getByTestId('licens-dk-kasino')).toContainText('tilbage');

  // Messen løber af stablen: udbyttet vises
  await tempo(page, 4);
  const resultat = page.getByTestId('messe-resultat');
  await spilIndtil(page, 'messens udbytte', () => synlig(resultat), 30_000, ['dialog-messe']);
  await expect(resultat).toContainText(/lille stand/i);
  await tryk(page.getByTestId('messe-ok'));

  // Licensen bliver godkendt: firmaet har nu begge vertikaler
  await fane(page, 'marked');
  const kasino = page.getByTestId('licens-dk-kasino');
  await spilIndtil(page, 'aktiv kasinolicens', async () => ((await kasino.textContent().catch(() => '')) ?? '').includes('Aktiv'), 45_000);
  await expect(page.getByTestId('licens-dk-betting')).toContainText('Aktiv');
});

// ---------- 4. 2019: Sverige ----------

test('4. debug-hop til 2019 → gå ind i Sverige', async ({ page }) => {
  await nytSpil(page);
  await debugHop(page, 2019);
  await expect(page.getByTestId('dato')).toContainText('2019');
  await lukDialoger(page);
  await debugKapital(page, 10);

  // Markedskortet: vælg Sverige og søg licens hos Spelinspektionen
  await fane(page, 'marked');
  await expect(page.getByTestId('markedskort')).toBeVisible();
  await tryk(page.getByTestId('marked-chip-se'));
  await expect(page.getByTestId('konsol-se')).toContainText('Sverige');
  await tryk(page.getByTestId('soeg-licens-se-betting'));
  const licens = page.getByTestId('licens-se-betting');
  await expect(licens).toContainText('tilbage');

  // Licensen bliver godkendt, og Sverige har sin egen hitliste
  await tempo(page, 4);
  await spilIndtil(page, 'aktiv svensk licens', async () => ((await licens.textContent().catch(() => '')) ?? '').includes('Aktiv'), 60_000);
  await saetPause(page, true);
  await fane(page, 'hitliste');
  await tryk(page.getByTestId('hitliste-marked-se'));
  await expect(page.getByTestId('top10')).toHaveAttribute('data-marked', 'se');
});

// ---------- 5. 2026: verdensbilledet og en AI-agent ----------

test('5. debug-hop til 2026 → Verdensbilledet 2026 → AI-agent i drift', async ({ page }) => {
  await nytSpil(page);
  await debugHop(page, 2026);
  await expect(page.getByTestId('dato')).toContainText('2026');

  // Akt-skiftet: alle verdensscenarier med de trukne markeret
  await lukDialoger(page, ['dialog-aktSkift']);
  const verden = page.getByTestId('dialog-aktSkift');
  await expect(verden).toBeVisible();
  await expect(verden).toContainText('Verdensbilledet 2026');
  const scenarier = verden.getByTestId(/^aktSkift-scenarie-/);
  expect(await scenarier.count()).toBeGreaterThanOrEqual(3);
  await expect(verden.locator('[data-testid^=aktSkift-scenarie-][data-trukket="1"]')).toHaveCount((await tilstand(page)).verdensscenarier);
  await expect(verden.getByTestId('aktSkift-vurderinger')).toBeVisible();

  // Til AI-laboratoriet: sæt en agent i drift
  await tryk(verden.getByTestId('aktSkift-til-ailab'));
  await lukDialoger(page);
  await expect(page.getByTestId('panel-ailab')).toBeVisible();
  const deploy = page.getByTestId('deploy-agent');
  await expect(deploy).toBeEnabled();
  await tryk(deploy);
  await expect(page.getByTestId(/^ailab-agent-ag\d+$/)).toHaveCount(1);
  expect((await tilstand(page)).agenter).toBe(1);
});

// ---------- 6. 2035: slutskærm og eftertanke ----------

test('6. debug-hop til 2035 → slutskærm og eftertanke', async ({ page }) => {
  await nytSpil(page);
  await debugHop(page, 2035);
  await lukDialoger(page);
  if (!(await tilstand(page)).slut) {
    await expect(page.getByTestId('dato')).toContainText('2035');
    // Og videre til december 2035, hvor spillet slutter
    await debugHop(page, 2036);
  }
  const slut = page.getByTestId('dialog-slut');
  await expect(slut).toBeVisible();
  for (const id of ['slut-tekst', 'slut-score', 'slut-eftermaele', 'slut-tidslinje', 'slut-trofaeer', 'slut-by', 'slut-eftertanke']) {
    await expect(slut.getByTestId(id)).toBeVisible();
  }
  // Eftertanke: tre kort, der hver åbner et opslag i Arkivet
  const kort = slut.getByTestId(/^slut-eftertanke-\d+$/);
  await expect(kort).toHaveCount(3);
  await tryk(kort.first());
  const arkiv = page.getByTestId('dialog-arkiv');
  await expect(arkiv).toBeVisible();
  await tryk(arkiv.getByTestId('arkiv-luk'));
  await expect(arkiv).toBeHidden();
  await expect(slut).toBeVisible();
});

// ---------- 7. Reload midt i spillet (røgtest på laptop, iPad og mobil) ----------

test('7. reload midt i spillet: samme firma, uge og kapital @roeg', async ({ page }) => {
  await nytSpil(page, { firma: 'Reload & Søn ApS' });
  await ingenVandretScroll(page);
  await fane(page, 'kontrakter');
  await tryk(page.locator('[data-testid^=tag-kontrakt-]').first());
  await tempo(page, 4);

  // Kvartalsmødet stopper tiden, og autosave skriver straks den uge, dialogen kom i
  await spilIndtil(page, 'kvartalsmødet', () => synlig(page.getByTestId('dialog-kvartal')), 60_000, ['dialog-kvartal']);
  const foer = await tilstand(page);
  expect(foer.uge).toBeGreaterThan(0);
  await expect.poll(() => autosaveUge(page)).toBe(foer.uge);
  const hudFoer = {
    dato: await page.getByTestId('dato').textContent(),
    kapital: await page.getByTestId('hud-kapital-vaerdi').textContent(),
  };

  await page.reload();
  const fortsaet = page.getByTestId('fortsaet-auto');
  await expect(fortsaet).toContainText('Reload & Søn ApS');
  await tryk(fortsaet);
  await expect(page.getByTestId('spilskaerm')).toBeVisible();

  const efter = await tilstand(page);
  expect({ firma: efter.firma, uge: efter.uge, kapital: efter.kapital }).toEqual({ firma: foer.firma, uge: foer.uge, kapital: foer.kapital });
  await expect(page.getByTestId('hud-firma')).toHaveText('Reload & Søn ApS');
  await expect(page.getByTestId('dato')).toHaveText(hudFoer.dato ?? '');
  await expect(page.getByTestId('hud-kapital-vaerdi')).toHaveText(hudFoer.kapital ?? '');
  await ingenVandretScroll(page);
  await test.info().attach(`efter reload (${test.info().project.name})`, { body: await page.screenshot(), contentType: 'image/png' });

  // Og spillet kører videre derfra
  await tryk(page.getByTestId('fortsaet'));
  await expect.poll(async () => (await tilstand(page)).uge, { timeout: 15_000 }).toBeGreaterThan(foer.uge);
});
