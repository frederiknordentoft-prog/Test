// Tværs-sporet (fase 3): rene hjælpere til markeder, licenser pr. marked, trends, regler og sanktioner.
// Spejler sim-kernens regler (src/sim/markets.ts, regulation.ts, trust.ts, trends.ts) uden at ændre state.
import type { AktivTrend, GameState, LiveProduct, MarketId, Project, TrendEffect, Vertical } from '../../sim/types';
import type { IkonNavn } from '../components/kit';
import type { PanelId } from '../../store/uiStore';
import type { MarkedSektion } from './markedHjaelp';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { VERTICALS } from '../../data/verticals';
import { CHANNELS, CHANNEL_IDS } from '../../data/acquisition';
import { REGLER } from '../../data/regulationTimeline';
import { SPORTSKALENDER, TRENDS } from '../../data/trends';
import { TRUST } from '../../data/trust';
import { markedsBsiBasis } from '../../sim/customers';
import { hjemmebane } from '../../sim/charts';
import { datoTekst, sanktionsGraense, tillidsPoster, trendDaekker } from '../../sim/selectors';
import { fortegn } from '../format';

/** Markedets beskrivelse i den rigtige tid: "Åbnede i 2019." giver ingen mening, før markedet er åbnet */
export function markedBeskrivelse(m: MarketId, uge: number, aaben = false): string {
  const def = MARKETS[m];
  // Et monopolmarked, der er åbnet i et verdensscenarie (Norge): datafilens tekst handler om monopolet
  if (def.aabnerUge === null && aaben) return def.beskrivelseAaben ?? def.beskrivelse;
  if (def.aabnerUge === null) return def.beskrivelse;
  if (uge <= def.aabnerUge + 1) return def.beskrivelse.replace(/^Åbnede[^.]*\.\s*/, '');
  return def.beskrivelse.replace(/^Åbner /, 'Åbnede ');
}

// ---------- Licens pr. marked og vertikal ----------

export type LicensTilstand = 'aktiv' | 'ansoegt' | 'ingen' | 'suspenderet' | 'inddraget' | 'lukket' | 'monopol';
export type MarkedLicens = { tilstand: LicensTilstand; uger: number; tilUge?: number };

/** Hvor står en vertikal i et marked — inkl. markeder, der ikke er åbnet, og sanktioner */
export function vertikalLicens(s: GameState, m: MarketId, v: Vertical): MarkedLicens {
  const def = MARKETS[m];
  const ms = s.markeder[m];
  if (def.aabnerUge === null) return { tilstand: 'monopol', uger: 0 };
  if (!ms.aaben) return { tilstand: 'lukket', uger: Math.max(0, def.aabnerUge - s.uge), tilUge: def.aabnerUge };
  if (ms.licens === 'inddraget') return { tilstand: 'inddraget', uger: 0 };
  if (ms.licens === 'suspenderet') {
    const til = ms.suspenderetTil ?? s.uge;
    return { tilstand: 'suspenderet', uger: Math.max(0, til - s.uge), tilUge: til };
  }
  const vl = ms.vertikaler[v];
  if (vl.status === 'aktiv') return { tilstand: 'aktiv', uger: 0 };
  if (vl.status === 'ansoegt') {
    const klar = vl.klarUge ?? s.uge;
    return { tilstand: 'ansoegt', uger: Math.max(0, klar - s.uge), tilUge: klar };
  }
  return { tilstand: 'ingen', uger: 0 };
}

export const LICENS_STIL: Record<LicensTilstand, { ikon: IkonNavn; farve: string }> = {
  aktiv: { ikon: 'flueben', farve: 'var(--color-good)' },
  ansoegt: { ikon: 'ur', farve: 'var(--color-warn)' },
  ingen: { ikon: 'laas', farve: 'var(--color-dim)' },
  suspenderet: { ikon: 'pause', farve: 'var(--color-bad)' },
  inddraget: { ikon: 'kryds', farve: 'var(--color-bad)' },
  lukket: { ikon: 'laas', farve: 'var(--color-dim)' },
  monopol: { ikon: 'laas', farve: 'var(--color-dim)' },
};

export function ugerKort(n: number): string {
  return `${n} uge${n === 1 ? '' : 'r'}`;
}

/** Kort statustekst: "Licens aktiv", "Licens om 4 uger", "Suspenderet til mar. 2024" … */
export function licensTekst(l: MarkedLicens): string {
  switch (l.tilstand) {
    case 'aktiv': return 'Licens aktiv';
    case 'ansoegt': return l.uger <= 0 ? 'Licens klar i næste uge' : `Licens om ${ugerKort(l.uger)}`;
    case 'ingen': return 'Ingen licens';
    case 'suspenderet': return `Suspenderet til ${datoTekst(l.tilUge ?? 0)}`;
    case 'inddraget': return 'Licens inddraget';
    case 'lukket': return `Åbner ${datoTekst(l.tilUge ?? 0)}`;
    case 'monopol': return 'Statsmonopol';
  }
}

/** Kan vertikalen vælges til et nyt projekt i markedet? (samme regel som startProject) */
export function kanVaelges(s: GameState, m: MarketId, v: Vertical): boolean {
  return s.markeder[m].vertikaler[v].status !== 'ingen';
}

/** Markeder, der kan vælges til et nyt produkt: aktive licenser først, så ansøgte, så suspenderede */
export function valgbareMarkeder(s: GameState, v: Vertical): MarketId[] {
  const orden: Partial<Record<LicensTilstand, number>> = { aktiv: 0, ansoegt: 1, suspenderet: 2 };
  return MARKET_IDS.filter((m) => kanVaelges(s, m, v)).sort(
    (a, b) => (orden[vertikalLicens(s, a, v).tilstand] ?? 3) - (orden[vertikalLicens(s, b, v).tilstand] ?? 3) || MARKET_IDS.indexOf(a) - MARKET_IDS.indexOf(b),
  );
}

/** Standardvalg til et nyt produkt: alle markeder med aktiv licens — ellers dem, der er søgt */
export function standardMarkeder(s: GameState, v: Vertical): MarketId[] {
  const aktive = MARKET_IDS.filter((m) => vertikalLicens(s, m, v).tilstand === 'aktiv');
  if (aktive.length) return aktive;
  return MARKET_IDS.filter((m) => vertikalLicens(s, m, v).tilstand === 'ansoegt');
}

/** Markedets samlede online-BSI pr. år for en vertikal (licenseret + offshore), mio. kr. */
export function markedAarsBsi(m: MarketId, v: Vertical, uge: number): number {
  return markedsBsiBasis(m, v, uge) * 52;
}

/** "1,2 mia./år" / "340 mio./år" */
export function stoerrelseTekst(mio: number): string {
  if (mio >= 1000) return `${(mio / 1000).toFixed(1).replace('.', ',')} mia./år`;
  if (mio >= 10) return `${Math.round(mio)} mio./år`;
  return `${mio.toFixed(1).replace('.', ',')} mio./år`;
}

export function faktorTekst(f: number): string {
  return `×${(Math.round(f * 100) / 100).toString().replace('.', ',')}`;
}

// ---------- Projekter: lanceringsplan pr. marked ----------

/** Uger, til projektet er færdigtestet (0 = klar) */
export function resterendeUdvikling(p: Project): number {
  if (p.klar) return 0;
  const faser = ['koncept', 'design', 'teknik', 'test'] as const;
  const i = faser.indexOf(p.fase);
  let rest = Math.max(0, p.faseLaengde[p.fase] - p.faseUge);
  for (const f of faser.slice(i + 1)) rest += p.faseLaengde[f];
  return rest;
}

export type PlanPunkt = { m: MarketId; lic: MarkedLicens; klar: boolean; tekst: string };

/** Pr. marked: er licensen klar til lancering? ("DK klar", "SE licens om 4 uger") */
export function lanceringsPlan(s: GameState, p: Project): PlanPunkt[] {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  return p.markeder.map((m) => {
    const lic = vertikalLicens(s, m, v);
    const k = MARKETS[m].kort;
    const klar = lic.tilstand === 'aktiv';
    const tekst =
      lic.tilstand === 'aktiv'
        ? `${k} klar`
        : lic.tilstand === 'ansoegt'
          ? lic.uger <= 0
            ? `${k} licens i næste uge`
            : `${k} licens om ${ugerKort(lic.uger)}`
          : lic.tilstand === 'suspenderet'
            ? `${k} suspenderet til ${datoTekst(lic.tilUge ?? 0)}`
            : lic.tilstand === 'inddraget'
              ? `${k} licens inddraget`
              : `${k} ${licensTekst(lic).toLowerCase()}`;
    return { m, lic, klar, tekst };
  });
}

// ---------- Produkter pr. marked ----------

export type ProduktMarked = { m: MarketId; bsi: number; nye: number; placering: number | null; bedst?: number; lic: MarkedLicens };

export function produktMarkeder(s: GameState, p: LiveProduct): ProduktMarked[] {
  const v = PRODUCT_TYPES[p.typeId].vertikal;
  return p.markeder.map((m) => ({
    m,
    bsi: p.bsiPrUge[m] ?? 0,
    nye: p.nyeSpillerePrUge?.[m] ?? 0,
    placering: s.markeder[m].top10.find((e) => e.productId === p.id)?.placering ?? null,
    bedst: p.bedstePlacering[m],
    lic: p.ejer === 'spiller' ? vertikalLicens(s, m, v) : { tilstand: 'aktiv', uger: 0 },
  }));
}

/** Bedste nuværende og historiske placering på tværs af markeder */
export function bedstePlaceringer(s: GameState, p: LiveProduct): { nu: { m: MarketId; placering: number } | null; bedst: { m: MarketId; placering: number } | null } {
  let nu: { m: MarketId; placering: number } | null = null;
  let bedst: { m: MarketId; placering: number } | null = null;
  for (const m of MARKET_IDS) {
    const e = s.markeder[m].top10.find((x) => x.productId === p.id);
    if (e && (!nu || e.placering < nu.placering)) nu = { m, placering: e.placering };
    const b = p.bedstePlacering[m];
    if (b !== undefined && (!bedst || b < bedst.placering)) bedst = { m, placering: b };
  }
  return { nu, bedst };
}

/** Samme rangering som hitlisten i sim-kernen (ugens nye spillere, derefter BSI) — for ét marked */
/** Hitlistens rangtal (samme som beregnTop10): nye spillere (glattet) × statsselskabets hjemmebane */
export function hitlisteVaerdi(s: GameState, p: LiveProduct, m: MarketId): number {
  return (p.hitlisteTal?.[m] ?? p.nyeSpillerePrUge?.[m] ?? 0) * hjemmebane(s, p.ejer, m);
}

export function rangliste(s: GameState, m: MarketId): LiveProduct[] {
  const nye = (p: LiveProduct) => hitlisteVaerdi(s, p, m);
  return s.produkter
    .filter((p) => p.aktiv && nye(p) > 0)
    .sort((a, b) => nye(b) - nye(a) || (b.bsiPrUge[m] ?? 0) - (a.bsiPrUge[m] ?? 0) || (a.id < b.id ? -1 : 1));
}

/** Markeder, hvor licensen er suspenderet eller inddraget (til advarsler) */
export function ramteMarkeder(s: GameState): { m: MarketId; tilstand: 'suspenderet' | 'inddraget'; tilUge?: number }[] {
  const ud: { m: MarketId; tilstand: 'suspenderet' | 'inddraget'; tilUge?: number }[] = [];
  for (const m of MARKET_IDS) {
    const ms = s.markeder[m];
    if (ms.licens === 'suspenderet') ud.push({ m, tilstand: 'suspenderet', tilUge: ms.suspenderetTil ?? undefined });
    else if (ms.licens === 'inddraget') ud.push({ m, tilstand: 'inddraget' });
  }
  return ud;
}

// ---------- Trends ----------

export type Tone = 'god' | 'skidt' | 'neutral';
export type EffektChip = { tekst: string; tone: Tone; ikon: IkonNavn };
export const TONE_FARVE: Record<Tone, string> = { god: 'var(--color-good)', skidt: 'var(--color-bad)', neutral: 'var(--color-muted)' };

const pctTekst = (v: number) => `${fortegn(Math.round(v * 100))} %`;
/** Fortegn med én decimal, men uden ",0" */
const f1 = (v: number) => (Math.abs(Math.round(v * 10) - Math.round(v) * 10) < 1e-9 ? fortegn(Math.round(v)) : fortegn(v, 1));

/** Effekt-chips for en trend: "Betting +25 %", "Offshore +5 pp" … */
export function trendChips(e: TrendEffect): EffektChip[] {
  const ud: EffektChip[] = [];
  if (e.bettingBsi) ud.push({ tekst: `Betting ${pctTekst(e.bettingBsi)}`, tone: e.bettingBsi > 0 ? 'god' : 'skidt', ikon: e.bettingBsi > 0 ? 'op' : 'ned' });
  if (e.kasinoBsi) ud.push({ tekst: `Kasino ${pctTekst(e.kasinoBsi)}`, tone: e.kasinoBsi > 0 ? 'god' : 'skidt', ikon: e.kasinoBsi > 0 ? 'op' : 'ned' });
  if (e.offshorePp) ud.push({ tekst: `Offshore ${fortegn(e.offshorePp)} pp`, tone: e.offshorePp > 0 ? 'skidt' : 'god', ikon: 'globus' });
  if (e.marketingRoi) ud.push({ tekst: `Marketing ${pctTekst(e.marketingRoi)}`, tone: e.marketingRoi > 0 ? 'god' : 'skidt', ikon: 'hoejttaler' });
  if (e.afgiftRisiko) ud.push({ tekst: `Afgiftsrisiko ${pctTekst(e.afgiftRisiko)}`, tone: e.afgiftRisiko > 0 ? 'skidt' : 'god', ikon: 'advarsel' });
  if (ud.length === 0) ud.push({ tekst: 'Vanerne flytter sig', tone: 'neutral', ikon: 'lyn' });
  return ud;
}

const EUROPA: MarketId[] = ['dk', 'uk', 'se', 'de', 'nl', 'fi', 'no'];

/** "Alle markeder", "Europa", "DK, SE" */
export function trendMarkederTekst(markeder: AktivTrend['markeder']): string {
  if (markeder === 'alle') return 'Alle markeder';
  if (markeder.length === EUROPA.length && EUROPA.every((m) => markeder.includes(m))) return 'Europa';
  if (markeder.length > 4) return `${markeder.length} markeder`;
  return markeder.map((m) => MARKETS[m].kort).join(', ');
}

/** Rammer trenden et marked, hvor spilleren har (eller søger) licens? */
export function trendRammerJer(s: GameState, t: AktivTrend): boolean {
  return MARKET_IDS.some((m) => s.markeder[m].licens !== 'ingen' && s.markeder[m].licens !== 'inddraget' && trendDaekker(t, m));
}

export type Sportsbegivenhed = { titel: string; igang: boolean; uger: number; chips: EffektChip[] };

/** Sportskalenderens næste (eller igangværende) slutrunde */
export function naesteSport(uge: number): Sportsbegivenhed | null {
  for (const f of SPORTSKALENDER) {
    const titel = f.titel ?? TRENDS[f.trendId]?.titel ?? f.trendId;
    const chips = trendChips(TRENDS[f.trendId]?.effekt ?? {});
    if (uge >= f.uge && uge < f.uge + f.uger) return { titel, igang: true, uger: f.uge + f.uger - uge, chips };
    if (f.uge > uge) return { titel, igang: false, uger: f.uge - uge, chips };
  }
  return null;
}

// ---------- Regler ----------

export type Konsekvens = { tekst: string; tone: Tone; ikon: IkonNavn };

/** Hvad betyder en regel for spillerens produkter og marketing i markedet? pp: afgiftsstigningens trukne størrelse */
export function regelKonsekvenser(s: GameState, m: MarketId, regelId: string, pp?: number): Konsekvens[] {
  const r = REGLER[regelId];
  if (!r) return [];
  const f = r.effekt;
  const land = MARKETS[m].navn;
  const ms = s.markeder[m];
  const ud: Konsekvens[] = [];
  const egne = s.produkter.filter((p) => p.ejer === 'spiller' && p.aktiv && p.markeder.includes(m));

  if (f.cac) {
    const ramte = Object.entries(f.cac).filter(([k]) => (s.marketingMix[k as keyof typeof s.marketingMix] ?? 0) > 0);
    if (ramte.length) {
      for (const [k, v] of ramte) {
        ud.push({ tekst: `I bruger ${CHANNELS[k as keyof typeof CHANNELS].navn.toLowerCase()}: nye kunder derfra bliver ${Math.round((v ?? 0) * 100)} % dyrere i ${land}.`, tone: 'skidt', ikon: 'hoejttaler' });
      }
    } else {
      const navne = Object.keys(f.cac).map((k) => CHANNELS[k as keyof typeof CHANNELS].navn.toLowerCase());
      ud.push({ tekst: `Dyrere ${navne.join(', ')} — men dem bruger I ikke lige nu.`, tone: 'neutral', ikon: 'hoejttaler' });
    }
  }
  if (f.lukKanal) {
    for (const k of f.lukKanal) {
      const bruger = (s.marketingMix[k] ?? 0) > 0;
      ud.push({
        tekst: bruger
          ? `${CHANNELS[k].navn} lukkes i ${land}. Den del af budgettet, der lander her, giver ingen nye kunder.`
          : `${CHANNELS[k].navn} lukkes i ${land} — det rammer ikke jeres mix i dag.`,
        tone: bruger ? 'skidt' : 'neutral',
        ikon: 'laas',
      });
    }
  }
  if (f.bonusMax !== undefined) {
    ud.push(
      s.bonusNiveau > f.bonusMax
        ? { tekst: `Jeres bonus (niveau ${s.bonusNiveau}) loftes til niveau ${f.bonusMax} i ${land}. I betaler stadig for det fulde niveau andre steder.`, tone: 'skidt', ikon: 'diamant' }
        : { tekst: `Bonusloft på niveau ${f.bonusMax}. Jeres bonus (niveau ${s.bonusNiveau}) er allerede under.`, tone: 'god', ikon: 'diamant' },
    );
  }
  if (f.vipMax !== undefined) {
    ud.push(
      s.vipProgram > f.vipMax
        ? { tekst: `VIP-programmet (niveau ${s.vipProgram}) loftes til niveau ${f.vipMax} i ${land}.`, tone: 'skidt', ikon: 'krone' }
        : { tekst: `VIP-loft på niveau ${f.vipMax}. Jeres VIP-program (niveau ${s.vipProgram}) er allerede under.`, tone: 'god', ikon: 'krone' },
    );
  }
  if (f.arpu) {
    for (const v of ['betting', 'kasino'] as Vertical[]) {
      const d = f.arpu[v];
      if (!d) continue;
      const n = egne.filter((p) => PRODUCT_TYPES[p.typeId].vertikal === v).length;
      ud.push(
        n > 0
          ? { tekst: `${n} ${VERTICALS[v].kort.toLowerCase()}produkt${n === 1 ? '' : 'er'} i ${land}: ${pctTekst(d)} BSI pr. kunde.`, tone: d < 0 ? 'skidt' : 'god', ikon: 'penge' }
          : { tekst: `${VERTICALS[v].kort} ${pctTekst(d)} BSI pr. kunde — I har ingen ${VERTICALS[v].kort.toLowerCase()}produkter i ${land} endnu.`, tone: 'neutral', ikon: 'penge' },
      );
    }
  }
  if (f.afgiftPp) {
    // Afgiftsstigningens størrelse trækkes ved varslet (3-8 pp); gamle gemte spil kan mangle den
    const stigning = regelId === 'afgiftsstigning' ? (pp !== undefined ? String(pp) : '3-8') : String(f.afgiftPp);
    // Satsen pr. vertikal (UK beskatter kasino og betting forskelligt — et gennemsnit ville ikke stå nogen andre steder)
    const sats = (v: Vertical) => String(Math.round((ms.afgiftPrVertikal[v] + ms.afgiftTillaeg / 100) * 1000) / 10).replace('.', ',');
    const nu = sats('betting') === sats('kasino') ? `${sats('betting')} %` : `betting ${sats('betting')} %, kasino ${sats('kasino')} %`;
    ud.push({
      tekst: f.afgiftPp > 0
        ? `Afgiften stiger ${stigning} procentpoint (i dag ${nu}). Det tager direkte af bundlinjen.`
        : `Afgiften falder ${Math.abs(f.afgiftPp)} procentpoint (i dag ${nu}).`,
      tone: f.afgiftPp > 0 ? 'skidt' : 'god',
      ikon: 'penge',
    });
  }
  if (f.offshorePp) {
    ud.push({
      tekst: f.offshorePp < 0 ? `Offshore mister ${Math.abs(f.offshorePp)} pp — flere spillere til de licenserede.` : `Offshore vinder ${f.offshorePp} pp af markedet.`,
      tone: f.offshorePp < 0 ? 'god' : 'skidt',
      ikon: 'globus',
    });
  }
  if (f.blokering) {
    ud.push({ tekst: 'Ulovlige sider blokeres. Det skubber spillere over til de licenserede — også til jer.', tone: 'god', ikon: 'skjold' });
  }
  if (f.kraeverRisikoAgent) {
    const har = s.agenter.some((a) => a.funktion === 'risiko');
    ud.push(
      har
        ? { tekst: 'I har allerede en AI-risikoagent. Hold overvågningen oppe.', tone: 'god', ikon: 'skjold' }
        : { tekst: 'Uden AI-baseret risikodetektion risikerer I påbud.', tone: 'skidt', ikon: 'advarsel' },
    );
  }
  if (f.marketingEffekt) {
    ud.push({ tekst: `Al marketing i ${land} virker ${Math.abs(Math.round(f.marketingEffekt * 100))} % ${f.marketingEffekt < 0 ? 'dårligere' : 'bedre'}.`, tone: f.marketingEffekt < 0 ? 'skidt' : 'god', ikon: 'hoejttaler' });
  }
  if (ms.licens === 'ingen' || egne.length === 0) {
    ud.push({ tekst: egne.length === 0 && ms.licens !== 'ingen' ? `I har ingen produkter i ${land} endnu, så det rammer først, når I lancerer her.` : `I er ikke aktive i ${land} endnu.`, tone: 'neutral', ikon: 'spoergsmaal' });
  }
  return ud;
}

/** Hvornår træder en planlagt regel i kraft? (pp: afgiftsstigningens størrelse, hvis den er trukket) */
export function regelIkraft(s: GameState, m: MarketId, regelId: string): { uge: number; dynamisk: boolean; pp?: number } | null {
  // Seneste varsel først (en afgiftsstigning kan være planlagt mere end én gang)
  const p = [...s.planlagteRegler].reverse().find((x) => x.marked === m && x.regelId === regelId);
  return p ? { uge: p.ikrafttraedelseUge, dynamisk: !!p.dynamisk, ...(p.pp !== undefined ? { pp: p.pp } : {}) } : null;
}

// ---------- Sanktioner og tilsynstillid ----------

export const TRAPPE: { trin: 1 | 2 | 3 | 4; navn: string; graense: number; tekst: string }[] = [
  { trin: 1, navn: 'Påbud', graense: TRUST.sanktioner.paabud, tekst: 'Et påbud og et lille gebyr' },
  { trin: 2, navn: 'Bøde', graense: TRUST.sanktioner.boede, tekst: 'Bøde på ca. 4 % af et års BSI' },
  { trin: 3, navn: 'Gennemgang', graense: TRUST.sanktioner.gennemgang, tekst: 'Licensen suspenderes i 8 uger' },
  { trin: 4, navn: 'Inddragelse', graense: TRUST.sanktioner.inddragelse, tekst: 'Licensen inddrages for altid' },
];

/** sektion: afsnittet i Marked-panelet, knappen ruller til */
export type Raad = { id: string; tekst: string; ikon: IkonNavn; farve: string; panel: PanelId; knap: string; vaerdi?: number; sektion?: MarkedSektion };

/** Konkrete råd til at få tilliden op igen — med de tal, der trækker nu */
export function sanktionsRaad(s: GameState, m: MarketId): Raad[] {
  const poster = tillidsPoster(s, m);
  const post = (start: string) => poster.find((p) => p.tekst.startsWith(start))?.vaerdi;
  const ud: Raad[] = [];
  const comp = s.staff.filter((x) => x.rolle === 'compliance').length;
  const compMax = Math.ceil(3 / TRUST.complianceNiveau);
  if (comp < compMax) {
    ud.push({
      id: 'compliance',
      tekst: comp === 0
        ? `Ansæt compliance-folk: +${String(TRUST.complianceNiveau).replace('.', ',')} tillid pr. kvartal for hver (op til +3).`
        : `Flere compliance-folk: I har ${comp}. Hver giver +${String(TRUST.complianceNiveau).replace('.', ',')} pr. kvartal (op til +3).`,
      ikon: 'folk',
      farve: 'var(--color-good)',
      panel: 'personale',
      knap: 'Personale',
    });
  }
  const ansvar = post('Ansvarsforskning');
  if (ansvar === undefined || ansvar < 2) {
    ud.push({ id: 'forskning', tekst: 'Forsk i ansvarligt spil: grænser og adfærdsovervågning giver op til +2 pr. kvartal.', ikon: 'kolbe', farve: 'var(--color-cyan)', panel: 'firma', knap: 'Forskning' });
  }
  if (s.bonusNiveau > 0) {
    ud.push({ id: 'bonus', tekst: `Sænk bonus (niveau ${s.bonusNiveau}): koster ${f1(post('Bonusniveau') ?? TRUST.bonusNiveau * s.bonusNiveau)} pr. kvartal.`, ikon: 'diamant', farve: 'var(--color-warn)', panel: 'marked', knap: 'Marked', vaerdi: post('Bonusniveau'), sektion: 'bonus' });
  }
  if (s.vipProgram > 0) {
    ud.push({ id: 'vip', tekst: `Skru ned for VIP (niveau ${s.vipProgram}): koster ${f1(post('VIP') ?? TRUST.vipProgram * s.vipProgram)} pr. kvartal.`, ikon: 'krone', farve: 'var(--color-warn)', panel: 'marked', knap: 'Marked', vaerdi: post('VIP'), sektion: 'bonus' });
  }
  const intense = s.produkter.filter((p) => p.ejer === 'spiller' && p.aktiv && p.markeder.includes(m) && p.intensitet > 3);
  if (intense.length) {
    const navne = intense.slice(0, 2).map((p) => p.navn).join(', ') + (intense.length > 2 ? ` +${intense.length - 2}` : '');
    ud.push({ id: 'intensitet', tekst: `Intensitet ned til 3 på ${navne}: koster ${f1(TRUST.intensitetOver3)} pr. kvartal.`, ikon: 'hype', farve: 'var(--color-warn)', panel: 'produkter', knap: 'Produkter' });
  }
  const aggressive = CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  if (aggressive.length) {
    ud.push({ id: 'kanaler', tekst: `Drop de aggressive kanaler (${aggressive.map((k) => CHANNELS[k].navn.toLowerCase()).join(', ')}): koster ${f1(TRUST.aggressivKanal)} pr. kvartal.`, ikon: 'hoejttaler', farve: 'var(--color-warn)', panel: 'marked', knap: 'Marked', sektion: 'marketing' });
  }
  if (s.offshoreBrand) {
    ud.push({ id: 'offshore', tekst: `Luk offshore-brandet: det koster ${f1(TRUST.offshoreBrand)} pr. kvartal i alle markeder.`, ikon: 'globus', farve: 'var(--color-bad)', panel: 'marked', knap: 'Marked', sektion: 'fristelsen' });
  }
  return ud;
}

/** Næste trin på trappen og grænsen for det (null ved inddragelse) */
export function naesteTrin(trin: 0 | 1 | 2 | 3 | 4): { trin: 1 | 2 | 3 | 4; graense: number } | null {
  if (trin >= 4) return null;
  const n = (trin + 1) as 1 | 2 | 3 | 4;
  return { trin: n, graense: sanktionsGraense(n) };
}

/** Sum af kvartalets tillidsposter i et marked */
export function tillidsTendens(s: GameState, m: MarketId): number {
  return tillidsPoster(s, m).reduce((a, p) => a + p.vaerdi, 0);
}
