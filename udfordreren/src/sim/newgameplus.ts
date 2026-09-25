// New Game+ (spec 6.17): kombinationsbogen og niveauerne bevares, og to modes låses op:
// "2018-start i USA" og "AI-native fra 2026", hvor man starter med agenter.
import type { GameState, NewGameOptions, NewGamePlusArv } from './types';
import { newGame } from './init';
import { stepMut } from './step';
import { autoloesEvents } from './events';
import { lavStifter } from './staff';
import { startMaal } from './investors';
import { nyAgent } from './agents';
import { tomtRegnskab } from './economy';
import { initBy } from './town';
import { MARKETS } from '../data/markets';
import { PLATFORM_MODELS } from '../data/platforms';
import { TRUST } from '../data/trust';
import { AI_AKT_UGE, datoTekst, ugeFor } from './time';
import { nyhed } from './util';

export const MODE_START = { usa2018: ugeFor(2018, 5), aiNative2026: AI_AKT_UGE - 1 };
export const MODE_KAPITAL = { usa2018: 12, aiNative2026: 10 };

/** Arven fra et afsluttet spil */
export function arvFra(s: GameState): NewGamePlusArv {
  return structuredClone({ kombinationsbog: s.kombinationsbog, niveauer: s.niveauer, niveauXp: s.niveauXp });
}

/** Nyt spil med New Game+-arv og evt. en særlig startmode */
export function nytSpil(opts: NewGameOptions): GameState {
  const s = newGame(opts);
  if (opts.arv) {
    s.kombinationsbog = structuredClone(opts.arv.kombinationsbog);
    s.niveauer = structuredClone(opts.arv.niveauer);
    s.niveauXp = structuredClone(opts.arv.niveauXp);
  }
  const mode = opts.mode ?? 'normal';
  if (mode === 'normal') return s;
  spolFrem(s, MODE_START[mode]);
  nulstilFirma(s, opts, mode);
  return s;
}

/** Lad verden køre frem til en uge uden spilleren (markeder, konkurrenter, regler og trends) */
function spolFrem(s: GameState, maal: number): void {
  while (s.uge < maal) {
    s.kapital = Math.max(s.kapital, 2);
    s.negativUger = 0;
    autoloesEvents(s);
    s.kontraktTilbud = [];
    stepMut(s, []);
    s.slut = null;
  }
}

function nulstilFirma(s: GameState, opts: NewGameOptions, mode: 'usa2018' | 'aiNative2026'): void {
  const arv = opts.arv;
  s.staff = [];
  s.staff = opts.stiftere.map((f) => ({ ...lavStifter(s, f), ansatUge: s.uge }));
  s.kandidater = [];
  s.projekter = [];
  s.produkter = s.produkter.filter((p) => p.ejer !== 'spiller');
  s.kontraktopgaver = [];
  s.ventendeEvents = [];
  s.eventLog = [];
  s.signaler = [];
  s.milepaele = {};
  s.historik = [];
  s.bsiHistorik = [];
  s.kvartalsmaal = startMaal(s);
  s.forrigeKvartalsmaal = undefined;
  s.regnskab = tomtRegnskab();
  s.kapital = MODE_KAPITAL[mode];
  s.indsigt = 10;
  s.hype = 0;
  s.omdoemme = 50;
  s.investorer = { runde: 'ingen', ejerandelStiftere: 1, pres: 0, vaerdiansaettelse: s.kapital, stjerner: 0, rundeUge: null, vaerdiBonus: 0 };
  s.forskning = { ulaast: [], igang: null };
  s.kontor = 'garage';
  s.agenter = [];
  s.by = initBy();
  s.byHistorier = [];
  s.byAarlig = [];
  s.tidslinje = [];
  s.transformation = [];
  s.aiUheld = 0;
  s.eftermaeleAkk = { tillidSum: 0, tillidUger: 0, risikoSum: 0, risikoProever: 0, maxSanktion: 0, dkTabt: false };
  s.opkoebstilbud = null;
  s.sponsorAuktion = null;
  s.sponsorater = s.sponsorater.filter((x) => x.ejer !== 'spiller');
  s.featureFordele = {};
  s.planlagteKopier = [];
  s.reaktioner = s.reaktioner.filter((r) => r.competitorId);
  s.negativUger = 0;
  s.engangsUge = 0;
  s.bonusNiveau = 0;
  s.vipProgram = 0;
  s.offshoreBrand = false;
  s.flags = s.flags.filter((f) => !['haftOffshoreBrand', 'hyperBrugt', 'aiTransformeret', 'server', 'espresso', 'dyrLeverandoer', 'dyrLeverandoerHalv'].includes(f));
  if (!arv) {
    for (const k of Object.keys(s.kombinationsbog)) delete s.kombinationsbog[k];
  }
  s.mode = mode;
  for (const m of Object.values(s.markeder)) {
    m.licens = 'ingen';
    m.vertikaler = { betting: { status: 'ingen', klarUge: null }, kasino: { status: 'ingen', klarUge: null } };
    m.spillerKunder = { betting: 0, kasino: 0 };
    m.spillerBsiPrUge = { betting: 0, kasino: 0 };
    m.tilsynstillid = TRUST.start;
    m.sanktion = { trin: 0, sidsteUge: null, roligeKvartaler: 0 };
    m.suspenderetTil = null;
    delete m.andele.spiller;
  }
  for (const k of Object.keys(s.marketingMix) as (keyof typeof s.marketingMix)[]) s.marketingMix[k] = 0;
  if (mode === 'usa2018') {
    // Højesteret har netop fjernet forbuddet: I starter med en bettinglicens i USA
    const us = s.markeder.us;
    us.licens = 'aktiv';
    us.vertikaler.betting = { status: 'aktiv', klarUge: s.uge };
    s.startVertikal = 'betting';
    s.tidslinje.push({ uge: s.uge, tekst: `${s.firmaNavn} starter i ${MARKETS.us.navn} ${datoTekst(s.uge)} med en bettinglicens.`, kind: 'firma' });
    nyhed(s, `${s.firmaNavn} åbner i USA, hvor sportsbetting netop er blevet lovligt.`, 'firma', 'a13');
  } else {
    // AI-native fra 2026: dansk licens, hybrid kontoplatform og tre agenter fra start
    const dk = s.markeder.dk;
    dk.licens = 'aktiv';
    dk.vertikaler[opts.startVertikal] = { status: 'aktiv', klarUge: s.uge };
    s.platforme.kontoplatform.model = 'hybrid';
    s.platforme.kontoplatform.dataejerskab = PLATFORM_MODELS.hybrid.dataejerskab;
    s.platforme.kontoplatform.kvalitet = 60;
    s.agenter.push(nyAgent(s, 'udvikling', 0.6), nyAgent(s, 'udvikling', 0.6), nyAgent(s, 'kundeservice', 0.6));
    s.tidslinje.push({ uge: s.uge, tekst: `${s.firmaNavn} starter som AI-native udfordrer med tre agenter.`, kind: 'ai' });
    nyhed(s, `${s.firmaNavn} starter med to stiftere og tre AI-agenter.`, 'firma');
  }
}
