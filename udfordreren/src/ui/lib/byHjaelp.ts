// Spillerbyen (spec 6.14, fase 5): rene hjælpere til Byen-panelet og bylærredet. Ingen mutation.
// Driverne spejler byDrivere() i src/sim/town.ts led for led, så panelet kan forklare, hvad der trækker mod gul og rød,
// og hvad der hjælper folk tilbage (tests/unit/byHjaelp.test.ts holder dem i takt med sim-kernen).
import type { ByHistorie, GameState, MarketId, TownPerson, TownProfile } from '../../sim/types';
import { BY, PROFIL_NAVN } from '../../data/town';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { CHANNELS, CHANNEL_IDS } from '../../data/acquisition';
import { RESEARCH, type ResearchNode } from '../../data/research';
import { AKTIVE_PROFILER, agentEffekt, aiLabAaben, byArpuFaktor, byTal, byTillid, effektivBonus, effektivVip, forskningsEffekt, forskningStatus, risikoAndel } from '../../sim/selectors';
import { T } from '../../render/palette';

/** Ikonnavn fra kit.tsx (importeres ikke herfra, så hjælperne kan testes uden JSX) */
type IkonNavn = string;

// ---------- Profiler: farve + ikon (aldrig kun farve) ----------

export type AktivProfil = Exclude<TownProfile, 'churnet'>;
export const BY_PROFILER: readonly AktivProfil[] = AKTIVE_PROFILER as AktivProfil[];

/** Gul til risiko — tydeligt mere citron end VIP-guldet (og markøren er en taleboble med udråbstegn, ikke en krone) */
export const RISIKO_GUL = '#f0e64a';

export type ProfilStil = { navn: string; farve: string; markoer: string; beskrivelse: string };

export const PROFIL_STIL: Record<TownProfile, ProfilStil> = {
  rekreativ: { navn: PROFIL_NAVN.rekreativ, farve: T.muted, markoer: 'Ingen markør', beskrivelse: 'Spiller til de store kampe. En lille indsats og en god aften.' },
  engageret: { navn: PROFIL_NAVN.engageret, farve: T.sky, markoer: 'Telefon i hånden', beskrivelse: 'Spiller hver uge og kender jeres app udenad.' },
  vip: { navn: PROFIL_NAVN.vip, farve: T.gold, markoer: 'Krone', beskrivelse: 'Guldkunderne. Få, men de fylder godt i regnskabet.' },
  risiko: { navn: PROFIL_NAVN.risiko, farve: RISIKO_GUL, markoer: 'Udråbstegn', beskrivelse: 'Spiller mere, end de havde tænkt sig.' },
  problem: { navn: PROFIL_NAVN.problem, farve: T.bad, markoer: 'Advarselsskilt', beskrivelse: 'Spiller for mere, end de har råd til.' },
  churnet: { navn: PROFIL_NAVN.churnet, farve: T.dim, markoer: 'Vises ikke', beskrivelse: 'Er ikke kunde længere.' },
};

// ---------- Markeder og kunder ----------

export const erAktiv = (p: TownPerson): boolean => p.profil !== 'churnet';

/** Markeder med mindst én pixelperson (i fast rækkefølge) */
export function byMarkeder(s: GameState): { m: MarketId; aktive: number }[] {
  const n: Partial<Record<MarketId, number>> = {};
  for (const p of s.by) if (erAktiv(p)) n[p.marked] = (n[p.marked] ?? 0) + 1;
  return MARKET_IDS.filter((m) => (n[m] ?? 0) > 0).map((m) => ({ m, aktive: n[m] ?? 0 }));
}

/** Markedet, driverne forklares for: det valgte, ellers det med flest pixelfolk */
export function driverMarked(s: GameState, m?: MarketId): MarketId | null {
  if (m) return m;
  const liste = byMarkeder(s);
  if (!liste.length) return null;
  return liste.reduce((a, b) => (b.aktive > a.aktive ? b : a)).m;
}

export function spillerKunder(s: GameState, m?: MarketId): number {
  const ms = m ? [s.markeder[m]] : Object.values(s.markeder);
  return ms.reduce((a, x) => a + x.spillerKunder.betting + x.spillerKunder.kasino, 0);
}

// ---------- Befolkningen ----------

export type ByOversigt = {
  aktive: number;
  antal: Record<AktivProfil, number>;
  /** Andel af de aktive pr. profil */
  andel: Record<AktivProfil, number>;
  /** Andel af byens samlede værdi (BSI-vægt) pr. profil */
  vaerdiAndel: Record<AktivProfil, number>;
  kunder: number;
  /** Hvor mange rigtige kunder én pixelperson står for */
  kunderPrPerson: number;
};

export function byOversigt(s: GameState, m?: MarketId): ByOversigt {
  const t = byTal(s, m);
  const aktive = BY_PROFILER.reduce((a, p) => a + t[p], 0);
  const antal = {} as Record<AktivProfil, number>;
  const andel = {} as Record<AktivProfil, number>;
  const vaerdiAndel = {} as Record<AktivProfil, number>;
  const vaerdiIalt = BY_PROFILER.reduce((a, p) => a + t[p] * BY.vaerdi[p], 0);
  for (const p of BY_PROFILER) {
    antal[p] = t[p];
    andel[p] = aktive ? t[p] / aktive : 0;
    vaerdiAndel[p] = vaerdiIalt ? (t[p] * BY.vaerdi[p]) / vaerdiIalt : 0;
  }
  const kunder = spillerKunder(s, m);
  return { aktive, antal, andel, vaerdiAndel, kunder, kunderPrPerson: aktive ? kunder / aktive : 0 };
}

// ---------- Risikoandel og kalibrering ----------

export type RisikoNiveau = 'lav' | 'normal' | 'kigger' | 'hoej' | 'pres';
export type RisikoInfo = {
  andel: number | null;
  /** Markedet har for få pixelfolk: tallet er hele byens */
  heleByen: boolean;
  niveau: RisikoNiveau;
  titel: string;
  tekst: string;
  ikon: IkonNavn;
  farve: string;
};

export const NORMAL_FRA = 0.05;
export const NORMAL_TIL = 0.15;
export const TILSYN_FRA = BY.tillidTaerskel;
export const PRES_FRA = BY.presTaerskel;

export function risikoInfo(s: GameState, m?: MarketId): RisikoInfo {
  const andel = risikoAndel(s, m);
  const heleByen = !!m && byTal(s, m).aktive < 8;
  const std = { andel, heleByen };
  if (andel === null) return { ...std, niveau: 'lav', titel: 'Ingen kunder endnu', tekst: 'Byen er tom, så der er intet at måle.', ikon: 'folk', farve: T.muted };
  if (andel < NORMAL_FRA)
    return { ...std, niveau: 'lav', titel: 'Under det normale', tekst: 'Færre i gul og rød end i virkeligheden. Enten er I forsigtige, eller også er byen helt ny.', ikon: 'flueben', farve: T.good };
  if (andel <= TILSYN_FRA)
    return { ...std, niveau: 'normal', titel: 'Helt normalt', tekst: 'Sådan ser en by ud, også hos de pæneste udbydere. Tilsynet trækker ikke i tilliden.', ikon: 'flueben', farve: T.good };
  if (andel <= NORMAL_TIL)
    return { ...std, niveau: 'kigger', titel: 'Tilsynet kigger med', tekst: 'Stadig inden for det normale, men over 8 % koster det lidt tilsynstillid hvert kvartal.', ikon: 'oeje', farve: T.warn };
  if (andel <= PRES_FRA)
    return { ...std, niveau: 'hoej', titel: 'Over det normale', tekst: 'Flere i gul og rød end hos en typisk udbyder. Det koster tillid hvert kvartal.', ikon: 'advarsel', farve: T.bad };
  return { ...std, niveau: 'pres', titel: 'Byen er rød', tekst: 'Over 20 %. Har I en mærkbar markedsandel, begynder politikerne at tale om nye regler.', ikon: 'advarsel', farve: T.bad };
}

// ---------- Drivere: hvad trækker, hvad hjælper ----------

export type DriverLinje = {
  id: string;
  label: string;
  /** Kort talværdi, fx "×1,35" eller "+0,25" */
  vaerdi: string;
  forklaring: string;
  aktiv: boolean;
  ikon: IkonNavn;
  farve: string;
};

export type ByDriverForklaring = {
  marked: MarketId;
  traekker: DriverLinje[];
  hjaelper: DriverLinje[];
  /** Produktet af skadesdriverne (= byDrivere().skade) */
  skade: number;
  /** 1 + summen af beskyttelsen (= byDrivere().beskyttelse) */
  beskyttelse: number;
  /** Samlet tryk mod gul og rød (1 = neutralt) */
  tryk: number;
  /** Beskyttende forskning (ulåst, i gang eller mulig) */
  forskning: { node: ResearchNode; ulaast: boolean; igang: boolean; ok: boolean; grund?: string }[];
};

const gange = (f: number) => `×${f.toFixed(2).replace('.', ',')}`;
const plus = (f: number) => `+${Math.round(f * 100)} %`;

export function snitIntensitet(s: GameState, m: MarketId): { snit: number; produkter: number } {
  const prods = s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m));
  return { snit: prods.length ? prods.reduce((a, p) => a + p.intensitet, 0) / prods.length : 3, produkter: prods.length };
}

export function aggressiveKanaler(s: GameState): string[] {
  return CHANNEL_IDS.filter((k) => CHANNELS[k].aggressiv && (s.marketingMix[k] ?? 0) > 0).map((k) => CHANNELS[k].navn);
}

export const BY_FORSKNING: ResearchNode[] = RESEARCH.filter((n) => (n.effekt.by ?? 0) > 0);

export function byDriverForklaring(s: GameState, m: MarketId): ByDriverForklaring {
  const navn = MARKETS[m].navn;
  const ae = agentEffekt(s);

  // --- Trækker mod gul og rød (ganges sammen) ---
  const ints = snitIntensitet(s, m);
  const fInt = Math.max(0.4, 1 + BY.intensitet * (ints.snit - 3));
  const bonus = effektivBonus(s, m);
  const fBonus = 1 + BY.bonus * bonus;
  const hyper = s.hyperpersonalisering.aktiv;
  const fHyper = hyper ? 1 + (ae.risikoOk ? BY.hyperMedRisiko : BY.hyper) : 1;
  const agg = aggressiveKanaler(s);
  const fAgg = agg.length ? 1 + BY.aggressiv : 1;
  const vip = effektivVip(s, m);
  const loftBonus = bonus < s.bonusNiveau;
  const loftVip = vip < s.vipProgram;

  const traekker: DriverLinje[] = [
    {
      id: 'intensitet',
      label: 'Intensitet',
      vaerdi: gange(fInt),
      forklaring: ints.produkter
        ? `Snit ${ints.snit.toFixed(1).replace('.', ',')} på jeres produkter i ${navn}. Hvert trin over 3 giver +35 % tryk, hvert trin under tager lidt af.`
        : `Ingen produkter i ${navn} endnu. Regnes som normal intensitet (3).`,
      aktiv: fInt > 1.001,
      ikon: 'lyn',
      farve: fInt > 1.001 ? T.bad : fInt < 0.999 ? T.good : T.muted,
    },
    {
      id: 'bonus',
      label: 'Bonus',
      vaerdi: gange(fBonus),
      forklaring: bonus
        ? `Bonusniveau ${bonus}${loftBonus ? ` (loftet af reglerne i ${navn})` : ''}. Flere nye kunder, men +15 % tryk pr. niveau.`
        : loftBonus ? `Reglerne i ${navn} tillader ingen bonus. Så er den ude af regnestykket.` : 'Ingen bonus. Færre nye kunder, men ingen ekstra tryk.',
      aktiv: bonus > 0,
      ikon: 'penge',
      farve: bonus > 0 ? T.bad : T.muted,
    },
    {
      id: 'vip',
      label: 'VIP-program',
      vaerdi: vip ? `niveau ${vip}` : 'fra',
      forklaring: vip
        ? `Fristende: +${Math.round(BY.vipKonvertering * 100 * vip)} % flere engagerede bliver til guld. Prisen: +${Math.round(BY.vipRisiko * 100 * vip)} % flere guldkunder glider mod gul.${loftVip ? ` Loftet af reglerne i ${navn}.` : ''}`
        : 'Intet VIP-program. Færre guldkunder, og de få, der er, glider sjældnere.',
      aktiv: vip > 0,
      ikon: 'krone',
      farve: vip > 0 ? T.bad : T.muted,
    },
    {
      id: 'hyper',
      label: 'Hyperpersonalisering',
      vaerdi: hyper ? gange(fHyper) : 'fra',
      forklaring: hyper
        ? ae.risikoOk
          ? `Tændt: +5-10 % BSI pr. kunde. En risikoagent med høj overvågning holder prisen nede på ${gange(1 + BY.hyperMedRisiko)}.`
          : `Tændt: +5-10 % BSI pr. kunde. Prisen: ${gange(1 + BY.hyper)} tryk mod gul og rød, så længe ingen risikoagent med mindst 60 % overvågning holder øje.`
        : aiLabAaben(s)
          ? `Slukket. Den giver +5-10 % BSI pr. kunde, men ${gange(1 + BY.hyper)} tryk uden en risikoagent med høj overvågning (${gange(1 + BY.hyperMedRisiko)} med).`
          : 'Kommer med AI-akten i 2026.',
      aktiv: hyper,
      ikon: 'chip',
      farve: hyper ? T.bad : T.muted,
    },
    {
      id: 'kanaler',
      label: 'Aggressive kanaler',
      vaerdi: gange(fAgg),
      forklaring: agg.length ? `${agg.join(' og ')} fylder godt, men giver +10 % tryk.` : 'Ingen tv eller streamere i mixet lige nu.',
      aktiv: agg.length > 0,
      ikon: 'hoejttaler',
      farve: agg.length ? T.bad : T.muted,
    },
  ];
  const skade = fInt * fBonus * fHyper * fAgg;

  // --- Hjælper folk tilbage (lægges sammen) ---
  const fe = forskningsEffekt(s).by;
  const antalComp = s.staff.filter((x) => x.rolle === 'compliance').length;
  const comp = Math.min(BY.beskyttelse.complianceMaks, BY.beskyttelse.compliancePrPerson * antalComp);
  const affRegel = s.markeder[m].regler.find((id) => id === 'affordability' || id === 'ukAffordability');
  const aff = affRegel ? BY.beskyttelse.affordabilityRegel : 0;
  const risikoAgenter = s.agenter.filter((a) => a.funktion === 'risiko');
  const selv = s.markeder[m].selvudelukkede;
  const forskning = BY_FORSKNING.map((node) => {
    const st = forskningStatus(s, node);
    return { node, ulaast: s.forskning.ulaast.includes(node.id), igang: s.forskning.igang?.nodeId === node.id, ok: st.ok, grund: st.grund };
  });
  const ulaast = forskning.filter((f) => f.ulaast).length;

  const hjaelper: DriverLinje[] = [
    {
      id: 'forskning',
      label: 'Ansvarsforskning',
      vaerdi: plus(fe),
      forklaring: ulaast
        ? `${ulaast} af ${BY_FORSKNING.length} beskyttende forskningsprojekter er færdige. Færre glider, og flere kommer tilbage fra gul.`
        : 'Ingen endnu. Start med "Ansvarligt spil" i Firma-panelets forskning.',
      aktiv: fe > 0,
      ikon: 'kolbe',
      farve: fe > 0 ? T.good : T.muted,
    },
    {
      id: 'compliance',
      label: 'Compliance-folk',
      vaerdi: plus(comp),
      forklaring: `${antalComp === 1 ? 'Én compliance-medarbejder' : `${antalComp} compliance-medarbejdere`}. +${Math.round(BY.beskyttelse.compliancePrPerson * 100)} % pr. person, højst +${Math.round(BY.beskyttelse.complianceMaks * 100)} %.`,
      aktiv: comp > 0,
      ikon: 'skjold',
      farve: comp > 0 ? T.good : T.muted,
    },
    {
      id: 'affordability',
      label: 'Affordability-regler',
      vaerdi: plus(aff),
      forklaring: affRegel ? `${navn} kræver økonomiske tjek af de største kunder. Det bremser VIP'erne, men hjælper byen.` : `Ingen affordability-regel i ${navn}. Tilsynet kan indføre en, hvis byen bliver rød.`,
      aktiv: aff > 0,
      ikon: 'paragraf',
      farve: aff > 0 ? T.good : T.muted,
    },
    {
      id: 'risikoagent',
      label: 'Risikoagenter',
      vaerdi: plus(ae.byBeskyttelse),
      forklaring: risikoAgenter.length
        ? `${risikoAgenter.length === 1 ? 'Én risikoagent' : `${risikoAgenter.length} risikoagenter`}${ae.risikoOk ? ' med høj overvågning. Den holder også hyperpersonaliseringen i ave.' : '. Skru op for overvågningen (mindst 60 %), så dæmper den også hyperpersonaliseringen.'}`
        : aiLabAaben(s) ? 'Ingen endnu. En risikoagent i AI-laboratoriet finder de tidlige tegn.' : 'Kommer med AI-laboratoriet i 2026.',
      aktiv: ae.byBeskyttelse > 0,
      ikon: 'oeje',
      farve: ae.byBeskyttelse > 0 ? T.good : T.muted,
    },
    {
      id: 'selvudelukkelse',
      label: 'Selvudelukkelse',
      vaerdi: selv > 0 ? gange(1 + selv) : 'intet register',
      forklaring:
        selv > 0
          ? `${navn} har et register for selvudelukkelse. Flere i gul og rød kan melde sig ud i stilhed.`
          : `Intet register i ${navn} endnu. Folk i gul og rød har sværere ved at stoppe helt.`,
      aktiv: selv > 0,
      ikon: 'doer',
      farve: selv > 0 ? T.good : T.muted,
    },
  ];
  const beskyttelse = 1 + fe + comp + aff + ae.byBeskyttelse;
  return { marked: m, traekker, hjaelper, skade, beskyttelse, tryk: skade / beskyttelse, forskning };
}

export function trykTekst(tryk: number): { tekst: string; farve: string; ikon: IkonNavn } {
  if (tryk <= 0.85) return { tekst: 'Byen bliver grønnere', farve: T.good, ikon: 'op' };
  if (tryk <= 1.15) return { tekst: 'Omkring det normale', farve: T.muted, ikon: 'streg' };
  if (tryk <= 1.8) return { tekst: 'Flere glider mod gul', farve: T.warn, ikon: 'ned' };
  return { tekst: 'Byen bliver rød', farve: T.bad, ikon: 'advarsel' };
}

// ---------- Tilsynstillid og penge ----------

export type TillidLinje = { m: MarketId; aktive: number; andel: number | null; tillid: number };

/** Byens tillidspost pr. kvartal i hvert marked med pixelfolk */
export function tillidLinjer(s: GameState): TillidLinje[] {
  return byMarkeder(s).map(({ m, aktive }) => ({ m, aktive, andel: risikoAndel(s, m), tillid: byTillid(s, m) }));
}

export type ArpuInfo = {
  faktor: number;
  /** Gennemsnitsværdi i forhold til en rekreativ kunde */
  snitVaerdi: number;
  /** Andel af folk og af penge fra guld / gul+rød */
  guld: { folk: number; penge: number };
  gulRoed: { folk: number; penge: number };
};

export function arpuInfo(s: GameState, m: MarketId, scope?: MarketId): ArpuInfo {
  const o = byOversigt(s, scope);
  const snitVaerdi = o.aktive ? BY_PROFILER.reduce((a, p) => a + o.antal[p] * BY.vaerdi[p], 0) / o.aktive : 0;
  return {
    faktor: byArpuFaktor(s, m),
    snitVaerdi,
    guld: { folk: o.andel.vip, penge: o.vaerdiAndel.vip },
    gulRoed: { folk: o.andel.risiko + o.andel.problem, penge: o.vaerdiAndel.risiko + o.vaerdiAndel.problem },
  };
}

// ---------- Byhistorier og personer ----------

export function byHistorier(s: GameState, m?: MarketId): ByHistorie[] {
  return m ? s.byHistorier.filter((h) => h.marked === m) : s.byHistorier;
}

export function kundeTid(uger: number): string {
  if (uger < 8) return 'ny kunde';
  if (uger < 52) return `kunde i ${Math.round(uger / 4.33)} måneder`;
  const aar = Math.floor(uger / 52);
  return `kunde i ${aar} år`;
}

/** Kort, respektfuld beskrivelse af en pixelperson (til tryk/hover på lærredet) */
export function personTekst(p: TownPerson): string {
  const st = PROFIL_STIL[p.profil];
  return `${st.navn} · ${MARKETS[p.marked].navn} · ${kundeTid(Math.max(0, p.eksponering))}`;
}
