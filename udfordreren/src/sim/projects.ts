// Kerneloopet (spec 6.2): Koncept → Design → Teknik → Test med point-bobler, fejl og boost.
import type { GameState, LiveProduct, MarketId, Params, Phase, Project, ProductTypeId, Staff, ThemeId, Vertical } from './types';
import { PHASES } from './types';
import type { Rng } from './rng';
import { PRODUCT_TYPES } from '../data/productTypes';
import { THEMES } from '../data/themes';
import { ROLES } from '../data/roles';
import { BALANCE } from '../data/balance';
import { BOOST, OFFICE_BY_ID } from '../data/costs';
import { komboNoegle } from '../data/compatibility';
import { TRUST } from '../data/trust';
import { EVENTS } from '../data/events';
import { aarFor } from './time';
import { afvis, betal, clamp, nyhed, nyId, saetFlag, signal } from './util';
import { niveauFaktor, registrerBrug, hallOfFameBonus } from './levels';
import { beregnAnmeldelser, markedsStandard } from './reviews';
import { forskningsEffekt, forskningsFeatures } from './insight';
import { passiveEffekter } from './staff';
import { lanceringsKunder } from './customers';
import { udloesEvent } from './events';

export const tomParams = (): Params => ({ spaending: 0, originalitet: 0, teknik: 0, tryghed: 0 });

export function minBudgetUge(typeId: ProductTypeId, uge: number): number {
  const aar = aarFor(uge) - 2012;
  return Math.round(PRODUCT_TYPES[typeId].minBudget * (1 + BALANCE.budgetInflation * aar) * 100) / 100;
}

export function minBudget(s: GameState, typeId: ProductTypeId): number {
  return minBudgetUge(typeId, s.uge);
}

export function budgetFaktor(budget: number, min: number): number {
  if (budget <= min) return 1;
  return Math.min(BALANCE.budgetMax, 1 + BALANCE.budgetLog * Math.log2(budget / min));
}

/** Vertikal-status i et marked: 'aktiv' | 'ansoegt' | 'ingen' */
export function vertikalStatus(s: GameState, v: Vertical, m: MarketId = 'dk') {
  return s.markeder[m].vertikaler[v].status;
}

export function typeStatus(s: GameState, typeId: ProductTypeId): { ok: boolean; grund?: string } {
  const t = PRODUCT_TYPES[typeId];
  const aar = aarFor(s.uge);
  if (aar < t.fraAar) return { ok: false, grund: `Findes først fra ${t.fraAar}` };
  const harVertikal = (Object.keys(s.markeder) as MarketId[]).some((m) => s.markeder[m].vertikaler[t.vertikal].status !== 'ingen');
  if (!harVertikal) return { ok: false, grund: `Kræver licens til ${t.vertikal === 'betting' ? 'betting' : 'kasino'}` };
  for (const k of t.krav.rolle ?? []) {
    const ok = s.staff.some((m) => m.rolle === k.rolle && m.niveau >= k.niveau);
    if (!ok) return { ok: false, grund: `Kræver ${ROLES[k.rolle].navn.toLowerCase()} på niveau ${k.niveau}` };
  }
  if (t.krav.platform === 'kasinoHybridEllerEgen') {
    const pm = s.platforme.kasinoplatform.model;
    if (pm !== 'hybrid' && pm !== 'egen') return { ok: false, grund: 'Kræver hybrid eller egen kasinoplatform' };
  }
  if (t.krav.dataejerskab !== undefined && s.platforme.kontoplatform.dataejerskab < t.krav.dataejerskab) {
    return { ok: false, grund: `Kræver dataejerskab ≥ ${t.krav.dataejerskab}` };
  }
  if (t.krav.lovligMarked) return { ok: false, grund: 'Ikke lovligt i jeres markeder endnu' };
  return { ok: true };
}

export function temaStatus(s: GameState, themeId: ThemeId): { ok: boolean; grund?: string } {
  const t = THEMES[themeId];
  if (aarFor(s.uge) < t.fraAar) return { ok: false, grund: `Findes først fra ${t.fraAar}` };
  return { ok: true };
}

export function maxProjekter(s: GameState): number {
  return OFFICE_BY_ID[s.kontor].projekter;
}

/** Staff, der ikke er bundet af kontrakter eller et andet projekts nuværende fase */
export function ledigeTilProjekt(s: GameState, undtagProjekt?: string): Staff[] {
  const optaget = new Set<string>();
  for (const c of s.kontraktopgaver) for (const id of c.staff) optaget.add(id);
  for (const p of s.projekter) if (p.id !== undtagProjekt && !p.klar) for (const id of p.faseTildeling[p.fase]) optaget.add(id);
  return s.staff.filter((m) => !optaget.has(m.id));
}

export function startProject(
  s: GameState,
  input: Pick<Project, 'navn' | 'typeId' | 'themeId' | 'markeder' | 'margin' | 'intensitet' | 'budget' | 'efterfoelgerAf'>,
): boolean {
  const type = PRODUCT_TYPES[input.typeId];
  if (!type) return afvis(s, 'Ukendt produkttype.');
  if (!THEMES[input.themeId]) return afvis(s, 'Ukendt tema.');
  if (s.projekter.length >= maxProjekter(s)) return afvis(s, `Kontoret kan kun rumme ${maxProjekter(s)} projekt(er) ad gangen.`);
  const ts = typeStatus(s, input.typeId);
  if (!ts.ok) return afvis(s, ts.grund ?? 'Produkttypen er ikke tilgængelig.');
  const th = temaStatus(s, input.themeId);
  if (!th.ok) return afvis(s, th.grund ?? 'Temaet er ikke tilgængeligt.');
  const markeder = [...new Set(input.markeder)].filter((m) => s.markeder[m] && s.markeder[m].vertikaler[type.vertikal].status !== 'ingen');
  if (markeder.length === 0) return afvis(s, 'Vælg mindst ét marked, hvor I har (eller søger) licens.');
  if (input.margin < type.marginMin - 1e-9 || input.margin > type.marginMax + 1e-9) return afvis(s, 'Marginen ligger uden for markedets interval.');
  if (![1, 2, 3, 4, 5].includes(input.intensitet)) return afvis(s, 'Intensitet skal være 1-5.');
  const min = minBudget(s, input.typeId);
  if (input.budget < min - 1e-9) return afvis(s, `Budgettet skal være mindst ${min.toFixed(2).replace('.', ',')} mio. kr.`);
  let original: LiveProduct | undefined;
  if (input.efterfoelgerAf) {
    original = s.produkter.find((p) => p.id === input.efterfoelgerAf && p.ejer === 'spiller');
    if (!original) return afvis(s, 'Originalen findes ikke.');
    if (original.typeId !== input.typeId || original.themeId !== input.themeId) return afvis(s, 'En 2.0-version har samme type og tema som originalen.');
  }
  if (!betal(s, input.budget, 'projektbudgettet')) return false;

  const key = komboNoegle(input.typeId, input.themeId);
  const params = tomParams();
  if (original?.params) {
    // 2.0-version: +20 % start-params fra originalen [D]
    for (const k of Object.keys(params) as (keyof Params)[]) params[k] = original.params[k] * 0.2;
  }
  const ledige = ledigeTilProjekt(s).map((m) => m.id);
  const p: Project = {
    id: nyId(s, 'p'),
    navn: input.navn.trim() || 'Uden navn',
    typeId: input.typeId,
    themeId: input.themeId,
    markeder,
    margin: input.margin,
    intensitet: input.intensitet,
    budget: input.budget,
    fase: 'koncept',
    faseTildeling: { koncept: [...ledige], design: [...ledige], teknik: [...ledige], test: [...ledige] },
    params,
    fejl: 0,
    boostBrugt: 0,
    startUge: s.uge,
    faseUge: 0,
    faseLaengde: { koncept: BALANCE.koncetUger, design: type.designUger, teknik: type.teknikUger, test: BALANCE.testUger },
    klar: false,
    features: [...new Set([...(type.feature ? [type.feature] : []), ...forskningsFeatures(s, type.vertikal)])],
    foersteForsoeg: !s.kombinationsbog[key]?.set,
  };
  if (input.efterfoelgerAf) p.efterfoelgerAf = input.efterfoelgerAf;
  s.projekter.push(p);
  if (s.milepaele.foersteProjekt === undefined) s.milepaele.foersteProjekt = s.uge;
  return true;
}

export function assignPhase(s: GameState, projectId: string, fase: Phase, ids: string[]): boolean {
  const p = s.projekter.find((x) => x.id === projectId);
  if (!p) return afvis(s, 'Projektet findes ikke.');
  if (!PHASES.includes(fase)) return afvis(s, 'Ukendt fase.');
  const gyldige = [...new Set(ids)].filter((id) => s.staff.some((m) => m.id === id));
  if (fase === p.fase && !p.klar) {
    // I den aktive fase må man ikke tage folk fra kontrakter eller et andet projekts aktive fase
    const ledige = new Set(ledigeTilProjekt(s, p.id).map((m) => m.id));
    const optaget = gyldige.filter((id) => !ledige.has(id));
    if (optaget.length) return afvis(s, 'Nogle af de valgte er optaget på en kontrakt eller et andet projekt.');
  }
  p.faseTildeling[fase] = gyldige;
  return true;
}

export function boostPris(p: Project): number | null {
  if (p.boostBrugt >= BOOST.max) return null;
  return BOOST.indsigt[p.boostBrugt];
}

export function boostEffekt(s: GameState, p: Project): number {
  const e = forskningsEffekt(s, PRODUCT_TYPES[p.typeId].vertikal);
  return markedsStandard(s, p.typeId, p.markeder) * BOOST.andelAfStandard * (1 + e.boost);
}

export function boost(s: GameState, projectId: string, param: keyof Params): boolean {
  const p = s.projekter.find((x) => x.id === projectId);
  if (!p) return afvis(s, 'Projektet findes ikke.');
  const pris = boostPris(p);
  if (pris === null) return afvis(s, `Højst ${BOOST.max} boosts pr. projekt.`);
  if (s.indsigt < pris) return afvis(s, `Boost kræver ${pris} indsigt.`);
  s.indsigt -= pris;
  p.boostBrugt += 1;
  p.params[param] += boostEffekt(s, p);
  return true;
}

export function extendTest(s: GameState, projectId: string, uger: number): boolean {
  const p = s.projekter.find((x) => x.id === projectId);
  if (!p) return afvis(s, 'Projektet findes ikke.');
  if (p.fase !== 'test') return afvis(s, 'Test kan kun forlænges i testfasen.');
  const n = clamp(Math.round(uger), 1, 4);
  if (p.faseLaengde.test + n > BALANCE.maxTestUger) return afvis(s, `Testfasen kan højst vare ${BALANCE.maxTestUger} uger.`);
  p.faseLaengde.test += n;
  p.klar = false;
  if (p.faseTildeling.test.length === 0) p.faseTildeling.test = ledigeTilProjekt(s, p.id).map((m) => m.id);
  return true;
}

export function cancelProject(s: GameState, projectId: string): boolean {
  const p = s.projekter.find((x) => x.id === projectId);
  if (!p) return afvis(s, 'Projektet findes ikke.');
  s.projekter = s.projekter.filter((x) => x.id !== projectId);
  nyhed(s, `Projektet "${p.navn}" blev skrinlagt.`, 'firma');
  return true;
}

/** Point for én person-uge i en fase (før holdvægt) */
export function personPoint(m: Staff, p: Project, fase: Phase): number {
  const def = ROLES[m.rolle];
  const st = m.stats;
  const statScore =
    fase === 'koncept'
      ? st.kreativitet
      : fase === 'design'
        ? 0.6 * st.kreativitet + 0.4 * st.matematik
        : fase === 'teknik'
          ? st.teknik
          : 0.6 * st.teknik + 0.4 * st.ansvar;
  const vertikal = PRODUCT_TYPES[p.typeId].vertikal;
  const vertF = fase === 'koncept' || fase === 'design' ? def.vertikal[vertikal] : 1;
  const energiF = 0.55 + 0.45 * (m.energi / 100);
  return statScore * def.fase[fase] * vertF * energiF;
}

export type UgeResultat = { arbejdede: string[] };

/** Én uges arbejde på et projekt. Returnerer hvem der arbejdede. */
export function ugentligtProjekt(s: GameState, rng: Rng, p: Project, allerede: Set<string>): UgeResultat {
  if (p.klar) return { arbejdede: [] };
  const optagetKontrakt = new Set<string>();
  for (const c of s.kontraktopgaver) for (const id of c.staff) optagetKontrakt.add(id);
  const hold = p.faseTildeling[p.fase]
    .map((id) => s.staff.find((m) => m.id === id))
    .filter((m): m is Staff => !!m && !optagetKontrakt.has(m.id) && !allerede.has(m.id));
  if (hold.length === 0) return { arbejdede: [] }; // fasen står stille uden tildeling

  const type = PRODUCT_TYPES[p.typeId];
  const eff = forskningsEffekt(s, type.vertikal);
  const passiv = passiveEffekter(s);
  const lvl = niveauFaktor(s, p.typeId, p.themeId, BALANCE.niveauBonus);
  const bud = budgetFaktor(p.budget, minBudgetUge(p.typeId, p.startUge));
  const fordeling = BALANCE.fordeling[p.fase];

  const bidrag = hold
    .map((m) => ({ m, raa: personPoint(m, p, p.fase) * (1 + (rng.next() * 2 - 1) * BALANCE.pointVariation) }))
    .sort((a, b) => b.raa - a.raa);
  let fejlFjernetIalt = 0;
  bidrag.forEach(({ m, raa }, i) => {
    const vaegt = Math.pow(BALANCE.holdVaegt, i);
    const point = raa * vaegt * lvl * bud * BALANCE.pointSkala;
    const delta = tomParams();
    for (const k of Object.keys(delta) as (keyof Params)[]) {
      delta[k] = point * fordeling[k] * (1 + eff.paramBonus[k]);
      p.params[k] += delta[k];
    }
    let fejl = 0;
    let fjernet = 0;
    if (p.fase === 'teknik') {
      fejl =
        BALANCE.fejlBasis *
        (1.25 - m.stats.teknik / 100) *
        (1.5 - 0.5 * (m.energi / 100)) *
        (0.8 + 0.1 * (p.intensitet - 1)) *
        (0.6 + type.risiko / 20) *
        Math.max(0.3, 1 + eff.fejl + passiv.fejl);
      fejl = Math.max(0, fejl * (0.7 + rng.next() * 0.6));
      p.fejl += fejl;
    } else if (p.fase === 'test') {
      fjernet =
        (BALANCE.testFjernBasis + m.stats.teknik * BALANCE.testFjernTeknik + m.stats.ansvar * BALANCE.testFjernAnsvar) *
        vaegt *
        (0.55 + 0.45 * (m.energi / 100));
      fjernet = Math.min(fjernet, p.fejl);
      p.fejl -= fjernet;
      fejlFjernetIalt += fjernet;
    }
    signal(s, { k: 'point', projectId: p.id, staffId: m.id, params: delta, fejl, fjernet });
  });
  void fejlFjernetIalt;
  p.fejl = Math.max(0, p.fejl);

  p.faseUge += 1;
  if (p.faseUge >= p.faseLaengde[p.fase]) {
    const i = PHASES.indexOf(p.fase);
    if (i < PHASES.length - 1) {
      const naeste = PHASES[i + 1];
      if (p.faseTildeling[naeste].length === 0) p.faseTildeling[naeste] = [...p.faseTildeling[p.fase]];
      p.fase = naeste;
      p.faseUge = 0;
      signal(s, { k: 'fase', projectId: p.id, til: naeste });
    } else {
      p.klar = true;
      signal(s, { k: 'klar', projectId: p.id });
    }
  }
  return { arbejdede: hold.map((m) => m.id) };
}

/** Kan projektet lanceres nu? */
export function lanceringsStatus(s: GameState, p: Project): { ok: boolean; grund?: string; markeder: MarketId[] } {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  const markeder = p.markeder.filter((m) => s.markeder[m].vertikaler[v].status === 'aktiv' && s.markeder[m].licens === 'aktiv');
  if (!p.klar) return { ok: false, grund: 'Projektet er ikke færdigtestet.', markeder };
  if (markeder.length === 0) return { ok: false, grund: 'Licensen er ikke klar endnu.', markeder };
  return { ok: true, markeder };
}

export function launch(s: GameState, rng: Rng, projectId: string): boolean {
  const p = s.projekter.find((x) => x.id === projectId);
  if (!p) return afvis(s, 'Projektet findes ikke.');
  const st = lanceringsStatus(s, p);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke lancere.');

  const original = p.efterfoelgerAf ? s.produkter.find((x) => x.id === p.efterfoelgerAf) : undefined;
  const tidlig = !!original && s.uge - original.lanceretUge < 52;
  const res = beregnAnmeldelser(s, rng, {
    typeId: p.typeId,
    themeId: p.themeId,
    params: p.params,
    fejl: p.fejl,
    margin: p.margin,
    intensitet: p.intensitet,
    markeder: st.markeder,
    tidligEfterfoelger: tidlig,
  });

  const produkt: LiveProduct = {
    id: nyId(s, 'lp'),
    navn: p.navn,
    ejer: 'spiller',
    typeId: p.typeId,
    themeId: p.themeId,
    markeder: st.markeder,
    margin: p.margin,
    intensitet: p.intensitet,
    kvalitet: res.kvalitet,
    lanceretUge: s.uge,
    anmeldelser: res.anmeldelser,
    total40: res.total40,
    guldkupon: res.guldkupon,
    hallOfFame: res.hallOfFame,
    bsiPrUge: {},
    samletBsi: 0,
    aktiv: true,
    features: p.features,
    params: { ...p.params },
    fejl: Math.round(p.fejl),
    version: original ? original.version + 1 : 1,
    bedstePlacering: {},
    ugerITop10: 0,
  };
  if (original) {
    produkt.efterfoelgerAf = original.id;
    if (original.aktiv) {
      original.aktiv = false;
      original.pensioneretUge = s.uge;
      original.bsiPrUge = {};
    }
  }
  const nyeFeatures = produkt.features.filter((f) => !s.produkter.some((x) => x.ejer === 'spiller' && x.features.includes(f)));
  s.produkter.push(produkt);
  s.projekter = s.projekter.filter((x) => x.id !== p.id);

  // Kombinationsbog og niveauer
  const key = komboNoegle(p.typeId, p.themeId);
  const foer = s.kombinationsbog[key];
  s.kombinationsbog[key] = { set: true, bedste40: Math.max(foer?.bedste40 ?? 0, res.total40) };
  if (!foer?.set) s.aarAkk.nyeKombinationer += 1;
  s.aarAkk.nyeFeatures += nyeFeatures.length;
  registrerBrug(s, p.typeId, p.themeId, res.total40);
  if (res.hallOfFame) hallOfFameBonus(s, p.typeId, p.themeId);

  // Indsigt, hype og omdømme
  const eff = forskningsEffekt(s);
  s.indsigt += Math.round((4 + res.total40 / 5) * (res.guldkupon ? 1.5 : 1) * (1 + eff.indsigt));
  s.omdoemme = clamp(s.omdoemme + (res.total40 - 22) / 6, 0, 100);
  lanceringsKunder(s, produkt);
  s.hype *= 0.6;
  if (res.guldkupon) {
    s.hype = clamp(s.hype + 15, 0, 100);
    s.indsigt += 10;
  }

  // Akkumulatorer og milepæle
  s.kvartalAkk.lanceringer += 1;
  s.kvartalAkk.bedsteTotal40 = Math.max(s.kvartalAkk.bedsteTotal40, res.total40);
  s.aarAkk.lanceringer += 1;
  s.aarAkk.bedsteTotal40 = Math.max(s.aarAkk.bedsteTotal40, res.total40);
  if (s.milepaele.foersteLancering === undefined) s.milepaele.foersteLancering = s.uge;
  if (res.guldkupon && s.milepaele.foersteGuldkupon === undefined) s.milepaele.foersteGuldkupon = s.uge;
  if (res.hallOfFame && s.milepaele.foersteHallOfFame === undefined) s.milepaele.foersteHallOfFame = s.uge;

  signal(s, { k: 'lanceret', productId: produkt.id });
  signal(s, { k: 'anmeldelse', productId: produkt.id });
  if (res.guldkupon) signal(s, { k: 'guldkupon', productId: produkt.id });
  if (res.hallOfFame) signal(s, { k: 'hallOfFame', productId: produkt.id });
  nyhed(
    s,
    `${s.firmaNavn} lancerer ${produkt.navn}${produkt.version > 1 ? ` (${produkt.version}.0)` : ''}: ${res.total40}/40${res.hallOfFame ? ' — Hall of Fame!' : res.guldkupon ? ' — Guldkupon!' : ''}`,
    'firma',
  );

  // Fejl ved lancering: tilsynet mærker det, og der er risiko for et hændelses-event
  if (produkt.fejl >= TRUST.fejlTaerskel) {
    for (const m of st.markeder) s.markeder[m].tilsynstillid = clamp(s.markeder[m].tilsynstillid + TRUST.lanceringMedFejl, 0, 100);
    if (rng.chance(Math.min(0.85, produkt.fejl * 0.07))) {
      const kandidater = EVENTS.filter((e) => e.trigger === 'lanceringMedFejl').filter(
        (e) => e.id !== 'forkerteOdds' || PRODUCT_TYPES[produkt.typeId].vertikal === 'betting',
      );
      const ev = rng.pick(kandidater);
      udloesEvent(s, ev.id, { produkt: produkt.navn, fejl: produkt.fejl });
    }
  }
  if (!s.flags.includes('harLanceret')) saetFlag(s, 'harLanceret');
  return true;
}
