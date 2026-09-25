// Profilstyret bot-strategi (spec 8). Balanceret, Grådig, Forsigtig, AI-afviser og AI-hensynsløs er profiler af
// den samme motor; Tilfældig ligger i random.ts. Botterne bruger kun offentlige handlinger og selectors.
import type { AcqChannel, Action, AgentFunktion, GameState, MarketId, PlatformKind, PlatformModel, ProductTypeId, Role, ThemeId, Vertical } from '../../src/sim/types';
import type { Bot } from './types';
import { licensStatus, licensPris } from '../../src/sim/markets';
import { MARKETS } from '../../src/data/markets';
import { PRODUCT_TYPE_IDS, PRODUCT_TYPES } from '../../src/data/productTypes';
import { THEME_IDS } from '../../src/data/themes';
import { fitFor, komboNoegle } from '../../src/data/compatibility';
import { RESEARCH } from '../../src/data/research';
import { EXPOS } from '../../src/data/expos';
import { ANDEN_VERTIKAL } from '../../src/data/verticals';
import { OFFICE_BY_ID } from '../../src/data/costs';
import { PLATFORM_MODELS } from '../../src/data/platforms';
import { typeStatus, temaStatus, minBudget, ledigeTilProjekt, maxProjekter, boostPris, ledigeAgenter } from '../../src/sim/projects';
import { forskningStatus } from '../../src/sim/insight';
import { kontorKrav, naesteKontor } from '../../src/sim/office';
import { naesteRunde } from '../../src/sim/investors';
import { bookingAabent } from '../../src/sim/expos';
import { pladser } from '../../src/sim/staff';
import { aarFor, AI_AKT_UGE } from '../../src/sim/time';
import { platformStatus, b2bStatus } from '../../src/sim/platforms';
import { agentStatus, dataFaktor, transformationStatus } from '../../src/sim/agents';
import { hyperStatus } from '../../src/sim/world';
import { kanalTilgaengelig } from '../../src/sim/customers';

export type Profil = {
  navn: string;
  intensitet: 1 | 2 | 3 | 4 | 5;
  bonus: 0 | 1 | 2 | 3;
  vip: 0 | 1 | 2 | 3;
  /** Marketing i andel af ugens BSI */
  marketingAndel: number;
  /** Fordeling af marketingbudgettet på kanaler */
  kanaler: Partial<Record<AcqChannel, number>>;
  runder: boolean;
  /** Højst så mange udenlandske markeder */
  markeder: number;
  /** Offshore-brand fra dette år (null = aldrig) */
  offshore: number | null;
  platform: boolean;
  ai: 'ingen' | 'ansvarlig' | 'hensynsloes';
  overvaagning: number;
  hyper: boolean;
  /** Transformation: andel af stillingerne (0 = aldrig) */
  transformation: number;
  /** Forsk først i ansvarligt spil */
  ansvarsforskning: boolean;
  /** Skru ned for bonus, VIP og intensitet, når tilliden falder */
  tillidsstyring: boolean;
  andenVertikal: boolean;
  sponsorater: boolean;
  /** Sælg egen platform B2B (B2B-pivot) */
  b2b: boolean;
  /** Tag imod opkøbstilbud fra dette år (null = aldrig); 'danskeLykke' = kun statsselskabets bud */
  saelg: { fra: number; kun?: string } | null;
  /** Højeste CAC-faktor på et nyt marked */
  maxCacFaktor: number;
  /** Platformmål pr. rolle: den primære produktplatform, kontoplatformen og den anden vertikals platform */
  platformPlan: { primaer: PlatformModel; konto: PlatformModel; sekundaer: PlatformModel };
  /** Afvigelser, der først gælder fra AI-akten (2026) */
  akt2?: Partial<Profil>;
};

export const BALANCERET: Profil = {
  navn: 'Balanceret', intensitet: 3, bonus: 1, vip: 1, marketingAndel: 0.25,
  kanaler: { soeg: 0.28, affiliate: 0.28, sociale: 0.22, crm: 0.14, sponsorat: 0.08 },
  runder: true, markeder: 5, offshore: null, platform: true, ai: 'ansvarlig', overvaagning: 0.8, hyper: false, transformation: 0.25,
  ansvarsforskning: true, tillidsstyring: true, andenVertikal: true, sponsorater: true, b2b: false, saelg: null, maxCacFaktor: 2,
  platformPlan: { primaer: 'egen', konto: 'egen', sekundaer: 'hybrid' },
};

export const GRAADIG: Profil = {
  navn: 'Grådig', intensitet: 5, bonus: 3, vip: 3, marketingAndel: 0.35,
  kanaler: { tv: 0.22, streamere: 0.18, affiliate: 0.28, soeg: 0.14, crm: 0.08, sponsorat: 0.1 },
  runder: true, markeder: 8, offshore: 2021, platform: true, ai: 'hensynsloes', overvaagning: 0.2, hyper: true, transformation: 0.5,
  ansvarsforskning: false, tillidsstyring: false, andenVertikal: true, sponsorater: true, b2b: false, saelg: { fra: 2021 }, maxCacFaktor: 4,
  platformPlan: { primaer: 'hybrid', konto: 'hybrid', sekundaer: 'hybrid' },
};

export const FORSIGTIG: Profil = {
  navn: 'Forsigtig', intensitet: 2, bonus: 0, vip: 0, marketingAndel: 0.22,
  kanaler: { soeg: 0.45, affiliate: 0.3, crm: 0.25 },
  runder: false, markeder: 1, offshore: null, platform: true, ai: 'ansvarlig', overvaagning: 0.9, hyper: false, transformation: 0,
  ansvarsforskning: true, tillidsstyring: true, andenVertikal: true, sponsorater: false, b2b: false, saelg: { fra: 2016, kun: 'danskeLykke' }, maxCacFaktor: 1.5,
  platformPlan: { primaer: 'turnkey', konto: 'whiteLabel', sekundaer: 'whiteLabel' },
};

/** AI-afviseren satser på B2B-pivoten i stedet (spec 6.16: vinderstrategien mod AI-native-bølgen uden AI) */
export const AI_AFVISER: Profil = {
  ...BALANCERET, navn: 'AI-afviser', ai: 'ingen', transformation: 0, b2b: true, saelg: { fra: 2030 },
  platformPlan: { primaer: 'egen', konto: 'egen', sekundaer: 'turnkey' },
};

/** Som Balanceret, men med hyperpersonalisering og lav overvågning fra 2026 (spec 8) */
export const AI_HENSYNSLOES: Profil = {
  ...BALANCERET, navn: 'AI-hensynsløs',
  akt2: { ai: 'hensynsloes', overvaagning: 0.2, hyper: true, transformation: 0.5, ansvarsforskning: false, markeder: 8, maxCacFaktor: 3 },
};

const ONSKEDE_ROLLER: Record<Vertical, Role[]> = {
  betting: ['oddssaetter', 'udvikler', 'analytiker', 'compliance', 'udvikler', 'marketing', 'kasinodesigner'],
  kasino: ['kasinodesigner', 'udvikler', 'compliance', 'analytiker', 'udvikler', 'marketing', 'oddssaetter'],
};

const AGENT_ORDEN: AgentFunktion[] = ['kundeservice', 'udvikling', 'risiko', 'crm', 'compliance', 'trading', 'indhold', 'udvikling', 'crm', 'kundeservice', 'udvikling', 'indhold'];

const ANSVAR_FORSKNING = ['ansvarligtSpil1', 'ansvarligtSpil2', 'tidligIntervention', 'affordabilityTjek', 'aiRisikodetektion'];

function vaelgKombi(s: GameState): { typeId: ProductTypeId; themeId: ThemeId } | null {
  let best: { typeId: ProductTypeId; themeId: ThemeId; score: number } | null = null;
  for (const t of PRODUCT_TYPE_IDS) {
    if (!typeStatus(s, t).ok) continue;
    const v = PRODUCT_TYPES[t].vertikal;
    if (!(Object.keys(s.markeder) as MarketId[]).some((m) => s.markeder[m].vertikaler[v].status !== 'ingen')) continue;
    for (const th of THEME_IDS) {
      if (!temaStatus(s, th).ok) continue;
      const fit = fitFor(t, th);
      if (fit < 3) continue;
      const ny = !s.kombinationsbog[komboNoegle(t, th)]?.set;
      const aktiveSamme = s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.typeId === t).length;
      const score = fit * 2 + (ny ? 2.5 : 0) + s.niveauer.type[t] * 0.3 - aktiveSamme * 1.5 + (s.projekter.some((p) => p.typeId === t) ? -5 : 0);
      if (!best || score > best.score) best = { typeId: t, themeId: th, score };
    }
  }
  return best ? { typeId: best.typeId, themeId: best.themeId } : null;
}

function laveste(s: GameState): number {
  const aktive = (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].licens === 'aktiv');
  return aktive.length ? Math.min(...aktive.map((m) => s.markeder[m].tilsynstillid)) : 70;
}

function aiBeslutninger(p: Profil, s: GameState, buffer: number): Action[] {
  const a: Action[] = [];
  const aar = aarFor(s.uge);
  const har: Partial<Record<AgentFunktion, number>> = {};
  for (const ag of s.agenter) har[ag.funktion] = (har[ag.funktion] ?? 0) + 1;
  const oensket: Partial<Record<AgentFunktion, number>> = {};
  for (const f of AGENT_ORDEN) {
    oensket[f] = (oensket[f] ?? 0) + 1;
    if ((har[f] ?? 0) >= (oensket[f] ?? 0)) continue;
    if ((f === 'risiko' || f === 'compliance') && p.ai === 'hensynsloes') continue;
    if (f === 'trading' && !(Object.values(s.markeder).some((m) => m.vertikaler.betting.status === 'aktiv'))) continue;
    if (f === 'indhold' && !(Object.values(s.markeder).some((m) => m.vertikaler.kasino.status === 'aktiv'))) continue;
    // En agent uden egne data (dataejerskab under 0,3) gør ingen forskel, men koster compute
    if (dataFaktor(s, f) === 0) continue;
    const st = agentStatus(s, f);
    if (st.ok && s.kapital > buffer + st.compute * 52) {
      a.push({ t: 'deployAgent', funktion: f, overvaagning: p.overvaagning });
      break;
    }
  }
  if (s.forskning.ulaast.includes('agentApi') && kanalTilgaengelig(s, 'aiAgentApi') && s.uge % 4 === 0) {
    a.push({ t: 'setMarketing', channel: 'aiAgentApi', prUge: Math.round(Math.max(0.01, s.regnskab.bsi * 0.03) * 1000) / 1000 });
  }
  if (p.hyper && !s.hyperpersonalisering.aktiv && hyperStatus(s).ok) a.push({ t: 'setHyperpersonalisering', aktiv: true });
  if (p.transformation > 0 && aar >= 2029 && s.transformation.length === 0 && s.staff.length >= 20 && !s.flags.includes('transformationStop') && transformationStatus(s, p.transformation).ok) {
    a.push({ t: 'aiTransformation', andel: p.transformation });
  }
  return a;
}

export function lavBot(profil: Profil): Bot {
  const akt2: Profil = { ...profil, ...(profil.akt2 ?? {}) };
  return {
    navn: profil.navn,
    beslut(s) {
      const p = s.uge >= AI_AKT_UGE ? akt2 : profil;
      const a: Action[] = [];
      const aar = aarFor(s.uge);
      for (const e of s.ventendeEvents) a.push({ t: 'eventChoice', eventId: e.eventId, valg: 0 });
      const tillid = laveste(s);
      const presset = p.tillidsstyring && tillid < 60;
      const intensitet = (presset ? Math.max(1, p.intensitet - 1) : p.intensitet) as 1 | 2 | 3 | 4 | 5;

      // Lancér og test
      for (const pr of s.projekter) {
        if (pr.klar) {
          if (pr.fejl > 4 && pr.faseLaengde.test < 6) a.push({ t: 'extendTest', projectId: pr.id, uger: 2 });
          else a.push({ t: 'launch', projectId: pr.id });
        } else if (pr.fase === 'design' || pr.fase === 'teknik') {
          const pris = boostPris(pr);
          if (pris !== null && s.indsigt >= pris + 12) {
            const svagest = (Object.keys(pr.params) as (keyof typeof pr.params)[]).sort((x, y) => pr.params[x] - pr.params[y])[0];
            a.push({ t: 'boost', projectId: pr.id, param: svagest });
          }
        }
      }

      // Energistyring: alle, der ikke er på kontrakt, arbejder på den aktive fase; trætte hviler (hysterese 20/60). Agenter hjælper.
      {
        const iKontraktNu = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
        const brugt = new Set<string>();
        for (const pr of s.projekter) {
          if (pr.klar) continue;
          const hold = pr.faseTildeling[pr.fase];
          const nyt = s.staff
            .filter((m) => !iKontraktNu.has(m.id) && !brugt.has(m.id))
            .filter((m) => (hold.includes(m.id) ? m.energi >= 20 : m.energi >= 60))
            .map((m) => m.id);
          const agenter = ledigeAgenter(s, pr, pr.fase).map((x) => x.id).filter((id) => !brugt.has(id));
          const endeligt = [...(nyt.length ? nyt : hold.filter((id) => !brugt.has(id) && s.staff.some((m) => m.id === id)).slice(0, 1)), ...agenter];
          for (const id of endeligt) brugt.add(id);
          if ([...endeligt].sort().join() !== [...hold].sort().join()) a.push({ t: 'assignPhase', projectId: pr.id, fase: pr.fase, ids: endeligt });
        }
      }

      // Luk udtjente produkter, når der findes et friskere i samme vertikal
      for (const pr of s.produkter) {
        if (pr.ejer !== 'spiller' || !pr.aktiv) continue;
        const hl = PRODUCT_TYPES[pr.typeId].halveringstidUger;
        if (s.uge - pr.lanceretUge < 3 * hl) continue;
        const v = PRODUCT_TYPES[pr.typeId].vertikal;
        const nyere = s.produkter.some((x) => x.ejer === 'spiller' && x.aktiv && x.id !== pr.id && PRODUCT_TYPES[x.typeId].vertikal === v && x.lanceretUge > pr.lanceretUge);
        if (nyere) a.push({ t: 'retireProduct', productId: pr.id });
      }

      // Nyt projekt
      const ledige = ledigeTilProjekt(s);
      if (s.projekter.length < maxProjekter(s) && ledige.length >= Math.min(2, s.staff.length) && s.uge >= 3) {
        const k = vaelgKombi(s);
        if (k) {
          const t = PRODUCT_TYPES[k.typeId];
          const min = minBudget(s, k.typeId);
          const budget = Math.max(min, Math.min(min * 6, s.kapital * 0.06));
          if (s.kapital > budget + 0.15) {
            a.push({
              t: 'startProject',
              project: {
                navn: `${t.navn} ${s.uge}`, typeId: k.typeId, themeId: k.themeId,
                markeder: (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].vertikaler[t.vertikal].status !== 'ingen' && s.markeder[m].licens !== 'inddraget'),
                margin: t.marginStd, intensitet, budget: Math.round(budget * 100) / 100,
              },
            });
          }
        }
      }
      // Kontraktopgaver til ledige, når der ikke kan startes projekter
      const iProjekt = new Set(s.projekter.filter((x) => !x.klar).flatMap((x) => x.faseTildeling[x.fase]));
      const iKontrakt = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
      const heltLedige = s.staff.filter((m) => !iProjekt.has(m.id) && !iKontrakt.has(m.id) && m.energi > 40);
      // Kontraktopgaver holder garagen i live: når kassen er tom, eller når der ikke er råd til et nyt projekt
      const billigst = Math.min(...PRODUCT_TYPE_IDS.filter((t) => typeStatus(s, t).ok).map((t) => minBudget(s, t)));
      const ingenProjekt = s.projekter.length === 0 && s.uge >= 3;
      if ((s.projekter.length === 0 && s.uge < 3) || (heltLedige.length > 0 && (s.kapital < 0.6 || (ingenProjekt && s.kapital < billigst + 0.15)))) {
        if (heltLedige.length > 0 && s.kontraktTilbud.length > 0) {
          const t = s.kontraktTilbud[0];
          a.push({ t: 'takeContract', contractId: t.id, staff: heltLedige.slice(0, t.maxStaff).map((m) => m.id) });
        }
      }

      // Ansættelser (efter en transformation genbesættes de erstattede roller ikke)
      const loen = s.staff.reduce((x, m) => x + m.loenPrUge, 0);
      const buffer = 1 + loen * 30;
      const loft = s.transformation.length ? Math.round(pladser(s) * (1 - p.transformation)) : pladser(s);
      // Ansæt kun, når forretningen tjener penge (eller kassen er stor): ellers fanges firmaet i kælderen
      const tjener = s.regnskab.resultat > 0 || s.kapital > buffer * 3;
      if (s.staff.length < loft && s.kapital > buffer + 0.5 && tjener) {
        if (s.kandidater.length === 0) {
          a.push({ t: 'postJobAd', niveau: s.kapital > 60 ? 3 : s.kapital > 8 ? 2 : 1 });
        } else {
          const onsket = [...ONSKEDE_ROLLER[s.startVertikal], ...(s.uge >= AI_AKT_UGE && p.ai !== 'ingen' ? (['aiIngenioer'] as Role[]) : [])];
          const cyklus = [...onsket, ...onsket, ...onsket, ...onsket, ...onsket];
          const mangler = cyklus.find((r, i) => s.staff.filter((m) => m.rolle === r).length < cyklus.slice(0, i + 1).filter((x) => x === r).length);
          const k = [...s.kandidater].sort((x, y) => {
            const px = (x.rolle === mangler ? 30 : 0) + Object.values(x.stats).reduce((q, w) => q + w, 0) / 6;
            const py = (y.rolle === mangler ? 30 : 0) + Object.values(y.stats).reduce((q, w) => q + w, 0) / 6;
            return py - px;
          })[0];
          a.push({ t: 'hire', kandidatId: k.id });
        }
      }
      // Skær ned, når firmaet taber penge og kassen er ved at løbe tør
      if (s.kapital < buffer && s.regnskab.resultat < 0 && s.staff.length > 2 && s.uge % 4 === 0) {
        const m = s.staff.filter((x) => !x.stifter && x.rolle !== 'compliance').sort((x, y) => y.loenPrUge - x.loenPrUge)[0];
        if (m) a.push({ t: 'fire', staffId: m.id });
      }
      // Kontor
      const nk = naesteKontor(s);
      if (nk && kontorKrav(s).ok && s.kapital > nk.pris * 2 + buffer && s.staff.length >= OFFICE_BY_ID[s.kontor].pladser) a.push({ t: 'upgradeOffice' });

      // Træning
      if (s.indsigt > 35 && s.kapital > buffer + 1) {
        const m = [...s.staff].filter((x) => x.energi > 60).sort((x, y) => x.niveau - y.niveau)[0];
        if (m) {
          const prim = ({ oddssaetter: 'matematik', udvikler: 'teknik', kasinodesigner: 'kreativitet', marketing: 'salg', compliance: 'ansvar', analytiker: 'matematik', kundeservice: 'ansvar', aiIngenioer: 'teknik' } as const)[m.rolle];
          a.push({ t: 'train', staffId: m.id, stat: prim });
        }
      }
      for (const m of s.staff) if (m.rolle === 'marketing' && !m.specialisering && m.niveau >= 5 && s.indsigt > 10) a.push({ t: 'changeRole', staffId: m.id, nyRolle: 'marketing' });
      // Rolleskift udvikler → AI-ingeniør fra 2026 (to AI-ingeniører giver flere agenter og AI-slots)
      if (s.uge >= AI_AKT_UGE && p.ai !== 'ingen' && s.staff.filter((m) => m.rolle === 'aiIngenioer').length < 2) {
        const dev = s.staff.filter((m) => m.rolle === 'udvikler' && m.niveau >= 5).sort((x, y) => y.niveau - x.niveau)[0];
        if (dev && s.indsigt > 10) a.push({ t: 'changeRole', staffId: dev.id, nyRolle: 'aiIngenioer' });
      }

      // Forskning (ansvarlige profiler tager ansvarsnoderne først)
      if (!s.forskning.igang) {
        const mulige = RESEARCH.filter((r) => forskningStatus(s, r).ok && (p.ai !== 'ingen' || !r.laaser) && !(r.laaser === 'hyper' && !p.hyper));
        const n = [...mulige].sort((x, y) => (p.ansvarsforskning ? Number(ANSVAR_FORSKNING.includes(y.id)) - Number(ANSVAR_FORSKNING.includes(x.id)) : 0) || x.indsigt - y.indsigt)[0];
        if (n && s.indsigt >= n.indsigt + 8) a.push({ t: 'startResearch', nodeId: n.id });
      }

      // Bonus og VIP (tilpasses tilliden)
      // Kassedisciplin: fuld bonus og VIP koster 22 % af BSI — det har en garage ikke råd til
      const raad = s.kapital > buffer * 1.5;
      const bonus = (presset ? 0 : raad ? p.bonus : Math.min(p.bonus, 1)) as 0 | 1 | 2 | 3;
      const vip = (presset ? 0 : raad ? p.vip : 0) as 0 | 1 | 2 | 3;
      if (s.bonusNiveau !== bonus && s.produkter.some((x) => x.ejer === 'spiller')) a.push({ t: 'setBonus', niveau: bonus });
      if (s.vipProgram !== vip && s.produkter.some((x) => x.ejer === 'spiller')) a.push({ t: 'setVip', niveau: vip });

      // Marketing (holdes nede, når kassen er tynd; sat på pause, mens der spares op til næste projekt)
      const spar = !p.runder && ingenProjekt && s.kapital < billigst + 0.3;
      if (spar && s.uge % 4 === 0) for (const k of Object.keys(p.kanaler) as AcqChannel[]) if ((s.marketingMix[k] ?? 0) > 0) a.push({ t: 'setMarketing', channel: k, prUge: 0 });
      if (!spar && s.produkter.some((x) => x.ejer === 'spiller' && x.aktiv) && s.uge % 4 === 0) {
        const kasse = s.kapital < buffer ? 0.3 : s.kapital < buffer * 2 ? 0.7 : 1;
        // Et lille firma bruger et fast minimum på marketing, når der er råd (ellers vokser det aldrig ud af garagen)
        const budget = Math.max(s.kapital > 1 ? 0.02 : 0.01, s.regnskab.bsi * p.marketingAndel * kasse);
        for (const [k, andel] of Object.entries(p.kanaler) as [AcqChannel, number][]) {
          if (!kanalTilgaengelig(s, k)) continue;
          a.push({ t: 'setMarketing', channel: k, prUge: Math.round(budget * andel * 1000) / 1000 });
        }
      }

      // Messer
      for (const e of EXPOS) {
        if (bookingAabent(s, e.id) && !s.messeBookinger.some((b) => b.expoId === e.id && b.aar === aar)) {
          const st = s.kapital > 60 ? 3 : s.kapital > 15 ? 2 : s.kapital > 3 ? 1 : 0;
          if (st > 0) a.push({ t: 'bookExpoStand', expoId: e.id, stoerrelse: st as 1 | 2 | 3 });
        }
      }
      // Anden vertikal fra 2014
      const anden = ANDEN_VERTIKAL[s.startVertikal];
      const hjem: MarketId = s.markeder.dk.licens !== 'ingen' || s.mode !== 'usa2018' ? 'dk' : 'us';
      if (p.andenVertikal && aar >= 2014 && s.markeder[hjem].vertikaler[anden].status === 'ingen' && s.kapital > 4 && licensStatus(s, hjem).ok) a.push({ t: 'applyLicense', market: hjem, vertical: anden });
      // Udvid til nye markeder efter afgift og kanalisering
      const udenlandske = (Object.keys(s.markeder) as MarketId[]).filter((m) => m !== hjem && s.markeder[m].licens !== 'ingen').length;
      if (udenlandske < p.markeder && s.kontor !== 'garage' && s.kapital > 25) {
        const kandidater = (['uk', 'se', 'on', 'nl', 'de', 'us', 'fi', 'no'] as MarketId[])
          .filter((m) => m !== hjem && licensStatus(s, m).ok && s.markeder[m].vertikaler[s.startVertikal].status === 'ingen')
          .sort((x, y) => s.markeder[y].kanalisering - s.markeder[x].kanalisering - (s.markeder[y].afgift - s.markeder[x].afgift));
        const m = kandidater[0];
        if (m && s.kapital > licensPris(s, m).gebyr * 6 + 20 && MARKETS[m].cacFaktor <= p.maxCacFaktor) a.push({ t: 'applyLicense', market: m, vertical: s.startVertikal });
      }
      // Offshore-fristelsen
      if (p.offshore !== null && !s.offshoreBrand && aar >= p.offshore && s.produkter.some((x) => x.ejer === 'spiller') && s.kapital > 4) a.push({ t: 'setOffshoreBrand', aktiv: true });
      // Platforme: produktplatformen først, derefter konto og den anden vertikal
      if (p.platform) {
        const [primaer, sekundaer]: PlatformKind[] = s.startVertikal === 'betting' ? ['sportsbook', 'kasinoplatform'] : ['kasinoplatform', 'sportsbook'];
        const plan: [PlatformKind, PlatformModel][] = [[primaer, p.platformPlan.primaer], ['kontoplatform', p.platformPlan.konto], [sekundaer, p.platformPlan.sekundaer]];
        const RANG: PlatformModel[] = ['whiteLabel', 'turnkey', 'hybrid', 'egen'];
        for (const [kind, maalModel] of plan) {
          const pl = s.platforme[kind];
          if (pl.migrererTil) break;
          const nu = RANG.indexOf(pl.model);
          if (nu >= RANG.indexOf(maalModel)) continue;
          // Et trin ad gangen (egen platform først fra 2018)
          const naeste = maalModel === 'turnkey' ? 'turnkey' : nu < 2 ? 'hybrid' : aar >= 2018 ? 'egen' : null;
          if (!naeste) continue;
          if (platformStatus(s, kind, naeste).ok && s.kapital > PLATFORM_MODELS[naeste].capex * 2.5 + buffer) a.push({ t: 'choosePlatform', kind, model: naeste });
          break;
        }
        if (p.b2b) {
          for (const kind of ['sportsbook', 'kasinoplatform'] as PlatformKind[]) {
            const st = b2bStatus(s, kind);
            if (st.ok && s.kapital > st.licens + buffer) a.push({ t: 'sellPlatformB2B', kind });
          }
        }
      }
      // Opkøbstilbud: sælg, hvis profilen vil (fra et bestemt år og evt. kun til én køber); ellers afvis
      if (s.opkoebstilbud) {
        const t = s.opkoebstilbud;
        const sælg = p.saelg && aar >= p.saelg.fra && (!p.saelg.kun || p.saelg.kun === t.competitorId);
        a.push(sælg ? { t: 'acceptOffer', competitorId: t.competitorId } : { t: 'afvisTilbud' });
      }
      const sa = s.sponsorAuktion;
      if (p.sponsorater && sa && sa.spillerBud === null && s.markeder[sa.marked].licens === 'aktiv' && s.kapital > sa.mindstebud * 10 + buffer) a.push({ t: 'bydSponsorat', bud: Math.round(sa.mindstebud * 1.5 * 10) / 10 });
      // AI-akten
      if (s.uge >= AI_AKT_UGE && p.ai !== 'ingen') a.push(...aiBeslutninger(p, s, buffer));
      // Runder
      if (p.runder && naesteRunde(s).ok) a.push({ t: 'raiseRound' });
      return a;
    },
  };
}
