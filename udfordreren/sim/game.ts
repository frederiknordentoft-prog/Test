// Kør ét spil med én bot og saml nøgletal til harnesset (spec 8). Ren og deterministisk.
import type { AcqChannel, GameState, MarketId, PlatformModel, ProductTypeId, Vertical } from '../src/sim/types';
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import { applyActionMut } from '../src/sim/actions';
import { makeRng } from '../src/sim/rng';
import { ugenPauser } from '../src/sim/signals';
import { aarFor, AI_AKT_UGE, SIDSTE_UGE } from '../src/sim/time';
import { vaerdiansaettelse } from '../src/sim/investors';
import { eftermaele } from '../src/sim/endings';
import { effektivCac } from '../src/sim/customers';
import { minBudgetUge } from '../src/sim/projects';
import { MARKETS } from '../src/data/markets';
import { VERTICALS } from '../src/data/verticals';
import { CHANNEL_IDS } from '../src/data/acquisition';
import type { Bot } from './bots/types';
import { lavBot, BALANCERET, GRAADIG, FORSIGTIG, AI_AFVISER, AI_HENSYNSLOES } from './bots/strategi';
import { lavTilfaeldigBot } from './bots/random';
import { passivBot } from './bots/passive';

/** Gennemsnitlig tid, et menneske bruger på en beslutningspause (spec 8: 2-3 timer i alt) [D] */
export const BESLUTNING_SEK = 15;

export const BOT_NAVNE = ['Grådig', 'Forsigtig', 'Balanceret', 'AI-afviser', 'AI-hensynsløs', 'Tilfældig'] as const;
export type BotNavn = (typeof BOT_NAVNE)[number] | 'Passiv';

export function lavBotAf(navn: BotNavn, seed: number): Bot {
  switch (navn) {
    case 'Grådig': return lavBot(GRAADIG);
    case 'Forsigtig': return lavBot(FORSIGTIG);
    case 'Balanceret': return lavBot(BALANCERET);
    case 'AI-afviser': return lavBot(AI_AFVISER);
    case 'AI-hensynsløs': return lavBot(AI_HENSYNSLOES);
    case 'Tilfældig': return lavTilfaeldigBot(seed);
    case 'Passiv': return passivBot;
  }
}

export type SpilResultat = {
  bot: BotNavn;
  seed: number;
  vertikal: Vertical;
  slut: string;
  slutAar: number;
  vaerdi: number;
  stifterVaerdi: number;
  eftermaele: number;
  bsiPrAar: Record<number, number>;
  vaerdiPrAar: Record<number, number>;
  boeder: number;
  paabud: number;
  dkLicens2035: boolean;
  overlevede: boolean;
  reaktioner: Record<string, number>;
  scenarier: string[];
  // Indhold med positivt afkast (spec 8, assertion 7)
  typerPositive: ProductTypeId[];
  kanalerPositive: AcqChannel[];
  platformePositive: PlatformModel[];
  markederPositive: MarketId[];
  // Rytme (Balanceret)
  foersteLanceringUge: number | null;
  lanceringer: number;
  realSek: number;
  foersteTop10: number | null;
  foersteGuldkupon: number | null;
  foersteNr1Dk: number | null;
  foersteHof: number | null;
  gallapriser: number;
  dkAndel2020: number;
  // Pacing
  pauser: number;
  pauserAkt2: number;
  // Kalibrering (Passiv)
  kal: { dk2024: number; se2025: number; se2025kasino: number; se2025betting: number; nl2025: number; on2025: number; dkKasinoBsi2025: number; dlNr1Til2025: boolean };
};

export function koerSpil(navn: BotNavn, seed: number, tilUge = SIDSTE_UGE): SpilResultat {
  const vertikal: Vertical = seed % 2 ? 'betting' : 'kasino';
  const s: GameState = newGame({ seed, firmaNavn: 'Bot', stiftere: vertikal === 'betting' ? ['oddssaetteren', 'udvikleren'] : ['kasinodesigneren', 'udvikleren'], startVertikal: vertikal, tutorial: false });
  const bot = lavBotAf(navn, seed);
  const r: SpilResultat = {
    bot: navn, seed, vertikal, slut: '', slutAar: 0, vaerdi: 0, stifterVaerdi: 0, eftermaele: 0, bsiPrAar: {}, vaerdiPrAar: {}, boeder: 0, paabud: 0,
    dkLicens2035: false, overlevede: false, reaktioner: {}, scenarier: [], typerPositive: [], kanalerPositive: [], platformePositive: [], markederPositive: [],
    foersteLanceringUge: null, lanceringer: 0, realSek: 0, foersteTop10: null, foersteGuldkupon: null, foersteNr1Dk: null, foersteHof: null, gallapriser: 0, dkAndel2020: 0,
    pauser: 0, pauserAkt2: 0,
    kal: { dk2024: 0, se2025: 0, se2025kasino: 0, se2025betting: 0, nl2025: 0, on2025: 0, dkKasinoBsi2025: 0, dlNr1Til2025: true },
  };
  const kanaler = new Set<AcqChannel>();
  const platforme = new Set<PlatformModel>();
  const markeder = new Set<MarketId>();
  let kvartalResultat = 0;
  while (!s.slut && s.uge < tilUge) {
    // Passiv måler markedet uden spillerpåvirkning: firmaet holdes i live uden at gøre noget
    if (navn === 'Passiv') {
      s.kapital = Math.max(s.kapital, 5);
      s.negativUger = 0;
    }
    // Handlinger udføres mens spillet står stille (som i UI'et): dialoger fra dem hører til den aktuelle pause
    for (const a of bot.beslut(s)) applyActionMut(s, makeRng(s.rngState), a);
    stepMut(s, []);
    const aar = aarFor(s.uge);
    r.bsiPrAar[aar] = (r.bsiPrAar[aar] ?? 0) + s.regnskab.bsi;
    kvartalResultat += s.regnskab.resultat;
    r.realSek += s.uge >= AI_AKT_UGE ? 6 : 3;
    if (ugenPauser(s.signaler)) {
      r.pauser += 1;
      r.realSek += BESLUTNING_SEK;
      if (s.uge >= AI_AKT_UGE) r.pauserAkt2 += 1;
    }
    for (const sig of s.signaler) {
      if (sig.k === 'sanktion') {
        if (sig.trin >= 2) r.boeder += 1;
        else r.paabud += 1;
      }
      if (sig.k === 'reaktion' && sig.regel === 'R8') r.paabud += 1;
    }
    // Indhold i brug med positivt afkast: kanaler med CAC under kundens værdi, platforme og markeder i overskud
    if (s.uge % 13 === 0) {
      if (kvartalResultat > 0) for (const k of ['kontoplatform', 'sportsbook', 'kasinoplatform'] as const) platforme.add(s.platforme[k].model);
      kvartalResultat = 0;
      for (const k of CHANNEL_IDS) {
        if ((s.marketingMix[k] ?? 0) <= 0) continue;
        // CRM skaffer ikke nye kunder, men holder på dem: positivt, når der er kunder at holde på
        if (k === 'crm') {
          if (Object.values(s.markeder).some((m) => m.spillerKunder.betting + m.spillerKunder.kasino > 1000)) kanaler.add(k);
          continue;
        }
        for (const m of Object.keys(s.markeder) as MarketId[]) {
          if (s.markeder[m].licens !== 'aktiv') continue;
          const cac = effektivCac(s, k, m);
          const v: Vertical = s.markeder[m].vertikaler.kasino.status === 'aktiv' ? 'kasino' : 'betting';
          const ltv = (MARKETS[m].arpu[v] / (VERTICALS[v].churnPrUge * 52)) * 0.35;
          if (cac && cac < ltv) kanaler.add(k);
        }
      }
      for (const m of Object.keys(s.markeder) as MarketId[]) {
        const ms = s.markeder[m];
        const bsi = ms.spillerBsiPrUge.betting + ms.spillerBsiPrUge.kasino;
        if (ms.licens === 'aktiv' && bsi * (1 - ms.afgift - 0.3) > 0.001) markeder.add(m);
      }
    }
    if (s.uge % 52 === 0) r.vaerdiPrAar[aarFor(s.uge - 1)] = vaerdiansaettelse(s);
    // Kalibrering (median uden spillerpåvirkning køres med Passiv)
    if (s.uge === 52 * 13 - 1) r.kal.dk2024 = s.markeder.dk.kanalisering;
    if (s.uge === 52 * 14 - 1) {
      const se = s.markeder.se;
      r.kal.se2025 = se.kanalisering;
      r.kal.se2025kasino = 1 - se.offshore.kasino;
      r.kal.se2025betting = 1 - se.offshore.betting;
      r.kal.nl2025 = s.markeder.nl.kanalisering;
      r.kal.on2025 = s.markeder.on.kanalisering;
      r.kal.dkKasinoBsi2025 = s.markeder.dk.markedsBsiPrUge.kasino * (1 - s.markeder.dk.offshore.kasino) * 52;
    }
    if (s.uge <= 52 * 14 && s.uge % 13 === 0) {
      const andele = Object.entries(s.markeder.dk.andele).filter(([k]) => k !== 'offshore' && k !== 'oevrige').sort((x, y) => y[1] - x[1]);
      if (andele.length && andele[0][0] !== 'danskeLykke') r.kal.dlNr1Til2025 = false;
    }
    if (s.uge === 52 * 9 - 1) r.dkAndel2020 = s.markeder.dk.andele.spiller ?? 0;
  }
  // Produkttyper med positivt afkast: ca. 30 % af BSI'en efter afgift, revenue share og marketing skal overstige mindstebudgettet
  for (const p of s.produkter) {
    if (p.ejer !== 'spiller') continue;
    if (p.samletBsi * 0.3 > minBudgetUge(p.typeId, p.lanceretUge)) r.typerPositive.push(p.typeId);
  }
  r.typerPositive = [...new Set(r.typerPositive)];
  r.lanceringer = s.produkter.filter((p) => p.ejer === 'spiller').length;
  r.kanalerPositive = [...kanaler];
  r.platformePositive = [...platforme];
  r.markederPositive = [...markeder];
  r.slut = s.slut?.id ?? 'afbrudt';
  r.slutAar = aarFor(s.uge);
  r.vaerdi = s.slut?.vaerdi ?? vaerdiansaettelse(s);
  r.stifterVaerdi = s.slut?.stifterVaerdi ?? r.vaerdi * s.investorer.ejerandelStiftere;
  r.eftermaele = s.slut?.eftermaele ?? eftermaele(s).total;
  r.dkLicens2035 = s.uge >= SIDSTE_UGE && (s.markeder.dk.licens === 'aktiv' || s.markeder.dk.licens === 'suspenderet');
  r.overlevede = r.slut !== 'konkurs' && r.slut !== 'tabtLicens';
  r.reaktioner = { ...s.reaktionsTaeller };
  r.scenarier = Object.keys(s.verdensscenarier);
  const m = s.milepaele;
  const aarAf = (u: number | undefined) => (u === undefined ? null : 2012 + u / 52);
  r.foersteLanceringUge = m.foersteLancering ?? null;
  r.foersteTop10 = aarAf(m.foersteTop10);
  r.foersteGuldkupon = aarAf(m.foersteGuldkupon);
  r.foersteNr1Dk = aarAf(m.foersteNr1Dk);
  r.foersteHof = aarAf(m.foersteHallOfFame);
  r.gallapriser = s.galla.reduce((a, g) => a + g.vundet.length, 0);
  return r;
}
