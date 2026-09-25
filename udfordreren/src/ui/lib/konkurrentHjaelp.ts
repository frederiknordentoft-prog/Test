// Konkurrent- og platformsporet (fase 4): rene hjælpefunktioner til Konkurrenter- og Platform-panelet og
// dialogerne for opkøbstilbud, sponsorauktioner og reaktioner. Ingen mutation — kun afledte værdier.
import type {
  AktivReaktion, Competitor, CompetitorArchetype, GameState, LiveProduct, MarketId, Platform, PlatformKind, PlatformModel, SponsorAuktion,
} from '../../sim/types';
/** Ikonnavn fra kit.tsx (importeres ikke herfra, så hjælperne kan testes uden JSX) */
type IkonNavn = string;
import { COMPETITORS } from '../../data/competitors';
import { R1, R7, R8 } from '../../data/reactionRules';
import { CHANNELS, CHANNEL_IDS } from '../../data/acquisition';
import { MARKETS } from '../../data/markets';
import { B2B, MIGRERING, PLATFORM_KRAV, PLATFORM_MODELS } from '../../data/platforms';
import { SLUTNINGER, type SlutId } from '../../data/endings';
import { aarFor, datoTekst } from '../../sim/time';
import { effektivBonus, effektivVip, ejerInfo, r12Aktiv } from '../../sim/selectors';

// ---------- Konkurrenter ----------

export const ARKETYPE: Record<CompetitorArchetype, { navn: string; tekst: string; ikon: IkonNavn }> = {
  globalGigant: { navn: 'Global gigant', tekst: 'Stor, rig og overalt. Starter gerne en bonuskrig, hvis nogen vokser for hurtigt.', ikon: 'globus' },
  nordiskLicensgruppe: { navn: 'Nordisk licensgruppe', tekst: 'Licenser i mange lande og god til at kopiere det, der virker.', ikon: 'kort' },
  statsselskab: { navn: 'Statsselskab', tekst: 'Stærk hjemmebane, høj compliance og ikke til salg.', ikon: 'skjold' },
  lokalSpecialist: { navn: 'Lokal specialist', tekst: 'Kender sit marked ud og ind, men rejser sjældent.', ikon: 'hus' },
  appFirst: { navn: 'App-first', tekst: 'Lækker app, højt tempo — og byder højest på sponsorater.', ikon: 'raket' },
  b2bBygget: { navn: 'B2B-bygget', tekst: 'Lever af at sælge sin platform til andre.', ikon: 'tandhjul' },
  offshore: { navn: 'Offshore', tekst: 'Uden licens og uden bremser.', ikon: 'advarsel' },
  predictionMarket: { navn: 'Prediction market', tekst: 'Kalder væddemål for kontrakter og spiller efter andre regler.', ikon: 'trend' },
  aiNative: { navn: 'AI-native', tekst: 'Agenter i stedet for ansatte. Kopierer lynhurtigt.', ikon: 'lyn' },
};

/** De fem parametre (1-5) med ikon + farve */
export const EVNER = [
  { id: 'styrke', navn: 'Styrke', kort: 'Styrke', ikon: 'lyn', farve: 'var(--color-violet)' },
  { id: 'aggressivitet', navn: 'Aggressivitet', kort: 'Aggr.', ikon: 'hype', farve: 'var(--color-bad)' },
  { id: 'innovation', navn: 'Innovation', kort: 'Innov.', ikon: 'kolbe', farve: 'var(--color-cyan)' },
  { id: 'opkoebslyst', navn: 'Opkøbslyst', kort: 'Opkøb', ikon: 'penge', farve: 'var(--color-gold)' },
  { id: 'compliance', navn: 'Compliance', kort: 'Compl.', ikon: 'skjold', farve: 'var(--color-good)' },
] as const satisfies readonly { id: keyof Competitor; navn: string; kort: string; ikon: IkonNavn; farve: string }[];

const FRA_UGE: Record<string, number> = Object.fromEntries(COMPETITORS.map((c) => [c.id, c.fraUge]));

export type KonkurrentStatus = { kind: 'aktiv' | 'ejet' | 'opkoebt' | 'forladt' | 'kommer'; tekst: string; ikon: IkonNavn; farve: string };

export function konkurrentStatus(s: GameState, c: Competitor): KonkurrentStatus {
  if (c.ejetAf === 'spiller') return { kind: 'opkoebt', tekst: `Købt af ${s.firmaNavn}`, ikon: 'trofae', farve: 'var(--color-gold)' };
  if (c.ejetAf) {
    const ejer = ejerInfo(s, c.ejetAf).navn;
    return c.tilstede
      ? { kind: 'ejet', tekst: `Ejet af ${ejer}`, ikon: 'firma', farve: 'var(--color-sky)' }
      : { kind: 'opkoebt', tekst: `Opkøbt af ${ejer}`, ikon: 'firma', farve: 'var(--color-muted)' };
  }
  if (!c.tilstede && (FRA_UGE[c.id] ?? 0) > s.uge) return { kind: 'kommer', tekst: `Dukker op i ${aarFor(FRA_UGE[c.id])}`, ikon: 'ur', farve: 'var(--color-muted)' };
  if (!c.tilstede) return { kind: 'forladt', tekst: 'Har forladt markedet', ikon: 'doer', farve: 'var(--color-muted)' };
  return { kind: 'aktiv', tekst: 'Aktiv', ikon: 'flueben', farve: 'var(--color-good)' };
}

/** Kan konkurrenten overhovedet købes (bortset fra prisen)? Samme regler som opkoebStatus */
export function tilSalg(c: Competitor): boolean {
  return c.tilstede && !c.ejetAf && c.arketype !== 'statsselskab' && c.arketype !== 'globalGigant' && c.styrke <= 3.5;
}

const START_HANDLING = 'Aktiv i Danmark fra dag ét.';

/** "Hvad de gjorde sidst" — startteksten gøres præcis for konkurrenter uden for Danmark */
export function sidsteTekst(s: GameState, c: Competitor): string {
  if (c.sidsteHandling !== START_HANDLING || c.markeder.includes('dk')) return c.sidsteHandling;
  const aabne = c.markeder.filter((m) => s.markeder[m].aaben);
  const navne = (l: MarketId[]) => l.map((m) => MARKETS[m].navn).join(', ');
  return aabne.length ? `Aktiv i ${navne(aabne)} fra dag ét.` : `Venter på, at ${navne(c.markeder)} åbner for licenser.`;
}

/** Konkurrentens bedste aktive produkt (højeste kvalitet) */
export function bedsteProdukt(s: GameState, competitorId: string): LiveProduct | null {
  let bedst: LiveProduct | null = null;
  for (const p of s.produkter) if (p.aktiv && p.ejer === competitorId && (!bedst || p.kvalitet > bedst.kvalitet)) bedst = p;
  return bedst;
}

export function antalAktiveProdukter(s: GameState, competitorId: string): number {
  return s.produkter.filter((p) => p.aktiv && p.ejer === competitorId).length;
}

/** Markeder, hvor spilleren har eller søger licens */
export function spillerensMarkeder(s: GameState): MarketId[] {
  return (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].aaben && (s.markeder[m].licens === 'aktiv' || s.markeder[m].licens === 'ansoegt' || s.markeder[m].licens === 'suspenderet'));
}

/** Konkurrentens samlede andel i et sæt markeder (gennemsnit, vægtet ens) — til sortering */
export function andelI(s: GameState, c: Competitor, markeder: readonly MarketId[]): number {
  let sum = 0;
  for (const m of markeder) sum += s.markeder[m].andele[c.id] ?? 0;
  return sum;
}

// ---------- Reaktioner ----------

/** Aktive (ikke udløbne) reaktioner, eventuelt kun fra én konkurrent */
export function aktiveReaktioner(s: GameState, competitorId?: string): AktivReaktion[] {
  return s.reaktioner
    .filter((r) => r.slutUge > s.uge && (competitorId === undefined || r.competitorId === competitorId))
    .sort((a, b) => a.slutUge - b.slutUge);
}

export type EffektLinje = { tekst: string; tone: 'god' | 'skidt' | 'neutral'; ikon: IkonNavn };

const x = (v: number) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Reaktionens effekt som korte linjer (ikon + tone, aldrig kun farve) */
export function reaktionEffekter(r: AktivReaktion): EffektLinje[] {
  const ud: EffektLinje[] = [];
  const hvor = r.marked ? ` i ${MARKETS[r.marked].navn}` : '';
  if (r.effekt.cacSpiller) ud.push({ tekst: `Jeres CAC +${Math.round(r.effekt.cacSpiller * 100)} %${hvor}`, tone: 'skidt', ikon: 'ned' });
  if (r.effekt.marketingMult !== undefined && r.effekt.marketingMult > 1) ud.push({ tekst: `Deres marketing ×${x(r.effekt.marketingMult)}${hvor}`, tone: 'skidt', ikon: 'hype' });
  if (r.effekt.marketingMult !== undefined && r.effekt.marketingMult < 1) ud.push({ tekst: `Deres marketing −${Math.round((1 - r.effekt.marketingMult) * 100)} %${hvor}`, tone: 'god', ikon: 'op' });
  if (r.effekt.aggressivitet) ud.push({ tekst: `Aggressivitet +${r.effekt.aggressivitet} (mere marketing og højere bud)`, tone: 'skidt', ikon: 'hype' });
  if (r.regel === 'R7') ud.push({ tekst: `Sponsorat${hvor}`, tone: r.competitorId ? 'neutral' : 'god', ikon: 'bold' });
  return ud;
}

/** Rammer reaktionen spilleren? (CAC-tillæg, mere pres i et af jeres markeder, afvist tilbud) */
export function rammerSpilleren(s: GameState, r: AktivReaktion): boolean {
  if (r.effekt.cacSpiller || r.effekt.aggressivitet) return true;
  if (r.effekt.marketingMult === undefined) return false;
  if (!r.marked) return true;
  return spillerensMarkeder(s).includes(r.marked);
}

export function ugerTilbage(s: GameState, uge: number): number {
  return Math.max(0, uge - s.uge);
}

/** "til mar. 2017 · 38 uger" */
export function udloebTekst(s: GameState, uge: number): string {
  const n = ugerTilbage(s, uge);
  return `til ${datoTekst(uge)} · ${n} uge${n === 1 ? '' : 'r'}`;
}

/** Markeder med bonuskrig (R1) og CAC-tillægget dér */
export function bonuskrige(s: GameState): { marked: MarketId; tillaeg: number; slutUge: number; competitorId?: string }[] {
  return s.reaktioner
    .filter((r) => r.regel === 'R1' && r.slutUge > s.uge && r.marked && r.effekt.cacSpiller)
    .map((r) => ({ marked: r.marked!, tillaeg: r.effekt.cacSpiller ?? R1.cac, slutUge: r.slutUge, competitorId: r.competitorId }));
}

/** Spillerens aggressivitetsindeks i et marked (samme opskrift som R8 i sim-kernen), med dele til forklaring */
export function aggressionsIndeks(s: GameState, m: MarketId): { total: number; taerskel: number; dele: { navn: string; v: number }[] } {
  const kanaler = CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0);
  const hoej = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && p.intensitet > 3) ? 1 : 0;
  const hyper = s.hyperpersonalisering.aktiv && !r12Aktiv(s) ? 2 : 0;
  const dele = [
    { navn: 'Bonus', v: effektivBonus(s, m) },
    { navn: 'VIP', v: effektivVip(s, m) },
    { navn: kanaler.length ? `Aggressive kanaler (${kanaler.map((k) => CHANNELS[k].navn.toLowerCase()).join(', ')})` : 'Aggressive kanaler', v: kanaler.length },
    { navn: 'Høj intensitet (4-5)', v: hoej },
    { navn: 'Hyperpersonalisering', v: hyper },
  ];
  return { total: dele.reduce((a, d) => a + d.v, 0), taerskel: R8.taerskel, dele };
}

// ---------- Sponsorater ----------

export const SPONSOR_RABAT = R7.cacRabat; // på sponsorat og tv i markedet
export const SPONSOR_RABAT_OEVRIGE = R7.cacRabat / 3; // på de øvrige kanaler (sim: sponsorRabat / 3)

/** Højeste bud pr. år, kassen tillader (samme grænse som bydSponsorat) */
export function sponsorMaxBud(s: GameState, a: SponsorAuktion): number {
  return (s.kapital * 3 + 5) / (a.varighedUger / 52);
}

/** Sandsynlige medbydere: konkurrenter i markedet, der ikke er statsselskaber (app-first først) */
export function sponsorBydere(s: GameState, a: SponsorAuktion): Competitor[] {
  return s.konkurrenter
    .filter((c) => c.tilstede && c.markeder.includes(a.marked) && c.arketype !== 'statsselskab')
    .sort((x1, x2) => (x2.arketype === 'appFirst' ? 1 : 0) - (x1.arketype === 'appFirst' ? 1 : 0) || x2.aggressivitet - x1.aggressivitet);
}

// ---------- Opkøbstilbud ----------

export function tilbudSlutning(competitorId: string): { id: SlutId; titel: string; tekst: string } {
  const id: SlutId = competitorId === 'danskeLykke' ? 'danskeLykke' : 'exit';
  return { id, titel: SLUTNINGER[id].titel, tekst: SLUTNINGER[id].tekst };
}

export function stifterAndel(s: GameState, pris: number): number {
  return Math.round(pris * s.investorer.ejerandelStiftere * 10) / 10;
}

// ---------- Platforme ----------

export const MODEL_RAEKKE: PlatformModel[] = ['whiteLabel', 'turnkey', 'hybrid', 'egen'];

export const KIND_IKON: Record<PlatformKind, IkonNavn> = { kontoplatform: 'folk', sportsbook: 'bold', kasinoplatform: 'terning' };

export const KIND_ROLLE: Record<PlatformKind, string> = {
  kontoplatform: 'Konti, betalinger og KYC. Tæller halvt i revenue share på begge vertikaler og bestemmer dataejerskabet.',
  sportsbook: 'Odds og væddemål. Tæller halvt i revenue share på betting.',
  kasinoplatform: 'Spilautomater og live-borde. Tæller halvt i revenue share på kasino.',
};

/** Migreringstid som venlig tekst: "Straks", "6-12 mdr.", "ca. 3 år" */
export function migreringsTid(uger: readonly [number, number]): string {
  const [lo, hi] = uger;
  if (hi === 0) return 'Straks';
  if (lo === hi) return lo % 52 === 0 ? `ca. ${lo / 52} år` : `ca. ${Math.round(lo / 4.33)} mdr.`;
  if (lo >= 52 && lo % 52 === 0 && hi % 52 === 0) return `${lo / 52}-${hi / 52} år`;
  return `${Math.round(lo / 4.33)}-${Math.round(hi / 4.33)} mdr.`;
}

/** Fremdrift for en igangværende migrering */
export function migreringFremdrift(s: GameState, p: Platform): { andel: number; gaaet: number; ialt: number; tilbage: number } | null {
  if (!p.migrererTil || p.migreringStartUge === null || p.migreringFaerdigUge === null) return null;
  const ialt = Math.max(1, p.migreringFaerdigUge - p.migreringStartUge);
  const gaaet = Math.max(0, Math.min(ialt, s.uge - p.migreringStartUge));
  return { andel: gaaet / ialt, gaaet, ialt, tilbage: ialt - gaaet };
}

export function afbrydRefusion(p: Platform): number {
  return p.migrererTil ? PLATFORM_MODELS[p.migrererTil].capex * MIGRERING.afbrydRefusion : 0;
}

/** Ugentlig B2B-indtægt fra én platform (samme formel som sim-kernen) */
export function b2bIndtaegt(p: Platform): number {
  return p.model === 'egen' && p.b2bKunder > 0 ? p.b2bKunder * B2B.indtaegtPrKundePrUge * (p.kvalitet / 100) : 0;
}

export function udviklerKrav(model: PlatformModel): number {
  return model === 'whiteLabel' ? 0 : PLATFORM_KRAV[model].udviklere;
}

/** Hvad sker der med kvalitet og B2B, hvis man skifter fra nuværende model til en anden? */
export function skiftKonsekvenser(p: Platform, model: PlatformModel): EffektLinje[] {
  const fra = MODEL_RAEKKE.indexOf(p.model);
  const til = MODEL_RAEKKE.indexOf(model);
  const def = PLATFORM_MODELS[model];
  const ud: EffektLinje[] = [];
  if (til > fra) {
    ud.push({ tekst: `Kvalitetsloft ${def.kvalitetsloft} (nu ${PLATFORM_MODELS[p.model].kvalitetsloft}). Starter på ${Math.round(def.kvalitetsloft * MIGRERING.startKvalitet)} og vokser mod loftet.`, tone: 'god', ikon: 'op' });
  } else {
    ud.push({ tekst: `Kvaliteten falder til højst ${def.kvalitetsloft}.`, tone: 'skidt', ikon: 'ned' });
  }
  ud.push({
    tekst: `Revenue share ${Math.round(def.revenueShare * 100)} % (nu ${Math.round(PLATFORM_MODELS[p.model].revenueShare * 100)} %)`,
    tone: def.revenueShare < PLATFORM_MODELS[p.model].revenueShare ? 'god' : def.revenueShare > PLATFORM_MODELS[p.model].revenueShare ? 'skidt' : 'neutral',
    ikon: 'penge',
  });
  ud.push({
    tekst: `Dataejerskab ${x(def.dataejerskab)} (nu ${x(p.dataejerskab)})`,
    tone: def.dataejerskab > p.dataejerskab ? 'god' : def.dataejerskab < p.dataejerskab ? 'skidt' : 'neutral',
    ikon: 'indsigt',
  });
  if (p.model === 'egen' && model !== 'egen' && p.b2bKunder > 0) ud.push({ tekst: `I mister jeres ${p.b2bKunder} B2B-kunder.`, tone: 'skidt', ikon: 'kryds' });
  if (def.uger[1] > 0) {
    ud.push({
      tekst: `Under migreringen er kvaliteten ${Math.round((1 - MIGRERING.kvalitetUnder) * 100)} % lavere, og der er ${Math.round(MIGRERING.nedbrudPrUge * 100)} % risiko pr. uge for et nedbrud, der koster ${Math.round(-MIGRERING.nedbrudKunder * 100)} % af kunderne.`,
      tone: 'skidt',
      ikon: 'advarsel',
    });
  }
  return ud;
}
