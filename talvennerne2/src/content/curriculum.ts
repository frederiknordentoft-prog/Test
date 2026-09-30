// Worlds, regions and nodes (SPEC §5.3). Integrator-owned; the unlock rules live in src/meta/unlock.ts.
import type {
  ChainId, ClipId, Grade, ItemId, NodeId, RegionId, RegionNodeSlot, SkillId, SpeciesId, TaskKind, WorldId,
} from '../engine/types'

/** A skill inside a region, optionally restricted to some families or to numbers ≤ max. */
export interface RegionSkill {
  skill: SkillId
  families?: string[]
  /** All operands and the answer are ≤ max (e.g. hear20 up to 10 in Tællelunden). */
  max?: number
  /** Only used as review material in this region (e.g. addTo10 in Minusbækken). */
  reviewOnly?: boolean
}

export type Node3 = { kind: 'friend'; species: SpeciesId } | { kind: 'chest'; item: ItemId }

export interface RegionDef {
  id: RegionId
  world: WorldId
  /** 1-based order inside the world (the first two are open when the world is). */
  index: number
  name: string
  nameClip: ClipId
  chain: ChainId
  requires: RegionId[]
  skills: RegionSkill[]
  node3: Node3
  roundSize: 8 | 10
}

export interface WorldDef {
  id: WorldId
  grade: Grade
  name: string
  nameClip: ClipId
  regions: RegionId[]
  /** Items given by the world finale. */
  finaleItems: ItemId[]
}

export type NodeSlot = RegionNodeSlot | 'finale'

export interface NodeDef {
  id: NodeId
  world: WorldId
  region: RegionId | null
  slot: NodeSlot
  /** Skills this node draws from (with the region's restrictions). */
  skills: RegionSkill[]
  /** l3, trial and finale ask for production only (l3 from box ≥ 1). */
  production: 'normal' | 'fromBox1' | 'only'
  /** The node's house kind for boxes below 3 (choice-heavy intro nodes). */
  houseKind: TaskKind | null
  /** Number of tasks in a round on this node. */
  size: number
  /** Share of review tasks from other unlocked skills (mix nodes). */
  review: number
}

const r = (
  world: WorldId, index: number, id: RegionId, name: string, chain: ChainId, skills: RegionSkill[],
  node3: Node3, requires: RegionId[] = [], roundSize: 8 | 10 = 10,
): RegionDef => ({ id, world, index, name, nameClip: `name.region.${id}`, chain, requires, skills, node3, roundSize })

const sk = (skill: SkillId, extra: Omit<RegionSkill, 'skill'> = {}): RegionSkill => ({ skill, ...extra })

export const REGIONS: readonly RegionDef[] = [
  // ── Engdalen (0. kl.) ──
  r('eng', 1, 'w0-tal10', 'Tællelunden', 'tal',
    [sk('count10'), sk('hear20', { max: 10 }), sk('order20', { max: 10 })], { kind: 'friend', species: 'rabbit' }),
  r('eng', 2, 'w0-former', 'Formhaven', 'figurer',
    [sk('shapes2D', { families: ['basic'] }), sk('patterns'), sk('compareLength')], { kind: 'chest', item: 'opdager-head' }),
  r('eng', 3, 'w0-plus10', 'Plusengen', 'tal', [sk('addTo10')], { kind: 'friend', species: 'cat' }),
  r('eng', 4, 'w0-tal20', 'Tyvestien', 'tal',
    [sk('count20'), sk('hear20'), sk('order20')], { kind: 'chest', item: 'opdager-hand' }),
  r('eng', 5, 'w0-minus10', 'Minusbækken', 'tal',
    [sk('subTo10'), sk('addTo10', { reviewOnly: true })], { kind: 'friend', species: 'puppy' }, ['w0-plus10']),
  r('eng', 6, 'w0-tiervenner', 'Tiervennernes hule', 'tal', [sk('tenFriends')], { kind: 'friend', species: 'hedgehog' }),

  // ── Hestebakkerne (1. kl.) ──
  r('bakke', 1, 'w1-tal100', 'Hundredemarken', 'tal',
    [sk('hear100'), sk('tensOnes'), sk('order100'), sk('numberLine100')], { kind: 'friend', species: 'horse' }),
  r('bakke', 2, 'w1-dobbelt', 'Dobbeltdalen', 'tal',
    [sk('doubles'), sk('halves'), sk('skipCount', { families: ['step2', 'step5', 'step10', 'step10offset', 'back10'] })],
    { kind: 'chest', item: 'rytter-head' }),
  r('bakke', 3, 'w1-tieren', 'Tyvebroen', 'tal',
    [sk('addSub20Simple'), sk('addTo20'), sk('subTo20'), sk('missingPart10')], { kind: 'friend', species: 'lamb' }),
  r('bakke', 4, 'w1-figurer', 'Formværkstedet', 'figurer',
    [
      sk('shapes2D', { families: ['squareRect', 'polygons'] }), sk('sidesCorners'), sk('shapes3D', { families: ['names'] }),
      sk('sortShapes', { families: ['threeCorners', 'fourCorners', 'noCorners'] }), sk('symmetry', { families: ['isSymLine'] }),
      sk('halfShape'),
    ],
    { kind: 'chest', item: 'rytter-face' }),
  r('bakke', 5, 'w1-klokken', 'Urtårnet', 'klokken', [sk('clockHour'), sk('clockHalf')], { kind: 'friend', species: 'fox' }),
  r('bakke', 6, 'w1-tiere', 'Tierhoppet', 'tal',
    [sk('tens100'), sk('add100NoCarry'), sk('sub100NoBorrow')], { kind: 'chest', item: 'rytter-hand' }, ['w1-tal100']),
  r('bakke', 7, 'w1-maal-penge', 'Målebakken', 'pengeMaal',
    [
      sk('measureUnits'), sk('rulerRead', { families: ['from0'] }), sk('weightCompare'), sk('coinNames'),
      sk('countCoins', { families: ['sameCoins', 'mixedTo20'] }),
    ],
    { kind: 'friend', species: 'hamster' }),

  // ── Regnbueskoven (2. kl.) ──
  r('skov', 1, 'w2-tal1000', 'Stortalsbjerget', 'tal',
    [
      sk('hear1000'), sk('placeValue1000', { families: ['buildHTO', 'zeroPlace', 'digitValue', 'expand'] }), sk('order1000'),
      sk('numberLine1000', { families: ['placeHundreds', 'placeAny'] }),
    ],
    { kind: 'friend', species: 'unicorn' }),
  r('skov', 2, 'w2-veksling', 'Vekselvandet', 'tal',
    [sk('add100Carry'), sk('sub100Borrow'), sk('missingPart100'), sk('inverseOps', { families: ['addToSub', 'subToAdd'] })],
    { kind: 'chest', item: 'kongelig-head' }, ['w1-tiere'], 8),
  r('skov', 3, 'w2-gange', 'Gangegrotten', 'tal',
    [sk('groupsOf'), sk('mul2510'), sk('shareEqually')], { kind: 'friend', species: 'panda' }),
  r('skov', 4, 'w2-klokken', 'Urtårnets top', 'klokken', [sk('clockQuarter')], { kind: 'chest', item: 'kongelig-face' }, ['w1-klokken']),
  r('skov', 5, 'w2-penge', 'Købmandsgården', 'pengeMaal',
    [
      sk('countCoins', { families: ['mixedTo100', 'biggestFirst'] }), sk('payExact', { families: ['to20', 'to50', 'to100'] }),
      sk('change', { families: ['from10', 'from20', 'from50'] }),
    ],
    { kind: 'friend', species: 'squirrel' }, ['w1-maal-penge'], 8),
  r('skov', 6, 'w2-hundreder', 'Hundredebroen', 'tal',
    [sk('addSub1000Round'), sk('skipCount', { families: ['step100'] }), sk('equalSides', { families: ['trueFalse', 'balanceAdd'] })],
    { kind: 'chest', item: 'kongelig-neck' }, ['w2-tal1000']),
  r('skov', 7, 'w2-maal-data', 'Linealstien', 'pengeMaal',
    [sk('rulerRead', { families: ['offset'] }), sk('unitChoice', { families: ['length'] }), sk('readChart')],
    { kind: 'friend', species: 'owl' }),
  r('skov', 8, 'w2-figurer', 'Figurhaven', 'figurer',
    [
      sk('composeShapes'), sk('symmetry', { families: ['mirrorGrid'] }), sk('shapes3D', { families: ['props'] }),
      sk('sortShapes', { families: ['fourEqualSides'] }), sk('fractionShape', { families: ['basic'] }),
    ],
    { kind: 'chest', item: 'kongelig-hand' }, ['w1-figurer']),

  // ── Stjernefjeldet (3. kl.) ──
  r('fjeld', 1, 'w3-tabellen', 'Tabeltoppen', 'tal',
    [sk('mul34'), sk('mul6to9'), sk('mulTens')], { kind: 'friend', species: 'pegasus' }, ['w2-gange']),
  r('fjeld', 2, 'w3-store-tal', 'Trecifret bro', 'tal',
    [
      sk('add1000'), sk('sub1000'), sk('numberLine1000', { families: ['round10', 'round100'] }),
      sk('placeValue1000', { families: ['regroup'] }),
    ],
    { kind: 'chest', item: 'astronaut-head' }, ['w2-hundreder'], 8),
  r('fjeld', 3, 'w3-klokken', 'Minuttårnet', 'klokken',
    [sk('clockFive'), sk('clockDigital'), sk('clockElapsed')], { kind: 'friend', species: 'dragon' }, ['w2-klokken'], 8),
  r('fjeld', 4, 'w3-division', 'Delekløften', 'tal',
    [
      sk('div2510'), sk('divAll'), sk('inverseOps', { families: ['mulToDiv'] }),
      sk('equalSides', { families: ['balanceSub', 'balanceMixed'] }),
    ],
    { kind: 'chest', item: 'astronaut-face' }, ['w3-tabellen']),
  r('fjeld', 5, 'w3-penge-maal', 'Markedet', 'pengeMaal',
    [
      sk('change', { families: ['from100'] }), sk('kronerOre'), sk('convertCmM'), sk('unitChoice', { families: ['weight'] }),
      sk('payExact', { families: ['fewestCoins'] }),
    ],
    { kind: 'friend', species: 'penguin' }, ['w2-penge'], 8),
  r('fjeld', 6, 'w3-areal', 'Arealhaven', 'figurer',
    [sk('area'), sk('gridCoords'), sk('sortShapes', { families: ['rightAngle'] }), sk('skipCount', { families: ['step25'] })],
    { kind: 'chest', item: 'astronaut-hand' }),
  r('fjeld', 7, 'w3-broeker', 'Brøkbageriet', 'figurer',
    [sk('fractionOfSet'), sk('fractionCompare'), sk('fractionShape', { families: ['nonUnit'] })],
    { kind: 'friend', species: 'polarbear' }, ['w2-figurer']),
]

const WORLD_LIST: readonly WorldDef[] = [
  { id: 'eng', grade: 0, name: 'Engdalen', nameClip: 'name.world.eng', regions: [],
    finaleItems: ['opdager-face', 'opdager-neck', 'opdager-body', 'opdager-back'] },
  { id: 'bakke', grade: 1, name: 'Hestebakkerne', nameClip: 'name.world.bakke', regions: [],
    finaleItems: ['rytter-neck', 'rytter-body', 'rytter-back'] },
  { id: 'skov', grade: 2, name: 'Regnbueskoven', nameClip: 'name.world.skov', regions: [],
    finaleItems: ['kongelig-body', 'kongelig-back'] },
  { id: 'fjeld', grade: 3, name: 'Stjernefjeldet', nameClip: 'name.world.fjeld', regions: [],
    finaleItems: ['astronaut-neck', 'astronaut-body', 'astronaut-back'] },
]

export const WORLDS: readonly WorldDef[] = WORLD_LIST.map((w) => ({
  ...w,
  regions: REGIONS.filter((reg) => reg.world === w.id).map((reg) => reg.id),
}))

const half = <T>(items: readonly T[]): [T[], T[]] => {
  if (items.length === 1) return [[...items], [...items]]
  const cut = Math.ceil(items.length / 2)
  return [items.slice(0, cut), items.slice(cut)]
}

function regionNodes(reg: RegionDef): NodeDef[] {
  const learn = reg.skills.filter((s) => !s.reviewOnly)
  const [first, second] = half(learn)
  const node = (slot: RegionNodeSlot, skills: RegionSkill[], extra: Partial<NodeDef> = {}): NodeDef => ({
    id: `${reg.id}-${slot}` as NodeId,
    world: reg.world,
    region: reg.id,
    slot,
    skills,
    production: 'normal',
    houseKind: null,
    size: reg.roundSize,
    review: 0,
    ...extra,
  })
  return [
    node('l1', first, { houseKind: 'choice' }),
    node('l2', second, { houseKind: 'choice' }),
    node(reg.node3.kind, reg.skills),
    node('l3', learn, { production: 'fromBox1' }),
    node('mix', reg.skills, { review: 3 }),
    node('trial', learn, { production: 'only', size: 10 }),
  ]
}

export const NODES: readonly NodeDef[] = WORLDS.flatMap((w) => [
  ...w.regions.flatMap((id) => regionNodes(REGIONS.find((reg) => reg.id === id)!)),
  {
    id: `${w.id}-finale` as NodeId,
    world: w.id,
    region: null,
    slot: 'finale' as const,
    skills: REGIONS.filter((reg) => reg.world === w.id).flatMap((reg) => reg.skills.filter((s) => !s.reviewOnly)),
    production: 'only' as const,
    houseKind: null,
    size: 12,
    review: 0,
  },
])

export const REGION_BY_ID: Readonly<Record<string, RegionDef>> = Object.fromEntries(REGIONS.map((reg) => [reg.id, reg]))
export const WORLD_BY_ID: Readonly<Record<WorldId, WorldDef>> = Object.fromEntries(WORLDS.map((w) => [w.id, w])) as Record<WorldId, WorldDef>
export const NODE_BY_ID: Readonly<Record<string, NodeDef>> = Object.fromEntries(NODES.map((n) => [n.id, n]))

export const nodesOfRegion = (region: RegionId): NodeDef[] => NODES.filter((n) => n.region === region)
export const regionsOfWorld = (world: WorldId): RegionDef[] => REGIONS.filter((reg) => reg.world === world)

/** Mastery trial pass marks (SPEC §5.4). */
export const TRIAL_PASS = { trial: { size: 10, pass: 8 }, finale: { size: 12, pass: 10 } } as const
