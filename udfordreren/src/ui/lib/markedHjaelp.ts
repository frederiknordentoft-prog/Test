// Marked-sporet: rene hjælpere til markedskortet og konsolkortene (alle 9 markeder).
// Spejler sim-kernens formler (kun visning) — ændrer aldrig state. Valgt marked huskes i en lille store.
import { create } from 'zustand';
import type { AcqChannel, GameState, MarketId, Vertical } from '../../sim/types';
import type { IkonNavn } from '../components/kit';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { VERTICALS } from '../../data/verticals';
import { CHANNELS, CHANNEL_IDS } from '../../data/acquisition';
import { BONUS_TILGANG } from '../../data/costs';
import { REGLER, KANALISERINGSMAAL, DYNAMISK } from '../../data/regulationTimeline';
import { OFFSHORE_FORMEL as F, OFFSHORE_BASIS, OFFSHORE_AFGIFT_OVERRIDE, GRAA_MARKED, OFFSHORE_BRAND } from '../../data/offshore';
import { TRUST } from '../../data/trust';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { aarDecimal, kurve } from '../../sim/time';
import { aktiveMarkeder, effektivCac, kanalTilgaengelig, markedsKunder, portefoeljeStyrke, spillerProdukter } from '../../sim/customers';
import { markedAabent } from '../../sim/markets';
import { markedTotalBsi, offshoreAndele, offshoreDynPp, licenseretKvalitet } from '../../sim/offshore';
import { effektivBonus, effektivVip, regelBeskrivelse, regelEffekt } from '../../sim/regulation';
import { trendEffekt, daekker } from '../../sim/trends';
import { effektivAfgift } from '../../sim/economy';
import { featureFordel } from '../../sim/reactions';
import { aiMarkedsEffekt } from '../../sim/world';
import { sanktionsGraense } from '../../sim/trust';
import { T } from '../../render/palette';
import type { KortMarked, KortStatus } from '../../render/marketMap';

export const VERTIKALER: Vertical[] = ['betting', 'kasino'];

/** Markederne i den rækkefølge, de åbner (Norge til sidst: monopol) */
export const MARKED_RAEKKE: MarketId[] = [...MARKET_IDS].sort((a, b) => (MARKETS[a].aabnerUge ?? 1e9) - (MARKETS[b].aabnerUge ?? 1e9));

// ---------- Valgt marked (huskes mellem faneskift) ----------

/** Afsnit i Marked-panelet, man kan hoppe til (id'et er `marked-<sektion>`) */
export type MarkedSektion = 'konsol' | 'andele' | 'offshore' | 'regler' | 'tillid' | 'marketing' | 'bonus' | 'fristelsen';

/** sektion: et afsnit, panelet skal rulle til én gang (sættes af dialoger, ryddes af panelet) */
type MarkedValg = { valgt: MarketId; sektion: MarkedSektion | null; vaelg(m: MarketId): void; rydSektion(): void };
export const useMarkedValg = create<MarkedValg>((set) => ({
  valgt: 'dk',
  sektion: null,
  vaelg: (valgt) => set({ valgt }),
  rydSektion: () => set({ sektion: null }),
}));

/** Vælg et marked i Marked-fanen (kan bruges af andre spor, fx "Se markedet" i en dialog) — og evt. et afsnit at rulle til */
export function vaelgMarked(m: MarketId, sektion?: MarkedSektion): void {
  useMarkedValg.setState({ valgt: m, sektion: sektion ?? null });
}

// ---------- Status ----------

export type MarkedStatus = KortStatus;

export const STATUS_INFO: Record<MarkedStatus, { navn: string; kort: string; mini: string; farve: string; hex: string; ikon: IkonNavn }> = {
  aktiv: { navn: 'Licens aktiv', kort: 'Aktiv', mini: 'Aktiv', farve: 'var(--color-good)', hex: T.good, ikon: 'flueben' },
  ansoegt: { navn: 'Licens behandles', kort: 'Ansøgt', mini: 'Ansøgt', farve: 'var(--color-warn)', hex: T.warn, ikon: 'ur' },
  aaben: { navn: 'Åben for licenser', kort: 'Åben', mini: 'Åben', farve: 'var(--color-sky)', hex: T.sky, ikon: 'noegle' },
  lukket: { navn: 'Lukket endnu', kort: 'Lukket', mini: 'Lukket', farve: 'var(--color-dim)', hex: T.dim, ikon: 'laas' },
  monopol: { navn: 'Monopol', kort: 'Monopol', mini: 'Monopol', farve: 'var(--color-violet)', hex: T.violet, ikon: 'krone' },
  suspenderet: { navn: 'Licens suspenderet', kort: 'Suspenderet', mini: 'Pause', farve: 'var(--color-warn)', hex: T.warn, ikon: 'pause' },
  inddraget: { navn: 'Licens inddraget', kort: 'Inddraget', mini: 'Tabt', farve: 'var(--color-bad)', hex: T.bad, ikon: 'kryds' },
};

/** Monopol: markedet giver ikke licenser (Norge, medmindre det åbner i et verdensscenarie) */
export function erMonopol(g: GameState, m: MarketId): boolean {
  return MARKETS[m].aabnerUge === null && !g.markeder[m].aaben;
}

export function markedStatus(g: GameState, m: MarketId): MarkedStatus {
  const ms = g.markeder[m];
  if (erMonopol(g, m)) return 'monopol';
  if (!ms.aaben) return 'lukket';
  if (ms.licens === 'inddraget') return 'inddraget';
  if (ms.licens === 'suspenderet') return 'suspenderet';
  if (ms.licens === 'aktiv') return 'aktiv';
  if (ms.licens === 'ansoegt') return 'ansoegt';
  return 'aaben';
}

/** Markedet åbnede i løbet af spillet for nylig, og I har ikke søgt endnu (pulserer på kortet) */
export function nyAabnet(g: GameState, m: MarketId): boolean {
  const ms = g.markeder[m];
  return ms.aaben && ms.aabnetUge !== null && ms.aabnetUge > 0 && g.uge - ms.aabnetUge < 26 && ms.licens === 'ingen';
}

// ---------- Tilsynstillid på tværs af markeder (HUD og kort) ----------

/** Markeder, hvor tilsynets tillid betyder noget for jer lige nu (aktiv eller suspenderet licens) */
export function tillidsMarkeder(g: GameState): MarketId[] {
  return MARKET_IDS.filter((m) => g.markeder[m].licens === 'aktiv' || g.markeder[m].licens === 'suspenderet');
}

/** Tillid under 60 eller et trin på sanktionstrappen i et marked med licens */
export function tillidsAdvarsel(g: GameState, m: MarketId): boolean {
  const ms = g.markeder[m];
  if (ms.licens !== 'aktiv' && ms.licens !== 'suspenderet') return false;
  return ms.tilsynstillid < 60 || ms.sanktion.trin > 0;
}

/** Markedet, HUD'en viser tilsynstillid for: det svageste med licens (ellers hjemmemarkedet) */
export function hudTilsynsMarked(g: GameState): MarketId {
  const l = tillidsMarkeder(g);
  if (l.length === 0) return g.mode === 'usa2018' ? 'us' : 'dk';
  return l.reduce((a, b) => (g.markeder[b].tilsynstillid < g.markeder[a].tilsynstillid ? b : a));
}

/** Tooltip-tekst: tilliden i alle markeder med licens, laveste først */
export function tillidsOversigt(g: GameState): string {
  return tillidsMarkeder(g)
    .sort((a, b) => g.markeder[a].tilsynstillid - g.markeder[b].tilsynstillid)
    .map((m) => {
      const ms = g.markeder[m];
      const trin = ms.sanktion.trin > 0 ? ` (trin ${ms.sanktion.trin})` : '';
      return `${MARKETS[m].kort} ${Math.round(ms.tilsynstillid)}${trin}`;
    })
    .join(' · ');
}

/** Spillerens andel af markedets samlede BSI (inkl. offshore) */
export function spillerAndel(g: GameState, m: MarketId): number {
  return g.markeder[m].andele.spiller ?? 0;
}

// ---------- Størrelse, afgift og offshore ----------

export type Stoerrelse = { total: number; licenseret: number; offshore: number }; // mio. kr./år

/** Offshore-andele pr. vertikal (lukkede markeder regnes friskt, åbne læses fra state) */
export function offshoreAndel(g: GameState, m: MarketId): Record<Vertical, number> {
  const ms = g.markeder[m];
  if (ms.aaben) return ms.offshore;
  return offshoreAndele(offshoreDynPp(g, m), trendEffekt(g, m).offshorePp);
}

/** Markedets samlede online-BSI pr. uge (licenseret + offshore) før trends og udfald — samme tal som kundemotoren bruger */
function ugentligStoerrelse(g: GameState, m: MarketId, v: Vertical): number {
  const arpu = MARKETS[m].arpu[v];
  return arpu > 0 ? (markedsKunder(g, m, v) * arpu) / 52 / 1e6 : 0;
}

/** Markedets samlede online-BSI pr. år pr. vertikal (uden ugens udfaldsstøj), delt i licenseret og offshore.
 *  Med `uge` (fx åbningsugen for et lukket marked) bruges den historiske kurve uden trends. */
export function markedsStoerrelse(g: GameState, m: MarketId, uge?: number): Record<Vertical, Stoerrelse> {
  const tr = trendEffekt(g, m);
  const off = offshoreAndel(g, m);
  const ud = {} as Record<Vertical, Stoerrelse>;
  for (const v of VERTIKALER) {
    const trend = Math.max(0.1, 1 + (v === 'betting' ? tr.bettingBsi : tr.kasinoBsi));
    const total = (uge === undefined ? ugentligStoerrelse(g, m, v) * trend : markedTotalBsi(m, v, uge)) * 52;
    ud[v] = { total, licenseret: total * (1 - off[v]), offshore: total * off[v] };
  }
  return ud;
}

/** Hvor meget af et gråt marked (Norge) der stadig er gråt: hele, indtil markedet åbner; derefter offshore-andelen */
function graaRest(g: GameState, m: MarketId): number {
  const ms = g.markeder[m];
  return ms.aaben ? ms.offshore.kasino : 1;
}

/** Norges grå marked (mio. kr./år) — kun til at nå via offshore-brand */
export function graaMarkedAar(g: GameState, m: MarketId): number {
  const graa = GRAA_MARKED[m];
  if (!graa) return 0;
  const aar = aarDecimal(g.uge);
  return (kurve(graa.kasino, aar) + kurve(graa.betting, aar)) * 1000 * graaRest(g, m);
}

/** Afgiftssats af BSI (eller af indsats i Tyskland), inkl. dynamiske tillæg */
export function afgiftSats(g: GameState, m: MarketId, v: Vertical): number {
  const ms = g.markeder[m];
  return ms.afgiftPrVertikal[v] + ms.afgiftTillaeg / 100;
}

/** Tysk indsatsafgift omregnet til andel af BSI ved en given margin */
export function effektivIndsatsAfgift(g: GameState, v: Vertical, margin: number): number {
  return effektivAfgift(g, 'de', v, margin);
}

/** Jeres gennemsnitlige margin i en vertikal i et marked (null uden produkter) */
export function spillerMargin(g: GameState, m: MarketId, v: Vertical): number | null {
  const p = g.produkter.filter((x) => x.aktiv && x.ejer === 'spiller' && x.markeder.includes(m) && PRODUCT_TYPES[x.typeId].vertikal === v);
  return p.length ? p.reduce((a, x) => a + x.margin, 0) / p.length : null;
}

export type OffshorePost = { id: string; navn: string; pp: number; forklaring: string };

/** Hvad driver offshore? Samme led som offshoreDynPp i src/sim/offshore.ts (procentpoint før vertikalfaktoren) */
export function offshoreDrivere(g: GameState, m: MarketId): { poster: OffshorePost[]; sum: number; trendPp: number } {
  const ms = g.markeder[m];
  const aar = aarDecimal(g.uge);
  const afgiftPct = OFFSHORE_AFGIFT_OVERRIDE[m] ?? ((ms.afgiftPrVertikal.betting + ms.afgiftPrVertikal.kasino) / 2) * 100 + ms.afgiftTillaeg;
  const regler = ms.regler.map((id) => REGLER[id]).filter(Boolean);
  const bonusloft = regler.some((r) => r.effekt.bonusMax !== undefined && r.effekt.bonusMax <= 1);
  const regelPp = regler.reduce((a, r) => a + (r.effekt.offshorePp ?? 0), 0);
  let blok = 0;
  if (ms.blokering.dns !== null && g.uge >= ms.blokering.dns) blok += g.uge - ms.blokering.dns >= 104 ? F.dns / 2 : F.dns;
  if (ms.blokering.betaling !== null && g.uge >= ms.blokering.betaling) blok += F.betaling;
  if (ms.blokering.leverandoer) blok += F.leverandoer;
  const kval = licenseretKvalitet(g, m);
  const poster: OffshorePost[] = [
    { id: 'basis', navn: 'Markedets vaner', pp: kurve(OFFSHORE_BASIS[m], aar), forklaring: 'Historik, kultur og hvor let det er at finde de grå sider' },
    {
      id: 'afgift',
      navn: 'Afgift',
      pp: F.afgift * (afgiftPct - 20),
      forklaring: m === 'de' ? 'Indsatsafgiften svarer til ca. 50 % af BSI — dyrt for de licenserede' : `${Math.round(afgiftPct * 10) / 10} % mod normalen på 20 %`.replace('.', ','),
    },
    { id: 'strenghed', navn: 'Strenghed', pp: F.strenghed * (ms.strenghed - 2), forklaring: 'Grænser, KYC og reklameregler over niveau 2' },
    { id: 'bonusloft', navn: 'Bonusloft', pp: bonusloft ? F.bonusloft : 0, forklaring: bonusloft ? 'Bonusser er loftet — offshore lokker med større' : 'Intet bonusloft' },
    { id: 'selv', navn: 'Selvudelukkede', pp: F.selvudelukkede * ms.selvudelukkede, forklaring: 'Udelukkede spillere, der søger udenom' },
    { id: 'blokering', navn: 'Blokering', pp: -blok, forklaring: blok > 0 ? 'DNS-, betalings- eller leverandørblokering' : 'Ingen blokering' },
    { id: 'kvalitet', navn: 'Licenseret kvalitet', pp: -F.kvalitet * (kval - 0.5), forklaring: `Bedste licenserede produkt: ${Math.round(kval * 100)}/100` },
  ];
  if (Math.abs(regelPp) > 0.001) poster.push({ id: 'regler', navn: 'Regler', pp: regelPp, forklaring: 'Aktive regler, der flytter spil' });
  const sum = offshoreDynPp(g, m);
  const rest = sum - poster.reduce((a, p) => a + p.pp, 0);
  if (Math.abs(rest) > 0.05) poster.push({ id: 'oevrigt', navn: 'Øvrigt', pp: rest, forklaring: 'Andre forhold i modellen' });
  return { poster, sum, trendPp: trendEffekt(g, m).offshorePp };
}

export const OFFSHORE_FAKTOR: Record<Vertical, number> = { kasino: F.kasino, betting: F.betting };

// ---------- Regulering ----------

export type RegelVisning = { id: string; navn: string; beskrivelse: string };

/** Afgiftsstigningens størrelse trækkes, når den varsles (3-8 pp); gamle gemte spil kan mangle tallet */
const AFGIFT_PP_INTERVAL = '3-8';

/**
 * Regelbeskrivelse med den præcise afgiftsstigning ("afgiften stiger 6 pp"), når tallet kendes fra signalet eller
 * planlagteRegler. regelBeskrivelse() viser kun standardværdien fra REGLER.
 */
export function regelBeskrivelseMedPp(regelId: string, pp?: number): string {
  const r = REGLER[regelId];
  if (!r || regelId !== 'afgiftsstigning') return regelBeskrivelse(regelId);
  return `${r.beskrivelse} (afgiften stiger ${pp ?? AFGIFT_PP_INTERVAL} pp)`;
}

const fortegnPp = (pp: number) => `${pp > 0 ? '+' : pp < 0 ? '−' : ''}${String(Math.round(Math.abs(pp) * 10) / 10).replace('.', ',')} pp`;

export function aktiveRegler(g: GameState, m: MarketId): RegelVisning[] {
  const ms = g.markeder[m];
  return ms.regler.map((id) => ({
    id,
    navn: REGLER[id]?.navn ?? id,
    // Afgiftsstigninger kan komme flere gange: vis det samlede tillæg i stedet for standardværdien
    beskrivelse:
      id === 'afgiftsstigning' && ms.afgiftTillaeg > 0
        ? `${REGLER[id].beskrivelse} (afgiftstillæg i alt ${fortegnPp(ms.afgiftTillaeg)} oven i den faste afgift)`
        : regelBeskrivelse(id),
  }));
}

/** tal: kort ændring til en chip ("+6 pp" eller "20 % → 28 %") */
export type KommendeRegel = RegelVisning & { uge: number; ugerTil: number; dynamisk: boolean; tal?: string; op?: boolean };

export function kommendeRegler(g: GameState, m: MarketId): KommendeRegel[] {
  const regler: KommendeRegel[] = (g.planlagteRegler ?? [])
    .filter((p) => p.marked === m)
    .map((p, i) => {
      const pp = p.regelId === 'afgiftsstigning' ? p.pp : undefined;
      return {
        id: `${p.regelId}-${p.ikrafttraedelseUge}-${i}`,
        navn: REGLER[p.regelId]?.navn ?? p.regelId,
        beskrivelse: regelBeskrivelseMedPp(p.regelId, pp),
        uge: p.ikrafttraedelseUge,
        ugerTil: Math.max(0, p.ikrafttraedelseUge - g.uge),
        dynamisk: !!p.dynamisk,
        ...(pp !== undefined ? { tal: fortegnPp(pp), op: pp > 0 } : {}),
      };
    });
  return [...regler, ...kommendeAfgifter(g, m)].sort((a, b) => a.uge - b.uge);
}

const afgiftPct = (x: number) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');

/**
 * Faste afgiftstrin i markedets tidsplan (MARKETS[m].afgift) inden for horisonten, med dato og fra → til.
 * Som i sim-kernen (afgiftsTrin i src/sim/markets.ts) tæller kun trin, hvor markedet er åbent.
 */
export function kommendeAfgifter(g: GameState, m: MarketId, horisont = 104): KommendeRegel[] {
  const def = MARKETS[m];
  const skift = new Map<number, { v: Vertical; fra: number; til: number }[]>();
  for (const v of VERTIKALER) {
    const trin = def.afgift[v];
    for (let i = 1; i < trin.length; i++) {
      const [uge, til] = trin[i];
      if (uge <= g.uge || uge - g.uge > horisont || !markedAabent(m, uge)) continue;
      skift.set(uge, [...(skift.get(uge) ?? []), { v, fra: trin[i - 1][1], til }]);
    }
  }
  const grundlag = def.afgiftModel === 'indsats' ? 'af indsatsen' : 'af BSI';
  return [...skift.entries()].map(([uge, s]) => {
    const ens = s.length === VERTIKALER.length && s.every((x) => x.fra === s[0].fra && x.til === s[0].til);
    const op = s.some((x) => x.til > x.fra);
    const hvad = ens ? 'Afgiften' : s.map((x) => `${VERTICALS[x.v].kort.toLowerCase()}-afgiften`).join(' og ').replace(/^./, (c) => c.toUpperCase());
    const tal = ens ? `fra ${afgiftPct(s[0].fra)} til ${afgiftPct(s[0].til)}` : s.map((x) => `${afgiftPct(x.fra)} → ${afgiftPct(x.til)}`).join(', ');
    return {
      id: `afgift-${uge}`,
      navn: op ? 'Afgiftsstigning' : 'Afgiftsændring',
      beskrivelse: `${hvad} ${op ? 'stiger' : 'ændres'} ${tal} ${grundlag}.`,
      uge,
      ugerTil: uge - g.uge,
      dynamisk: false,
      tal: ens ? `${afgiftPct(s[0].fra)} → ${afgiftPct(s[0].til)}` : s.map((x) => `${VERTICALS[x.v].kort.charAt(0)} ${afgiftPct(x.fra)} → ${afgiftPct(x.til)}`).join(' · '),
      op,
    };
  });
}

// ---------- Politisk pres: hvor kom det fra? ----------

export type PresPost = { uge: number; kilde: string; delta: number };

/** De seneste ændringer i det politiske pres (ms.presLog, højst seks), nyeste først */
export function presHistorik(g: GameState, m: MarketId): PresPost[] {
  return [...(g.markeder[m].presLog ?? [])].sort((a, b) => b.uge - a.uge);
}

/** "Hvorfor presset steg", "Hvorfor presset faldt" eller begge dele */
export function presOverskrift(poster: PresPost[]): string {
  const op = poster.some((p) => p.delta > 0);
  const ned = poster.some((p) => p.delta < 0);
  return op && ned ? 'Hvorfor presset steg og faldt' : ned ? 'Hvorfor presset faldt' : 'Hvorfor presset steg';
}

/** "+1", "+0,25", "−0,5" */
export function presDeltaTekst(d: number): string {
  return `${d > 0 ? '+' : '−'}${String(Math.round(Math.abs(d) * 100) / 100).replace('.', ',')}`;
}

export const PRES_TAERSKEL = DYNAMISK.presTaerskel;
/** Presset efter en ny regel er vedtaget */
export const PRES_EFTER = DYNAMISK.presEfter;

/** Jeres aggressivitet (samme indeks som kvartalsPres): bonus + VIP + aggressive kanaler i brug */
export function aggressivitet(g: GameState): number {
  return g.bonusNiveau + g.vipProgram + CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (g.marketingMix[k] ?? 0) > 0).length;
}

export type BlokeringVisning = { id: 'dns' | 'betaling' | 'leverandoer'; navn: string; aktiv: boolean; fraUge: number | null; pp: number; note: string };

export function blokeringer(g: GameState, m: MarketId): BlokeringVisning[] {
  const b = g.markeder[m].blokering;
  const dnsAktiv = b.dns !== null && g.uge >= b.dns;
  const dnsGammel = dnsAktiv && g.uge - (b.dns ?? 0) >= 104;
  return [
    {
      id: 'dns',
      navn: 'DNS-blokering',
      aktiv: dnsAktiv,
      fraUge: b.dns,
      pp: dnsAktiv ? (dnsGammel ? F.dns / 2 : F.dns) : 0,
      note: dnsGammel ? 'Spillerne har lært at gå udenom: halv effekt' : 'Ulovlige sider blokeres i netværket',
    },
    { id: 'betaling', navn: 'Betalingsblokering', aktiv: b.betaling !== null && g.uge >= b.betaling, fraUge: b.betaling, pp: b.betaling !== null && g.uge >= b.betaling ? F.betaling : 0, note: 'Bankerne afviser betalinger til ulovlige sider' },
    { id: 'leverandoer', navn: 'Leverandøransvar', aktiv: b.leverandoer, fraUge: null, pp: b.leverandoer ? F.leverandoer : 0, note: 'Spiludviklere må ikke levere til ulovlige sider' },
  ];
}

export function kanaliseringsMaal(m: MarketId): number | undefined {
  return KANALISERINGSMAAL[m];
}

// ---------- Tilsynstillid og sanktioner ----------

export const SANKTION_TRIN: { trin: 1 | 2 | 3 | 4; navn: string; graense: number; konsekvens: string; farve: string }[] = [
  { trin: 1, navn: 'Påbud', graense: sanktionsGraense(1), konsekvens: 'Et brev og 50 t. kr. til at stramme op', farve: T.warn },
  { trin: 2, navn: 'Bøde', graense: sanktionsGraense(2), konsekvens: '4 % af årets BSI i markedet (mindst 0,2 mio.) og −3 omdømme', farve: '#ff8a5c' },
  { trin: 3, navn: 'Gennemgang', graense: sanktionsGraense(3), konsekvens: 'Licensen suspenderes i 8 uger, −5 omdømme', farve: T.bad },
  { trin: 4, navn: 'Inddragelse', graense: sanktionsGraense(4), konsekvens: 'Licensen er væk for altid', farve: '#c23b3b' },
];

export const DK_SMITTE = TRUST.dkLicensTabSmitte;

// ---------- Marketing på tværs af markeder ----------

/** Forventede nye kunder pr. uge fra én kanal, fordelt på aktive markeder (spejler kanalTilgang + fordeling på vertikaler) */
export function kanalKunder(g: GameState, k: AcqChannel, spend = g.marketingMix[k] ?? 0): { total: number; prMarked: Partial<Record<MarketId, number>> } {
  const ud: { total: number; prMarked: Partial<Record<MarketId, number>> } = { total: 0, prMarked: {} };
  if (k === 'crm' || spend <= 0 || !kanalTilgaengelig(g, k)) return ud;
  const markeder = aktiveMarkeder(g);
  const vaegte = markeder.map((m) => markedsKunder(g, m, 'betting') + markedsKunder(g, m, 'kasino'));
  const vaegtSum = vaegte.reduce((a, b) => a + b, 0) || 1;
  markeder.forEach((m, i) => {
    if (regelEffekt(g, m).lukket.includes(k)) return;
    const cac = effektivCac(g, k, m);
    if (!cac) return;
    const s = spend * (vaegte[i] / vaegtSum);
    const effSpend = s / (1 + s / CHANNELS[k].maetning);
    // Samme faktorer som kanalTilgang/ugentligeKunder i sim-kernen: bonus, featurefordel og AI-scenariernes tilgang
    const nye = ((effSpend * 1e6) / cac) * (1 + BONUS_TILGANG[effektivBonus(g, m)]) * (1 + featureFordel(g)) * (1 + aiMarkedsEffekt(g, m).tilgang);
    const ms = g.markeder[m];
    let taeller = 0;
    let naevner = 0;
    for (const v of VERTIKALER) {
      const st = ms.vertikaler[v].status === 'aktiv' ? portefoeljeStyrke(g, m, v) : 0;
      const w = st * markedsKunder(g, m, v);
      naevner += w;
      taeller += w / VERTICALS[v].cacFaktor;
    }
    const n = naevner > 0 ? (nye * taeller) / naevner : 0;
    ud.prMarked[m] = n;
    ud.total += n;
  });
  return ud;
}

/** Markeder med aktiv licens, men uden et lanceret produkt: deres andel af marketingbudgettet giver ingen kunder (som i ugentligeKunder) */
export function spildtBudget(g: GameState): { markeder: MarketId[]; andel: number } {
  const markeder = aktiveMarkeder(g);
  const vaegt = (m: MarketId) => markedsKunder(g, m, 'betting') + markedsKunder(g, m, 'kasino');
  const sum = markeder.reduce((a, m) => a + vaegt(m), 0);
  const tomme = markeder.filter((m) => !VERTIKALER.some((v) => g.markeder[m].vertikaler[v].status === 'aktiv' && spillerProdukter(g, m, v).length > 0));
  return { markeder: tomme, andel: sum > 0 ? tomme.reduce((a, m) => a + vaegt(m), 0) / sum : 0 };
}

/** Navnet på reglen, der lukker en kanal i et marked (null = åben) */
export function lukketAf(g: GameState, m: MarketId, k: AcqChannel): string | null {
  for (const id of g.markeder[m].regler) if (REGLER[id]?.effekt.lukKanal?.includes(k)) return REGLER[id].navn;
  return null;
}

/** Reglen, der lofter bonus eller VIP i et marked (null = intet loft under spillerens niveau) */
export function loftRegel(g: GameState, m: MarketId, hvad: 'bonus' | 'vip'): { niveau: number; regel: string } | null {
  const eff = hvad === 'bonus' ? effektivBonus(g, m) : effektivVip(g, m);
  const valgt = hvad === 'bonus' ? g.bonusNiveau : g.vipProgram;
  if (eff >= valgt) return null;
  const felt = hvad === 'bonus' ? 'bonusMax' : 'vipMax';
  const regel = g.markeder[m].regler.map((id) => REGLER[id]).find((r) => r && r.effekt[felt] !== undefined && r.effekt[felt] === eff);
  return { niveau: eff, regel: regel?.navn ?? 'en regel' };
}

// ---------- Trends ----------

export type TrendVisning = { id: string; titel: string; effekt: string[]; slutUge: number };

export function markedsTrends(g: GameState, m: MarketId): TrendVisning[] {
  const pct = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} %`;
  return (g.trends ?? [])
    .filter((t) => daekker(t, m))
    .map((t) => {
      const e: string[] = [];
      if (t.effekt.bettingBsi) e.push(`${pct(t.effekt.bettingBsi)} betting`);
      if (t.effekt.kasinoBsi) e.push(`${pct(t.effekt.kasinoBsi)} kasino`);
      if (t.effekt.offshorePp) e.push(`${t.effekt.offshorePp > 0 ? '+' : '−'}${Math.abs(t.effekt.offshorePp)} pp offshore`);
      if (t.effekt.marketingRoi) e.push(`${pct(t.effekt.marketingRoi)} marketingeffekt`);
      if (t.effekt.afgiftRisiko) e.push('højere afgiftsrisiko');
      return { id: `${t.id}-${t.startUge}`, titel: t.titel, effekt: e, slutUge: t.slutUge };
    });
}

// ---------- Offshore-brand ----------

/** Forventet grå BSI pr. uge pr. marked (spejler ugentligtOffshoreBrand, uden udfaldsstøj) */
/** Brandets rækkevidde følger firmaets størrelse (samme regel som ugentligtOffshoreBrand i sim-kernen) */
export function offshoreRaekkevidde(g: GameState): { andel: number; kunder: number } {
  const kunder = MARKET_IDS.reduce((a, m) => a + g.markeder[m].spillerKunder.betting + g.markeder[m].spillerKunder.kasino, 0);
  const fuld = OFFSHORE_BRAND.fuldRaekkeviddeKunder ?? 0;
  return { andel: fuld > 0 ? Math.max(0.05, Math.min(1, kunder / fuld)) : 1, kunder };
}

export function offshoreBrandEstimat(g: GameState): { prMarked: Partial<Record<MarketId, number>>; total: number; raekkevidde: number } {
  const egne = g.produkter.filter((p) => p.ejer === 'spiller' && p.aktiv);
  const kvalitet = egne.length ? Math.max(...egne.map((p) => p.kvalitet)) : 0.3;
  const harKasino = egne.some((p) => PRODUCT_TYPES[p.typeId].vertikal === 'kasino');
  const harBetting = egne.some((p) => PRODUCT_TYPES[p.typeId].vertikal === 'betting');
  const aar = aarDecimal(g.uge);
  const r = offshoreRaekkevidde(g).andel;
  const ud: { prMarked: Partial<Record<MarketId, number>>; total: number; raekkevidde: number } = { prMarked: {}, total: 0, raekkevidde: r };
  for (const m of MARKET_IDS) {
    const ms = g.markeder[m];
    let b = 0;
    const graa = GRAA_MARKED[m];
    if (graa) {
      const rest = graaRest(g, m);
      if (harKasino) b += ((kurve(graa.kasino, aar) * 1000) / 52) * OFFSHORE_BRAND.andelGraa * (0.5 + kvalitet) * rest;
      if (harBetting) b += ((kurve(graa.betting, aar) * 1000) / 52) * OFFSHORE_BRAND.andelGraa * (0.5 + kvalitet) * rest;
    } else if (ms.aaben) {
      const st = markedsStoerrelse(g, m);
      if (harKasino) b += (st.kasino.total / 52) * ms.offshore.kasino * OFFSHORE_BRAND.andel * (0.5 + kvalitet);
      if (harBetting) b += (st.betting.total / 52) * ms.offshore.betting * OFFSHORE_BRAND.andel * (0.5 + kvalitet);
    }
    b *= r;
    if (b > 0) {
      ud.prMarked[m] = b;
      ud.total += b;
    }
  }
  return ud;
}

export { OFFSHORE_BRAND };

// ---------- Kortdata ----------

export function kortData(g: GameState): Record<MarketId, KortMarked> {
  const ud = {} as Record<MarketId, KortMarked>;
  for (const m of MARKET_IDS) {
    const status = markedStatus(g, m);
    // Mistet eller suspenderet licens: ingen andel (sim-kernens andel er fra ugen før sanktionen)
    const andel = status === 'inddraget' || status === 'suspenderet' ? 0 : spillerAndel(g, m);
    ud[m] = { status, andel, ny: nyAabnet(g, m), graa: g.offshoreBrand && g.markeder[m].offshoreBrandBsiPrUge > 0, advarsel: tillidsAdvarsel(g, m) };
  }
  return ud;
}
