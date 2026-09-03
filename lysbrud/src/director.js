/* LYSBRUD — demo-instruktør.
   Former hvilke udfald spilleren faktisk ser, så demoen fortæller en historie
   i stedet for at være statistisk tør. Al dramaturgi bor i tabellerne
   BEATS / BONUS_BEATS / FREE_PLAY nedenfor — de er det eneste man behøver
   redigere for at tune demoen. Selve motoren røres ikke: instruktøren
   afvisningssampler engine.spinOutcome og vælger det bedste udfald den så. */

import { spinOutcome } from './engine.js';
import {
  BET_LEVELS,
  DEFAULT_BET_INDEX,
  PRISM_TARGET,
  REEL_WEIGHTS,
  WIN_TIERS,
} from './config.js';

/* ------------------------------------------------------------------ bånd
   Gevinstbånd = dramaturgiske kategorier af totalWin / indsats.
   De tre øverste kanter er bundet til WIN_TIERS, så instruktørens
   fortælling og gevinstoverlays altid siger det samme.                  */

const tierAt = (key) => {
  const t = WIN_TIERS.find(x => x.key === key);
  return t ? t.at : null;
};

const BANDS = [
  { id: 'dead',   min: 0 },
  { id: 'tiny',   min: 0 },                 // > 0, men under 1×
  { id: 'small',  min: 1 },
  { id: 'medium', min: 5 },
  { id: 'big',    min: tierAt('big')  || 15 },
  { id: 'mega',   min: tierAt('mega') || 60 },
  { id: 'epic',   min: tierAt('epic') || 250 },
];

// Hvert bånd får sit x-interval [lo, hi) — bruges til finafstand i logskala.
BANDS.forEach((b, i) => {
  b.lo = b.min;
  b.hi = i + 1 < BANDS.length ? BANDS[i + 1].min : Infinity;
});

const BAND_INDEX = Object.fromEntries(BANDS.map((b, i) => [b.id, i]));

const logx = (x) => Math.log10(1 + Math.max(0, x));

/** totalWin + indsats → bånd-id. */
function bandOf(totalWin, bet) {
  const win = Number(totalWin);
  if (!(win > 0)) return 'dead';
  const x = bet > 0 ? win / bet : win;
  for (let i = BANDS.length - 1; i >= 1; i--) {
    if (x >= BANDS[i].min) return BANDS[i].id;
  }
  return 'tiny';
}

/** Antal kaskader der rent faktisk udbetalte (sidste step er altid tomt). */
function cascadeCount(res) {
  if (!res || !Array.isArray(res.steps)) return 0;
  let n = 0;
  for (const step of res.steps) {
    if (step && Array.isArray(step.clusters) && step.clusters.length > 0) n++;
  }
  return n;
}

/* ------------------------------------------------------------- beat-ark
   ET beat = ét spin i den instruerede sekvens. Redigér KUN denne tabel
   for at ændre demoens rytme.

   band     : accepterede bånd. Rammes ingen af dem, vælges det nærmeste
              udfald instruktøren så (aldrig et hårdt nedbrud).
   cascades : [min, max] antal udbetalende kaskader.
   prism    : 'charge' = mindst ét prismehit · 'hold' = nul ·
              'any' = instruktøren bestemmer ud fra prismeskemaet.
   mood     : valgfri symbolvægtning; udledes ellers af det højeste bånd.
   note     : hvad spinnet skal FØLES som.                                */

const BEATS = [
  /*  1 */ { band: ['small', 'medium'],  cascades: [2, 9], prism: 'charge', note: 'Læringsspin: to kaskader viser reaktoren' },
  /*  2 */ { band: ['dead'],             cascades: [0, 0], prism: 'hold',   note: 'Tomt spin — luft mellem slagene' },
  /*  3 */ { band: ['tiny', 'small'],    cascades: [1, 3], prism: 'charge', note: 'Småt drys, men prismen tikker' },
  /*  4 */ { band: ['medium'],           cascades: [2, 9], prism: 'hold',   note: 'Første rigtige kædereaktion' },
  /*  5 */ { band: ['dead', 'tiny'],     cascades: [0, 1], prism: 'charge', note: 'Roligt spin — skinnen fyldes' },
  /*  6 */ { band: ['small', 'medium'],  cascades: [1, 9], prism: 'charge', note: 'Prismen nærmer sig 4/5' },
  /*  7 */ { band: ['tiny', 'small'],    cascades: [1, 3], prism: 'hold',   note: 'ANTICIPATION der brister — nærved' },
  /*  8 */ { band: ['big'],              cascades: [2, 9], prism: 'charge', note: 'Stor gevinst OG prismen fylder: bonus' },
  /*  9 */ { band: ['medium', 'big'],    cascades: [2, 9], prism: 'any',    note: 'Bonusåbning eller stærkt efterspin' },
  /* 10 */ { band: ['small', 'medium'],  cascades: [1, 9], prism: 'any',    note: 'Holder tempoet oppe' },
  /* 11 */ { band: ['big'],              cascades: [2, 9], prism: 'any',    note: 'Anden top' },
  /* 12 */ { band: ['tiny', 'small'],    cascades: [1, 2], prism: 'any',    note: 'Åndehul før klimaks' },
  /* 13 */ { band: ['mega'],             cascades: [3, 9], prism: 'any',    note: 'MEGA — demoens klimaks' },
  /* 14 */ { band: ['dead', 'tiny'],     cascades: [0, 1], prism: 'any',    note: 'Efterklang, spilleren får luft' },
  /* 15 */ { band: ['medium', 'big'],    cascades: [2, 9], prism: 'any',    note: 'Vi er stadig i gang' },
  /* 16 */ { band: ['small'],            cascades: [1, 3], prism: 'any',    note: 'Normalspil' },
  /* 17 */ { band: ['dead', 'tiny'],     cascades: [0, 1], prism: 'any',    note: 'Normalspil' },
  /* 18 */ { band: ['medium', 'big'],    cascades: [2, 9], prism: 'any',    note: 'Opbygning' },
  /* 19 */ { band: ['big', 'mega'],      cascades: [3, 9], prism: 'any',    note: 'Anden bonus banker på' },
  /* 20 */ { band: ['small', 'medium'],  cascades: [1, 4], prism: 'any',    note: 'Udtoning mod fri leg' },
];

/** Bonusrunden. Cykles med modulo, så retriggers genbruger buen. Ingen døde spin. */
const BONUS_BEATS = [
  { band: ['medium', 'big'],   cascades: [2, 9], prism: 'any', note: 'Bonussen åbner med et smæld' },
  { band: ['small', 'medium'], cascades: [1, 9], prism: 'any', note: 'Multiplikatoren bygger' },
  { band: ['big'],             cascades: [2, 9], prism: 'any', note: 'Første bonustop' },
  { band: ['tiny', 'small'],   cascades: [1, 2], prism: 'any', note: 'Kort pusterum' },
  { band: ['big', 'mega'],     cascades: [3, 9], prism: 'any', note: 'Det vokser' },
  { band: ['medium', 'big'],   cascades: [2, 9], prism: 'any', note: 'Trykket holdes' },
  { band: ['small', 'medium'], cascades: [1, 9], prism: 'any', note: 'Sidste opladning' },
  { band: ['mega', 'epic'],    cascades: [3, 9], prism: 'any', note: 'Finale — lysbrud' },
];

/** Efter beat-arket: vægtet fri leg der stadig har puls. */
const FREE_PLAY = {
  bands: { dead: 22, tiny: 20, small: 26, medium: 17, big: 10, mega: 4, epic: 1 },
  /** Andel af frie spin hvor prismen må lade (ellers holdes den tilbage). */
  prismChance: 0.34,
};

/** Standard kaskadekrav pr. bånd, når et beat ikke selv siger noget. */
const CASCADE_HINT = {
  dead:   [0, 0],
  tiny:   [1, 2],
  small:  [1, 3],
  medium: [1, 9],
  big:    [2, 9],
  mega:   [3, 9],
  epic:   [3, 9],
};

/** Bånd → symbolstemning. Højeste bånd i et beat bestemmer. */
const BAND_MOOD = {
  dead:   'lean',
  tiny:   'lean',
  small:  'even',
  medium: 'rich',
  big:    'lavish',
  mega:   'lavish',
  epic:   'lavish',
};

/* ---------------------------------------------------------- vægtstemning
   Multiplikatorer oven på REEL_WEIGHTS. 'lean' flader fordelingen ud og
   fjerner næsten alle wilds (få og små klynger); 'lavish' hælder benzin
   på ametyst, rubin og wilds. Det er dét, der gør at afvisningssamplingen
   rent faktisk konvergerer i stedet for at lede i blinde.                */

const MOODS = {
  lean:   { cyan: 0.80, green: 0.85, blue: 0.95, pink: 1.15, red: 1.40, purple: 1.75, wild: 0.15 },
  even:   {},
  rich:   { cyan: 0.85, green: 0.90, blue: 1.00, pink: 1.25, red: 1.50, purple: 1.70, wild: 1.50 },
  lavish: { cyan: 0.55, green: 0.60, blue: 0.80, pink: 1.50, red: 2.10, purple: 3.00, wild: 2.40 },
};

/** Prismevægt-skalering. Basisvægtene giver ~2,4 prismer pr. bræt — alt for
 *  hurtigt til en skinne på 5. Instruktøren styrer derfor tætheden selv. */
const PRISM_SCALE = { off: 0, low: 0.36, high: 0.75 };

/* ---------------------------------------------------------- styrekonstanter */

const MAX_TRIES = 220;   // kontraktens loft for afvisningssampling

const BONUS_BY_INDEX = 8;    // prismebonus SKAL være udløst her (spil nr. 9)
const MEGA_PUSH_FROM = 11;   // herfra tvinges en ≥60× hvis den stadig mangler
const BONUS_COLOR_BOOST = 1.55;

/** Strafvægte i afvisningssamplingens score. Lavere score = bedre udfald. */
const PENALTY = {
  band:      10,   // pr. båndtrin fra målet
  size:       1.2, // finafstand i logskala — afgør hvilket nærved-udfald der vinder
  tooFew:     4,
  tooMany:    2,
  prism:      7,
  overCharge: 12,  // > et båndtrin: prismekadencen vejer tungere end dramaturgien
  megaBlock: 40,
};

/** Loft for kaskadestraf, så den aldrig kan overdøve et helt bånd. */
const MAX_CASCADE_PENALTY = 8;

/* ------------------------------------------------------------- hjælpere */

function topBand(bands) {
  let best = bands[0] || 'dead';
  for (const b of bands) {
    if ((BAND_INDEX[b] || 0) > (BAND_INDEX[best] || 0)) best = b;
  }
  return best;
}

function pickWeightedKey(rand, weights) {
  const keys = Object.keys(weights);
  let total = 0;
  for (const k of keys) total += weights[k];
  let t = rand() * total;
  for (const k of keys) {
    t -= weights[k];
    if (t < 0) return k;
  }
  return keys[keys.length - 1];
}

/** Bygger et komplet 5-rings vægtsæt ud fra stemning, prismetæthed og bonusfarve. */
function buildWeights(mood, prismScale, wildColor) {
  const f = MOODS[mood] || MOODS.even;
  return REEL_WEIGHTS.map((ring) => {
    const out = {};
    for (const [id, w] of Object.entries(ring)) {
      const factor = id === 'prism' ? prismScale : (f[id] === undefined ? 1 : f[id]);
      out[id] = w * factor;
    }
    // I bonus er wildColor-gems levende wilds — giv dem lidt ekstra luft.
    if (wildColor && out[wildColor] !== undefined) out[wildColor] *= BONUS_COLOR_BOOST;
    return out;
  });
}

/* ---------------------------------------------------------- planlægning */

function freePlayBeat(rand) {
  const band = pickWeightedKey(rand, FREE_PLAY.bands);
  return { band: [band], cascades: CASCADE_HINT[band], prism: 'any', note: 'Fri leg' };
}

/** Oversætter beat + spiltilstand til en konkret plan for dette ene spin. */
function planFor(pos, charge, inBonus, mem, rand) {
  const beat = inBonus
    ? BONUS_BEATS[mem.bonusSpin % BONUS_BEATS.length]
    : (BEATS[pos] || freePlayBeat(rand));

  // En tastefejl i beat-tabellen må ikke vælte demoen.
  const bands = beat.band.filter(b => BAND_INDEX[b] !== undefined);
  if (bands.length === 0) bands.push('small');

  const plan = {
    band: bands,
    cascades: (beat.cascades || CASCADE_HINT[topBand(bands)]).slice(),
    prism: beat.prism || 'any',
    mood: null,                       // udledes til sidst af det endelige målbånd
    prismCeiling: Infinity,
    prismScale: PRISM_SCALE.low,
    noMega: false,
    note: beat.note || '',
  };

  // Bonusrunden må aldrig føles som en pause.
  if (inBonus) {
    plan.band = plan.band.filter(b => b !== 'dead');
    if (plan.band.length === 0) plan.band = ['small'];
    plan.cascades[0] = Math.max(1, plan.cascades[0]);
  }

  // Garanti: mindst én gevinst ≥ 60× inden for de første 15 spins.
  if (!mem.megaSeen && pos >= MEGA_PUSH_FROM) {
    plan.band = ['mega'];
    plan.cascades = [3, 9];
    plan.note = 'Garanti: mega mangler stadig';
  }

  // Aldrig to mega-eller-bedre i træk.
  if ((BAND_INDEX[mem.prevBand] || 0) >= BAND_INDEX.mega) {
    plan.noMega = true;
    plan.band = plan.band.filter(b => BAND_INDEX[b] < BAND_INDEX.mega);
    if (plan.band.length === 0) plan.band = ['big'];
  }

  // Stemningen udledes af det ENDELIGE målbånd, ikke af beatets oprindelige ønske.
  plan.mood = beat.mood || BAND_MOOD[topBand(plan.band)] || 'even';

  resolvePrism(plan, pos, charge, inBonus, mem, rand);
  return plan;
}

/** Prismeskemaet: hvornår skinnen må tikke, hvornår den skal holde vejret. */
function resolvePrism(plan, pos, charge, inBonus, mem, rand) {
  const nearly = PRISM_TARGET - 1;
  const spinsLeft = BONUS_BY_INDEX - pos + 1;   // inkl. dette spin

  if (inBonus) {
    plan.prism = 'any';                                   // retrigger må gerne ske af sig selv
  } else if (charge >= PRISM_TARGET) {
    plan.prism = 'hold';                                  // skinnen er fuld, bonussen venter på UI'et
  } else if (charge >= nearly && !mem.teaseSeen && (mem.bonusSeen || spinsLeft > 1)) {
    plan.prism = 'hold';                                  // 4/5: anticipationen skal briste mindst én gang
    mem.teaseSeen = true;
  } else if (!mem.bonusSeen && (PRISM_TARGET - charge) >= spinsLeft - (mem.teaseSeen ? 0 : 1)) {
    plan.prism = 'charge';                                // bagud i forhold til bonusgarantien
  } else if (plan.prism === 'any') {
    plan.prism = (mem.bonusSeen && rand() < FREE_PLAY.prismChance) ? 'charge' : 'hold';
  }

  // Før teasen må skinnen kun tikke ét trin ad gangen — den skal ramme 4/5 præcist.
  if (plan.prism === 'charge' && charge < nearly && !mem.teaseSeen) plan.prismCeiling = 1;

  plan.prismScale = plan.prism === 'hold'
    ? PRISM_SCALE.off
    : (plan.prismCeiling === Infinity ? PRISM_SCALE.high : PRISM_SCALE.low);
}

/* ------------------------------------------------------------ bedømmelse */

/** Afstand fra udfald til plan. 0 = perfekt ramt. */
function scoreOutcome(res, plan, bet) {
  const band = bandOf(res.totalWin, bet);
  const bi = BAND_INDEX[band];
  const x = bet > 0 ? Number(res.totalWin) / bet : 0;
  const u = logx(x);
  let score = 0;

  // Båndtrin afgør groft; logafstanden afgør hvilket nærved-udfald der vælges,
  // så et umuligt mål altid falder tilbage på det TÆTTESTE udfald motoren kan give.
  let steps = Infinity;
  let fine = Infinity;
  for (const id of plan.band) {
    const b = BANDS[BAND_INDEX[id]];
    steps = Math.min(steps, Math.abs(bi - BAND_INDEX[id]));
    const lo = logx(b.lo);
    const hi = b.hi === Infinity ? Infinity : logx(b.hi);
    fine = Math.min(fine, u < lo ? lo - u : (u > hi ? u - hi : 0));
  }
  score += steps * PENALTY.band + fine * PENALTY.size;

  const casc = cascadeCount(res);
  if (casc < plan.cascades[0]) score += (plan.cascades[0] - casc) * PENALTY.tooFew;
  else if (casc > plan.cascades[1]) score += Math.min(MAX_CASCADE_PENALTY, (casc - plan.cascades[1]) * PENALTY.tooMany);

  const hits = Number(res.prismHits) || 0;
  if (plan.prism === 'charge' && hits < 1) score += PENALTY.prism;
  if (plan.prism === 'hold' && hits > 0) score += PENALTY.prism * hits;
  if (hits > plan.prismCeiling) score += (hits - plan.prismCeiling) * PENALTY.overCharge;

  if (plan.noMega && bi >= BAND_INDEX.mega) score += PENALTY.megaBlock;

  return score;
}

/** Afvisningssampling med hukommelse om det bedste nærved-udfald. */
function sample(spin, rand, opts, plan, bet) {
  let best = null;
  let bestScore = Infinity;

  for (let t = 0; t < MAX_TRIES; t++) {
    const res = spin(rand, opts);
    if (!res || !Array.isArray(res.steps) || res.steps.length === 0) continue;
    const score = scoreOutcome(res, plan, bet);
    if (score < bestScore) {
      bestScore = score;
      best = res;
    }
    if (bestScore === 0) break;   // perfekt ramt — ingen grund til at lede videre
  }

  // Fandt vi aldrig noget brugbart, giver vi det rå udfald videre.
  return best || spin(rand, opts);
}

/* ------------------------------------------------------------ instruktør */

export function createDirector(rng, opts) {
  const options = opts || {};
  const rand = typeof rng === 'function' ? rng : Math.random;
  // opts.spin er en krog til test og til at køre demoen mod en anden matematik.
  const spin = typeof options.spin === 'function' ? options.spin : spinOutcome;

  let scripted = options.scripted !== false;
  let seq = 0;               // reserve-tæller hvis state.spinIndex mangler

  const mem = {
    origin: null,            // første sete spinIndex (håndterer 0- og 1-baserede tællere)
    prevBand: 'dead',
    megaSeen: false,
    teaseSeen: false,
    bonusSeen: false,
    lastCharge: 0,
    bonusSpin: 0,
  };

  /** Position i beat-arket, uafhængigt af om UI'et tæller fra 0 eller 1. */
  function position(state) {
    const raw = Number(state.spinIndex);
    if (!Number.isFinite(raw)) return seq;
    const idx = Math.max(0, Math.floor(raw));
    if (mem.origin === null || idx < mem.origin) mem.origin = idx;   // ny session
    return idx - mem.origin;
  }

  function remember(res, bet, inBonus) {
    const band = bandOf(res && res.totalWin, bet);
    mem.prevBand = band;
    if (BAND_INDEX[band] >= BAND_INDEX.mega) mem.megaSeen = true;
    mem.bonusSpin = inBonus ? mem.bonusSpin + 1 : 0;
    seq += 1;
  }

  function nextSpin(state) {
    const s = state || {};
    const bet = Number(s.bet) > 0 ? Number(s.bet) : BET_LEVELS[DEFAULT_BET_INDEX];
    const inBonus = !!s.inBonus;
    const wildColor = (inBonus && typeof s.wildColor === 'string') ? s.wildColor : null;
    const charge = Math.max(0, Math.floor(Number(s.prismCharge) || 0));

    if (charge < mem.lastCharge) mem.teaseSeen = false;   // skinnen nulstillet → ny prismecyklus
    mem.lastCharge = charge;
    if (inBonus || charge >= PRISM_TARGET) mem.bonusSeen = true;

    const base = { bet: bet, wildColor: wildColor, bonus: inBonus };

    let result;
    if (!scripted) {
      result = spin(rand, base);
    } else {
      const plan = planFor(position(s), charge, inBonus, mem, rand);
      const opts2 = {
        bet: bet,
        wildColor: wildColor,
        bonus: inBonus,
        weights: buildWeights(plan.mood, plan.prismScale, wildColor),
      };
      result = sample(spin, rand, opts2, plan, bet);
    }

    remember(result, bet, inBonus);
    return result;
  }

  return {
    nextSpin: nextSpin,
    setScripted: (v) => { scripted = !!v; },
    isScripted: () => scripted,
  };
}
