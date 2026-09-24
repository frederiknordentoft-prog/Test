// Nyt spil (spec 6.1): 2012, tomandsfirma i en garage, 2 mio. kr., white-label og dk-licens i ansøgning.
import type { GameState, NewGameOptions, Platform, ProductTypeId, ThemeId, AcqChannel } from './types';
import { makeRng, seedState } from './rng';
import { START_KAPITAL } from '../data/costs';
import { PRODUCT_TYPE_IDS } from '../data/productTypes';
import { THEME_IDS } from '../data/themes';
import { PLATFORM_MODELS } from '../data/platforms';
import { CHANNEL_IDS } from '../data/acquisition';
import { MARKETS } from '../data/markets';
import { TRUST } from '../data/trust';
import { initMarkeder } from './markets';
import { initKonkurrenter } from './competitors';
import { lavStifter } from './staff';
import { opfyldTilbud } from './contracts';
import { startMaal } from './investors';
import { tomtRegnskab } from './economy';
import { nyhed } from './util';

const platform = (kind: Platform['kind']): Platform => ({
  kind,
  model: 'whiteLabel',
  kvalitet: 40,
  migreringFaerdigUge: null,
  dataejerskab: PLATFORM_MODELS.whiteLabel.dataejerskab,
  b2bKunder: 0,
});

export function newGame(opts: NewGameOptions): GameState {
  const rngState = seedState(opts.seed);
  const s: GameState = {
    version: 2,
    seed: opts.seed,
    rngState,
    uge: 0,
    firmaNavn: opts.firmaNavn.trim() || 'Garagespil ApS',
    stiftere: [...opts.stiftere],
    startVertikal: opts.startVertikal,
    kapital: START_KAPITAL,
    indsigt: 5,
    hype: 0,
    omdoemme: 50,
    investorer: { runde: 'ingen', ejerandelStiftere: 1, pres: 0, vaerdiansaettelse: START_KAPITAL, stjerner: 0, rundeUge: null, vaerdiBonus: 0 },
    staff: [],
    kandidater: [],
    agenter: [],
    projekter: [],
    produkter: [],
    niveauer: {
      type: Object.fromEntries(PRODUCT_TYPE_IDS.map((t) => [t, 1])) as Record<ProductTypeId, number>,
      tema: Object.fromEntries(THEME_IDS.map((t) => [t, 1])) as Record<ThemeId, number>,
    },
    niveauXp: {
      type: Object.fromEntries(PRODUCT_TYPE_IDS.map((t) => [t, 0])) as Record<ProductTypeId, number>,
      tema: Object.fromEntries(THEME_IDS.map((t) => [t, 0])) as Record<ThemeId, number>,
    },
    kombinationsbog: {},
    platforme: { kontoplatform: platform('kontoplatform'), sportsbook: platform('sportsbook'), kasinoplatform: platform('kasinoplatform') },
    markeder: initMarkeder(0),
    konkurrenter: [],
    marketingMix: Object.fromEntries(CHANNEL_IDS.map((c) => [c, 0])) as Record<AcqChannel, number>,
    vipProgram: 0,
    bonusNiveau: 0,
    offshoreBrand: false,
    forskning: { ulaast: [], igang: null },
    kontor: 'garage',
    kontraktopgaver: [],
    verdensscenarier: {},
    aiScenarier: {},
    by: [],
    galla: [],
    kvartalsmaal: [],
    nyheder: [],
    flags: [],
    eventLog: [],
    planlagteRegler: [],
    slut: null,
    kontraktTilbud: [],
    messeBookinger: [],
    ventendeEvents: [],
    signaler: [],
    milepaele: {},
    regnskab: tomtRegnskab(),
    historik: [],
    kvartalAkk: { bsi: 0, resultat: 0, lanceringer: 0, bedsteTotal40: 0, startKunder: 0, startBsi: 0 },
    aarAkk: { aar: 2012, nyeKombinationer: 0, nyeFeatures: 0, lanceringer: 0, bedsteTotal40: 0, startKunder: 0, tillidSum: 0, tillidUger: 0 },
    negativUger: 0,
    engangsUge: 0,
    travleSidst: [],
    bsiHistorik: [],
    holdFaktor: {},
    naesteId: 0,
    mentor: opts.tutorial ? 'aktiv' : 'sprunget',
  };
  const rng = makeRng(s.rngState);
  s.staff = opts.stiftere.map((f) => lavStifter(s, f));
  // Dansk licens i ansøgning (gebyret er betalt før start) [D]
  const dk = s.markeder.dk;
  dk.licens = 'ansoegt';
  dk.vertikaler[opts.startVertikal] = { status: 'ansoegt', klarUge: MARKETS.dk.licensUger };
  dk.tilsynstillid = TRUST.start;
  initKonkurrenter(s, rng);
  opfyldTilbud(s, rng);
  s.kvartalsmaal = startMaal(s);
  nyhed(s, 'Danske Lykke lancerer Haven Kasino.', 'konkurrent');
  nyhed(s, 'Unibit køber en dansk bookmaker og går all-in på det nye marked.', 'konkurrent');
  nyhed(s, '1. januar 2012: Danmark åbner for online betting og kasino. Lotteri forbliver statsmonopol.', 'marked');
  return s;
}
