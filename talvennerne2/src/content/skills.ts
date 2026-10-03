// Static metadata for the 10 domains and 72 skills (SPEC §2.1–2.2, pædagogik-forslaget §1.3).
// Each SkillDef in src/engine/skills/<domain>/<skillId>.ts must agree with this table (test).
import type { DomainId, FamilyDef, Grade, SkillId, TaskKind } from '../engine/types'

export interface DomainMeta {
  id: DomainId
  label: string
  /** Fælles Mål heading used by the dashboard. */
  group: 'Tal og algebra' | 'Geometri og måling'
  /** Core domains feed the grade estimate. */
  core: boolean
  color: string
}

export const DOMAINS: readonly DomainMeta[] = [
  { id: 'number', label: 'Tal og tælling', group: 'Tal og algebra', core: true, color: '#2F7DF6' },
  { id: 'place', label: 'Titalssystemet', group: 'Tal og algebra', core: true, color: '#8D6E63' },
  { id: 'addsub', label: 'Plus og minus', group: 'Tal og algebra', core: true, color: '#F2994A' },
  { id: 'muldiv', label: 'Gange og division', group: 'Tal og algebra', core: true, color: '#9B51E0' },
  { id: 'algebra', label: 'Lighedstegn og mønstre', group: 'Tal og algebra', core: false, color: '#5C6BC0' },
  { id: 'fractions', label: 'Brøker', group: 'Tal og algebra', core: false, color: '#E056A0' },
  { id: 'shapes', label: 'Figurer og rum', group: 'Geometri og måling', core: false, color: '#27AE60' },
  { id: 'clock', label: 'Klokken', group: 'Geometri og måling', core: false, color: '#EB5757' },
  { id: 'money', label: 'Penge', group: 'Geometri og måling', core: false, color: '#E0B020' },
  { id: 'measure', label: 'Måling og data', group: 'Geometri og måling', core: false, color: '#2DB7B0' },
]

export interface SkillMeta {
  id: SkillId
  domain: DomainId
  grade: Grade
  stage: number
  mode: 'recall' | 'procedure'
  /** Parent-facing label (Danish). */
  label: string
  kinds: TaskKind[]
  /** Kinds that count as production for this skill (the `*` in SPEC §2.2). */
  production: TaskKind[]
  families: FamilyDef[]
}

const fam = (ids: string, grades: Partial<Record<string, Grade>> = {}, labels: Partial<Record<string, string>> = {}): FamilyDef[] =>
  ids.split(' ').map((id, rank) => ({
    id,
    label: labels[id] ?? id,
    rank,
    ...(grades[id] !== undefined ? { grade: grades[id] } : {}),
  }))

type Row = Omit<SkillMeta, 'families'> & { families: FamilyDef[] }
const s = (row: Row): SkillMeta => row

export const SKILLS: readonly SkillMeta[] = [
  // ── number ──
  s({ id: 'count10', domain: 'number', grade: 0, stage: 0.1, mode: 'recall', label: 'Tælle til 10',
    kinds: ['choice', 'countTap', 'keypad'], production: ['countTap', 'keypad'],
    families: fam('scatter flash', {}, { scatter: 'Tæl spredte ting', flash: 'Se antallet med det samme' }) }),
  s({ id: 'count20', domain: 'number', grade: 0, stage: 0.5, mode: 'recall', label: 'Tælle til 20',
    kinds: ['choice', 'keypad', 'countTap'], production: ['keypad', 'countTap'],
    families: fam('tenframe loose', {}, { tenframe: 'Ti-rammer', loose: 'Løse ting' }) }),
  s({ id: 'hear20', domain: 'number', grade: 0, stage: 0.3, mode: 'recall', label: 'Hør og skriv tal til 20',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('small teens', {}, { small: 'Tal 0–10', teens: 'Tal 11–20' }) }),
  s({ id: 'order20', domain: 'number', grade: 0, stage: 0.4, mode: 'procedure', label: 'Før, efter og størst til 20',
    kinds: ['choice', 'numberline', 'keypad', 'sortOrder'], production: ['numberline', 'keypad', 'sortOrder'],
    families: fam('after before between bigger', {}, { after: 'Tallet efter', before: 'Tallet før', between: 'Tallet imellem', bigger: 'Hvilket er størst' }) }),
  s({ id: 'hear100', domain: 'number', grade: 1, stage: 1.2, mode: 'procedure', label: 'Hør og skriv tal til 100',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('d2x d3x d4x d5x d6x d7x d8x d9x') }),
  s({ id: 'order100', domain: 'number', grade: 1, stage: 1.3, mode: 'procedure', label: 'Tal til 100 i rækkefølge',
    kinds: ['choice', 'keypad', 'sortOrder'], production: ['keypad', 'sortOrder'],
    families: fam('plus1 minus1 plus10 minus10 crossTen biggerDiffTens biggerSwapped') }),
  s({ id: 'numberLine100', domain: 'number', grade: 1, stage: 1.5, mode: 'procedure', label: 'Tallinjen til 100',
    kinds: ['numberline', 'choice', 'keypad'], production: ['numberline', 'keypad'],
    families: fam('placeTens placeAny readArrow') }),
  s({ id: 'hear1000', domain: 'number', grade: 2, stage: 2.1, mode: 'procedure', label: 'Hør og skriv tal til 1000',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('hundreds h0o hTeen hT0 hTO') }),
  s({ id: 'order1000', domain: 'number', grade: 2, stage: 2.3, mode: 'procedure', label: 'Tal til 1000 i rækkefølge',
    kinds: ['choice', 'keypad', 'sortOrder'], production: ['keypad', 'sortOrder'],
    families: fam('plus1 plus10 plus100 minus1 minus10 minus100 crossHundred bigger3 biggerMixed') }),
  s({ id: 'numberLine1000', domain: 'number', grade: 2, stage: 2.5, mode: 'procedure', label: 'Tallinjen til 1000 og afrunding',
    kinds: ['numberline', 'choice', 'keypad'], production: ['numberline', 'keypad'],
    families: fam('placeHundreds placeAny round10 round100', { round10: 3, round100: 3 }) }),

  // ── place ──
  s({ id: 'tensOnes', domain: 'place', grade: 1, stage: 1.1, mode: 'procedure', label: 'Tiere og enere',
    kinds: ['choice', 'keypad', 'buildBase', 'fillSlots'], production: ['keypad', 'buildBase'],
    families: fam('build decompose swapped expand') }),
  s({ id: 'placeValue1000', domain: 'place', grade: 2, stage: 2.2, mode: 'procedure', label: 'Hundreder, tiere og enere',
    kinds: ['choice', 'keypad', 'buildBase', 'fillSlots'], production: ['keypad', 'buildBase', 'fillSlots'],
    families: fam('buildHTO zeroPlace digitValue expand regroup', { regroup: 3 }) }),

  // ── addsub ──
  s({ id: 'addTo10', domain: 'addsub', grade: 0, stage: 0.4, mode: 'recall', label: 'Plus til 10',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('small big', {}, { small: 'Til 5', big: 'Til 10' }) }),
  s({ id: 'subTo10', domain: 'addsub', grade: 0, stage: 0.6, mode: 'recall', label: 'Minus inden for 10',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('small big', {}, { small: 'Fra højst 5', big: 'Fra 6–10' }) }),
  s({ id: 'tenFriends', domain: 'addsub', grade: 0, stage: 0.8, mode: 'recall', label: 'Tiervenner',
    kinds: ['pair', 'choice', 'keypad'], production: ['keypad'], families: fam('pairs') }),
  s({ id: 'doubles', domain: 'addsub', grade: 1, stage: 1.0, mode: 'recall', label: 'Dobbelt',
    kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'], families: fam('to5 to10') }),
  s({ id: 'halves', domain: 'addsub', grade: 1, stage: 1.1, mode: 'recall', label: 'Halvdelen',
    kinds: ['choice', 'keypad', 'share'], production: ['keypad'], families: fam('to10 to20') }),
  s({ id: 'addSub20Simple', domain: 'addsub', grade: 1, stage: 1.2, mode: 'procedure', label: 'Plus og minus til 20 uden tierovergang',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('tenPlus addTeen subTeen') }),
  s({ id: 'addTo20', domain: 'addsub', grade: 1, stage: 1.4, mode: 'recall', label: 'Plus over tieren',
    kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'], families: fam('bridge10') }),
  s({ id: 'subTo20', domain: 'addsub', grade: 1, stage: 1.6, mode: 'recall', label: 'Minus over tieren',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('bridge10') }),
  s({ id: 'tens100', domain: 'addsub', grade: 1, stage: 1.5, mode: 'procedure', label: 'Hele tiere plus og minus',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('addTens subTens') }),
  s({ id: 'add100NoCarry', domain: 'addsub', grade: 1, stage: 1.7, mode: 'procedure', label: 'Plus til 100 uden tierovergang',
    kinds: ['choice', 'keypad', 'buildBase'], production: ['keypad'], families: fam('TOplusO TOplusT0 TOplusTO') }),
  s({ id: 'sub100NoBorrow', domain: 'addsub', grade: 1, stage: 1.8, mode: 'procedure', label: 'Minus til 100 uden veksling',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('TOminusO TOminusT0 TOminusTO') }),
  s({ id: 'add100Carry', domain: 'addsub', grade: 2, stage: 2.1, mode: 'procedure', label: 'Plus til 100 med tierovergang',
    kinds: ['choice', 'keypad', 'numberline'], production: ['keypad', 'numberline'],
    families: fam('toNextTen TOplusOcarry TOplusTOcarry nearTen TOplusTOover100') }),
  s({ id: 'sub100Borrow', domain: 'addsub', grade: 2, stage: 2.3, mode: 'procedure', label: 'Minus til 100 med veksling',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('fromTen TOminusOborrow TOminusTOborrow nearTen') }),
  s({ id: 'addSub1000Round', domain: 'addsub', grade: 2, stage: 2.5, mode: 'procedure', label: 'Runde tal til 1000',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('HplusH HminusH HTplusT HTminusT HplusTO HTplusTcarry') }),
  s({ id: 'add1000', domain: 'addsub', grade: 3, stage: 3.1, mode: 'procedure', label: 'Plus med trecifrede tal',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('HTOplusOcarry HTOplusTO HTOplusTOcarry1 HTOplusTOcarry10 HTOplusHTO HTOplusHTOcarry') }),
  s({ id: 'sub1000', domain: 'addsub', grade: 3, stage: 3.3, mode: 'procedure', label: 'Minus med trecifrede tal',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('HTOminusOborrow HTOminusTO HTOminusTOborrow HTOminusHTO HTOminusHTOborrow acrossZero') }),

  // ── muldiv ──
  s({ id: 'groupsOf', domain: 'muldiv', grade: 2, stage: 2.4, mode: 'recall', label: 'Grupper af lige mange',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('groups') }),
  s({ id: 'mul2510', domain: 'muldiv', grade: 2, stage: 2.6, mode: 'recall', label: '2-, 5- og 10-tabellen',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('t2 t5 t10') }),
  s({ id: 'shareEqually', domain: 'muldiv', grade: 2, stage: 2.7, mode: 'recall', label: 'Del ligeligt',
    kinds: ['share', 'choice', 'keypad'], production: ['share', 'keypad'], families: fam('share') }),
  s({ id: 'mul34', domain: 'muldiv', grade: 3, stage: 3.2, mode: 'recall', label: '3- og 4-tabellen',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('t3 t4') }),
  s({ id: 'mul6to9', domain: 'muldiv', grade: 3, stage: 3.5, mode: 'recall', label: '6- til 9-tabellen',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('t6 t7 t8 t9') }),
  s({ id: 'div2510', domain: 'muldiv', grade: 3, stage: 3.3, mode: 'recall', label: 'Division med 2, 5 og 10',
    kinds: ['choice', 'keypad', 'share'], production: ['keypad'], families: fam('d2 d5 d10') }),
  s({ id: 'divAll', domain: 'muldiv', grade: 3, stage: 3.7, mode: 'recall', label: 'Division i den lille tabel',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('d3 d4 d6 d7 d8 d9') }),
  s({ id: 'mulTens', domain: 'muldiv', grade: 3, stage: 3.8, mode: 'procedure', label: 'Gange med hele tiere',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('oneDigitTimesTens tensTimesOneDigit') }),

  // ── algebra ──
  s({ id: 'patterns', domain: 'algebra', grade: 0, stage: 0.2, mode: 'procedure', label: 'Mønstre',
    kinds: ['choice', 'fillSlots'], production: ['fillSlots'], families: fam('AB AAB ABB ABC growing') }),
  s({ id: 'missingPart10', domain: 'algebra', grade: 1, stage: 1.3, mode: 'recall', label: 'Det manglende tal til 10',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('missing') }),
  s({ id: 'skipCount', domain: 'algebra', grade: 1, stage: 1.4, mode: 'procedure', label: 'Tælle i spring',
    kinds: ['choice', 'keypad', 'fillSlots'], production: ['keypad', 'fillSlots'],
    families: fam('step2 step5 step10 step10offset back10 step100 step25', { step100: 2, step25: 3 }) }),
  s({ id: 'missingPart100', domain: 'algebra', grade: 2, stage: 2.0, mode: 'procedure', label: 'Det manglende tal til 100',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('addendCross20 toHundred subtrahend minuend') }),
  s({ id: 'inverseOps', domain: 'algebra', grade: 2, stage: 2.2, mode: 'procedure', label: 'Regnefamilier',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('addToSub subToAdd mulToDiv', { mulToDiv: 3 }) }),
  s({ id: 'equalSides', domain: 'algebra', grade: 2, stage: 2.4, mode: 'procedure', label: 'Lighedstegnet',
    kinds: ['trueFalse', 'choice', 'keypad'], production: ['keypad'],
    families: fam('trueFalse balanceAdd balanceSub balanceMixed', { balanceSub: 3, balanceMixed: 3 }) }),

  // ── shapes ──
  s({ id: 'shapes2D', domain: 'shapes', grade: 0, stage: 0.2, mode: 'recall', label: 'Flade figurer',
    kinds: ['choice', 'multiSelect'], production: ['multiSelect'],
    families: fam('basic squareRect polygons', { squareRect: 1, polygons: 1 }) }),
  s({ id: 'sidesCorners', domain: 'shapes', grade: 1, stage: 1.3, mode: 'recall', label: 'Sider og hjørner',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('sides corners') }),
  s({ id: 'shapes3D', domain: 'shapes', grade: 1, stage: 1.6, mode: 'recall', label: 'Rumlige figurer',
    kinds: ['choice', 'multiSelect', 'keypad'], production: ['multiSelect', 'keypad'], families: fam('names props', { props: 2 }) }),
  s({ id: 'sortShapes', domain: 'shapes', grade: 1, stage: 1.7, mode: 'procedure', label: 'Sortér figurer',
    kinds: ['multiSelect'], production: ['multiSelect'],
    families: fam('threeCorners fourCorners noCorners fourEqualSides rightAngle', { fourEqualSides: 2, rightAngle: 3 }) }),
  s({ id: 'symmetry', domain: 'shapes', grade: 1, stage: 1.8, mode: 'procedure', label: 'Symmetri',
    kinds: ['trueFalse', 'multiSelect', 'grid'], production: ['multiSelect', 'grid'], families: fam('isSymLine mirrorGrid', { mirrorGrid: 2 }) }),
  s({ id: 'composeShapes', domain: 'shapes', grade: 2, stage: 2.5, mode: 'recall', label: 'Sammensæt figurer',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('compose') }),
  s({ id: 'area', domain: 'shapes', grade: 3, stage: 3.4, mode: 'procedure', label: 'Areal',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('countSquares rowsCols lShape compareArea') }),
  s({ id: 'gridCoords', domain: 'shapes', grade: 3, stage: 3.6, mode: 'procedure', label: 'Koordinater',
    kinds: ['choice', 'grid'], production: ['grid'], families: fam('readPoint placePoint') }),

  // ── clock ──
  s({ id: 'clockHour', domain: 'clock', grade: 1, stage: 1.5, mode: 'recall', label: 'Hele timer',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('hour') }),
  s({ id: 'clockHalf', domain: 'clock', grade: 1, stage: 1.8, mode: 'recall', label: 'Halve timer',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('half') }),
  s({ id: 'clockQuarter', domain: 'clock', grade: 2, stage: 2.5, mode: 'recall', label: 'Kvarter',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('quarterPast quarterTo') }),
  s({ id: 'clockFive', domain: 'clock', grade: 3, stage: 3.2, mode: 'procedure', label: 'Fem minutter ad gangen',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('over iHalv overHalv i halfForm') }),
  s({ id: 'clockDigital', domain: 'clock', grade: 3, stage: 3.5, mode: 'procedure', label: 'Digitalt ur og 24 timer',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('analogToDigital digital24') }),
  s({ id: 'clockElapsed', domain: 'clock', grade: 3, stage: 3.6, mode: 'procedure', label: 'Tid der går',
    kinds: ['choice', 'clockSet'], production: ['clockSet'], families: fam('plusHour plusHalf plusQuarter minusHalf') }),

  // ── money ──
  s({ id: 'coinNames', domain: 'money', grade: 1, stage: 1.2, mode: 'recall', label: 'Mønter og sedler',
    kinds: ['choice', 'multiSelect'], production: ['multiSelect'], families: fam('coins notes') }),
  s({ id: 'countCoins', domain: 'money', grade: 1, stage: 1.6, mode: 'procedure', label: 'Tæl penge',
    kinds: ['choice', 'keypad'], production: ['keypad'],
    families: fam('sameCoins mixedTo20 mixedTo100 biggestFirst', { mixedTo100: 2, biggestFirst: 2 }) }),
  s({ id: 'payExact', domain: 'money', grade: 2, stage: 2.3, mode: 'procedure', label: 'Betal præcist',
    kinds: ['pay', 'choice'], production: ['pay'], families: fam('to20 to50 to100 fewestCoins', { fewestCoins: 3 }) }),
  s({ id: 'change', domain: 'money', grade: 2, stage: 2.6, mode: 'procedure', label: 'Byttepenge',
    kinds: ['choice', 'keypad', 'pay'], production: ['keypad', 'pay'], families: fam('from10 from20 from50 from100', { from100: 3 }) }),
  s({ id: 'kronerOre', domain: 'money', grade: 3, stage: 3.4, mode: 'procedure', label: 'Kroner og øre',
    kinds: ['choice', 'pay'], production: ['pay'], families: fam('readAmount fiftiesInKroner addHalves') }),

  // ── measure ──
  s({ id: 'compareLength', domain: 'measure', grade: 0, stage: 0.3, mode: 'recall', label: 'Længst og kortest',
    kinds: ['choice', 'sortOrder'], production: ['sortOrder'], families: fam('aligned offset') }),
  s({ id: 'weightCompare', domain: 'measure', grade: 1, stage: 1.0, mode: 'recall', label: 'Tungest og lettest',
    kinds: ['choice', 'multiSelect'], production: ['multiSelect'], families: fam('congruent conflict') }),
  s({ id: 'measureUnits', domain: 'measure', grade: 1, stage: 1.1, mode: 'procedure', label: 'Mål med klodser',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('cubes clips') }),
  s({ id: 'rulerRead', domain: 'measure', grade: 1, stage: 1.7, mode: 'procedure', label: 'Aflæs en lineal',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('from0 offset', { offset: 2 }) }),
  s({ id: 'unitChoice', domain: 'measure', grade: 2, stage: 2.2, mode: 'recall', label: 'Vælg den rigtige enhed',
    kinds: ['choice', 'multiSelect'], production: ['multiSelect'], families: fam('length weight', { weight: 3 }) }),
  s({ id: 'readChart', domain: 'measure', grade: 2, stage: 2.6, mode: 'procedure', label: 'Aflæs diagrammer',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('readPicto readBar mostLeast difference') }),
  s({ id: 'convertCmM', domain: 'measure', grade: 3, stage: 3.3, mode: 'procedure', label: 'Centimeter og meter',
    kinds: ['choice', 'keypad'], production: ['keypad'], families: fam('mToCm mCmToCm cmToMCm compareMixed') }),

  // ── fractions ──
  s({ id: 'halfShape', domain: 'fractions', grade: 1, stage: 1.4, mode: 'recall', label: 'Halve',
    kinds: ['trueFalse', 'multiSelect'], production: ['multiSelect'], families: fam('equal unequal') }),
  s({ id: 'fractionShape', domain: 'fractions', grade: 2, stage: 2.6, mode: 'recall', label: 'Brøker af figurer',
    kinds: ['choice', 'colorParts', 'fillSlots'], production: ['fillSlots'], families: fam('basic nonUnit', { nonUnit: 3 }) }),
  s({ id: 'fractionOfSet', domain: 'fractions', grade: 3, stage: 3.3, mode: 'procedure', label: 'Brøkdel af en mængde',
    kinds: ['share', 'choice', 'keypad'], production: ['share', 'keypad'], families: fam('halfOf quarterOf thirdOf threeQuartersOf') }),
  s({ id: 'fractionCompare', domain: 'fractions', grade: 3, stage: 3.6, mode: 'procedure', label: 'Sammenlign brøker',
    kinds: ['choice', 'sortOrder'], production: ['sortOrder'], families: fam('pairBigger pairSmaller order4') }),
]

export const SKILL_BY_ID: Readonly<Record<SkillId, SkillMeta>> = Object.fromEntries(
  SKILLS.map((m) => [m.id, m]),
) as Record<SkillId, SkillMeta>

export const DOMAIN_BY_ID: Readonly<Record<DomainId, DomainMeta>> = Object.fromEntries(
  DOMAINS.map((d) => [d.id, d]),
) as Record<DomainId, DomainMeta>

/** Grade of a family (family override, else the skill grade). */
export function familyGrade(skill: SkillId, family: string): Grade {
  const meta = SKILL_BY_ID[skill]
  return meta.families.find((f) => f.id === family)?.grade ?? meta.grade
}
