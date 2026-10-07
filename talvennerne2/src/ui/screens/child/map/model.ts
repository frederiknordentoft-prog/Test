// The map as data (SPEC §5.3–5.7, §13.9): what is open, done and next in a world, how far each
// region's colour has come back, the bridge of every trial, the lit huts, the stored round and the
// HUD. A pure function of the profile, so the map can never disagree with the unlock rules, and the
// tests read the same model the screen draws.
import {
  NODE_BY_ID, REGION_BY_ID, TRIAL_PASS, WORLDS, nodesOfRegion, regionsOfWorld,
  type NodeDef, type NodeSlot, type RegionDef,
} from '../../../../content/curriculum'
import { FRIENDSHIP_LEVELS, eggWarmthFor, friendshipLevel, levelProgress, titleFor, type TitleDef } from '../../../../content/economy'
import { placedStart } from '../../../../engine/ladder'
import { canAttemptTrial, helpBridgeOpen } from '../../../../engine/trial'
import {
  WORLD_IDS,
  type Animal, type ClipId, type Goal, type ItemId, type NodeId, type ProfileDoc, type RegionId, type RoundMode,
  type SpeciesId, type WorldId,
} from '../../../../engine/types'
import { wishProgress } from '../../../../meta/actions'
import { worldBuilt } from '../../../../meta/built'
import type { RegionTier } from '../../../../meta/rewards'
import {
  OPEN_REGIONS_PER_WORLD, hutRegions, isFinaleOpen, isNodeOpen, isRegionOpen, isWorldOpen, nodeDone, playedNodes,
  regionTier, requirementMet, trialPassed, worldComplete,
} from '../../../../meta/unlock'
import { isItemDrawn } from '../wardrobe/drawn'
import type { PlayTarget } from './nodes'

export type StoneState = 'locked' | 'open' | 'done'

export interface TrialView {
  attempts: number
  /** Best planks laid ("Bedst: 7 planker"). */
  best: number
  passed: boolean
  /** A new attempt needs a normal round first. */
  resting: boolean
  /** Planks that hold the bridge, and the trial's size. */
  pass: number
  size: number
  /** Taken before the region's lessons are done: "Spring over". */
  fromStart: boolean
  /** Three failed attempts: the rope bridge leads on anyway. */
  bridge: boolean
}

export interface StoneView {
  id: NodeId
  slot: NodeSlot
  region: RegionId | null
  state: StoneState
  /** Passed over by a trial taken from the region's start. */
  skipped: boolean
  stars: 0 | 1 | 2 | 3
  /** The suggested next stone of the world. */
  next: boolean
  /** Open and not resting: a tap can start it now. */
  playable: boolean
  friend?: { species: SpeciesId; met: boolean }
  chest?: { item: ItemId; opened: boolean }
  trial?: TrialView
}

/** Why a region is closed: a trial in its chain, more stones elsewhere, or its world. */
export type RegionLock = { kind: 'requires'; regions: RegionId[] } | { kind: 'more' } | { kind: 'world' }

export interface RegionView {
  id: RegionId
  index: number
  nameClip: ClipId
  open: boolean
  lock: RegionLock | null
  tier: RegionTier
  /** Opened by the child's own progress and not visited yet ("Nyt sted!"). */
  fresh: boolean
  played: number
  stones: StoneView[]
  hut: boolean
}

export interface WorldView {
  id: WorldId
  nameClip: ClipId
  /** Unlocked and built. */
  open: boolean
  /** Not built yet (src/meta/built.ts): "Kommer snart", whatever the child has unlocked. */
  soon: boolean
}

export interface Hud {
  level: number
  title: TitleDef
  /** 0–1 towards the next level. */
  levelProgress: number
  perler: number
  /** 0–1 egg warmth; the egg is ready at 1. */
  egg: number
  eggReady: boolean
  /** 0–1 towards the buddy's next friendship level, or null without a buddy. */
  heart: number | null
  /** 0–1 towards the pinned wish, or null without one. */
  wish: number | null
}

export interface MapModel {
  world: WorldId
  worlds: WorldView[]
  regions: RegionView[]
  finale: StoneView
  /** The next world, shown on the horizon after the finale (null after the last). */
  beyond: WorldView | null
  next: NodeId | null
  /** The stored round ("Fortsæt turen"). */
  resume: { target: PlayTarget; mode: RoundMode } | null
  /** Lit training huts in this world. */
  huts: RegionId[]
  goals: Goal[]
  buddy: Animal | null
  hud: Hud
}

const trialId = (node: NodeDef): RegionId | WorldId => (node.slot === 'finale' ? node.world : node.region!)

/** A stone can be started now: open, and a trial not waiting for a normal round first. */
export function playable(p: ProfileDoc, target: PlayTarget, hutRegion?: RegionId | null): boolean {
  if (target === 'practice') return true
  if (target === 'hut') return litHut(p, hutRegion) !== null
  const node = NODE_BY_ID[target]
  return !!node && worldBuilt(node.world) && startable(p, node)
}

/** An open stone, and not a trial waiting for a normal round first. */
function startable(p: ProfileDoc, node: NodeDef): boolean {
  if (!isNodeOpen(p, node.id)) return false
  if (node.slot !== 'trial' && node.slot !== 'finale') return true
  const id = trialId(node)
  return trialPassed(p, id) || canAttemptTrial(p.trials[id], p.roundIndex)
}

/** The hut to play: `prefer` when it is lit, else the hut of the most recently failed trial. */
export function litHut(p: Pick<ProfileDoc, 'trials'>, prefer?: RegionId | null): RegionId | null {
  const lit = hutRegions(p)
  if (prefer && lit.includes(prefer)) return prefer
  let best: RegionId | null = null
  for (const r of lit) if (!best || (p.trials[r]?.lastAttemptRound ?? 0) > (p.trials[best]?.lastAttemptRound ?? 0)) best = r
  return best
}

function trialView(p: ProfileDoc, node: NodeDef): TrialView {
  const id = trialId(node)
  const state = p.trials[id]
  const passed = trialPassed(p, id)
  const pass = node.slot === 'finale' ? TRIAL_PASS.finale : TRIAL_PASS.trial
  const lessons = node.region ? nodesOfRegion(node.region).filter((n) => n.slot !== 'trial') : []
  return {
    attempts: state?.attempts ?? 0,
    best: state?.best ?? 0,
    passed,
    resting: !passed && !canAttemptTrial(state, p.roundIndex),
    pass: pass.pass,
    size: pass.size,
    fromStart: !passed && lessons.some((n) => !nodeDone(p, n.id)),
    bridge: helpBridgeOpen(state),
  }
}

function stoneView(p: ProfileDoc, node: NodeDef, open: boolean): StoneView {
  const progress = p.nodes[node.id]
  const done = nodeDone(p, node.id)
  const region = node.region ? REGION_BY_ID[node.region] : undefined
  const view: StoneView = {
    id: node.id,
    slot: node.slot,
    region: node.region,
    state: !open ? 'locked' : done ? 'done' : 'open',
    skipped: !!progress?.skipped && (progress.plays ?? 0) === 0,
    stars: progress?.stars ?? 0,
    next: false,
    playable: open && startable(p, node),
  }
  if (node.slot === 'friend' && region?.node3.kind === 'friend') {
    view.friend = { species: region.node3.species, met: (progress?.plays ?? 0) > 0 }
  }
  if (node.slot === 'chest' && region?.node3.kind === 'chest') {
    view.chest = { item: region.node3.item, opened: (progress?.plays ?? 0) > 0 || !!p.inventory[region.node3.item] }
  }
  if (node.slot === 'trial' || node.slot === 'finale') {
    view.trial = trialView(p, node)
    // a trial that has been played counts as done only once it holds
    if (open) view.state = view.trial.passed ? 'done' : 'open'
  }
  return view
}

function regionLock(p: ProfileDoc, def: RegionDef): RegionLock | null {
  if (isRegionOpen(p, def.id)) return null
  if (!isWorldOpen(p, def.world)) return { kind: 'world' }
  const unmet = def.requires.filter((r) => !requirementMet(p, r))
  if (unmet.length > 0) return { kind: 'requires', regions: unmet }
  return { kind: 'more' }
}

/**
 * The suggested next stone: the first open stone not done, region by region; a ready trial after its
 * lessons. `later`: the regions a finished placement passed over come last (their friend, chest and
 * trial still wait), so the map suggests the stone the placement started the child on (SPEC A24).
 */
function nextStone(regions: readonly RegionView[], finale: StoneView, later?: ReadonlySet<RegionId>): NodeId | null {
  const order = later ? [...regions.filter((r) => !later.has(r.id)), ...regions.filter((r) => later.has(r.id))] : regions
  for (const r of order) {
    if (!r.open) continue
    const trial = r.stones.find((s) => s.slot === 'trial')
    const lesson = r.stones.find((s) => s.slot !== 'trial' && s.state === 'open' && s.playable)
    if (lesson) return lesson.id
    if (trial && trial.state === 'open' && trial.playable && !trial.trial?.passed) return trial.id
  }
  if (finale.state === 'open' && finale.playable && !finale.trial?.passed) return finale.id
  return null
}

function heartOf(buddy: Animal | null): number | null {
  if (!buddy) return null
  const level = friendshipLevel(buddy.friendship)
  if (level >= FRIENDSHIP_LEVELS.length) return 1
  const from = FRIENDSHIP_LEVELS[level - 1]
  const to = FRIENDSHIP_LEVELS[level]
  return Math.max(0, Math.min(1, (buddy.friendship - from) / (to - from)))
}

/**
 * The world shown when none is asked for: the furthest open (and built) one with something left to
 * do. After a finished placement (SPEC A24) no further than the world it put the child in, until the
 * child completes that world the usual way (worldComplete, the rule that opens the next world), and
 * so on up: the worlds above, which the grade opened, are a tap away in the world picker.
 */
export function homeWorld(p: ProfileDoc, built: (w: WorldId) => boolean = worldBuilt): WorldId {
  const top = homeLimit(p)
  const open = WORLD_IDS.filter((w, i) => i <= top && isWorldOpen(p, w) && built(w))
  for (const w of [...open].reverse()) {
    const m = mapModel(p, w, built)
    if (m.next) return w
  }
  return open[open.length - 1] ?? 'eng'
}

/** The furthest world (index in WORLD_IDS) the home world may be: the placement's, and each one completed from there. */
function homeLimit(p: ProfileDoc): number {
  const placed = placedStart(p.placement)
  if (!placed) return WORLD_IDS.length - 1
  let i = WORLD_IDS.indexOf(placed.world)
  while (i + 1 < WORLD_IDS.length && worldComplete(p, WORLD_IDS[i])) i++
  return i
}

/** `built`: which worlds can be entered (src/meta/built.ts); tests hand in their own. */
export function mapModel(p: ProfileDoc, world: WorldId, built: (w: WorldId) => boolean = worldBuilt): MapModel {
  const here = built(world)
  const regions: RegionView[] = regionsOfWorld(world).map((def) => {
    const open = here && isRegionOpen(p, def.id)
    const played = playedNodes(p, def.id)
    return {
      id: def.id,
      index: def.index,
      nameClip: def.nameClip,
      open,
      lock: here ? regionLock(p, def) : { kind: 'world' },
      tier: regionTier(p, def.id),
      fresh: open && played === 0 && !(def.world === 'eng' && def.index <= OPEN_REGIONS_PER_WORLD),
      played,
      stones: nodesOfRegion(def.id).map((n) => stoneView(p, n, open && isNodeOpen(p, n.id))),
      hut: hutRegions(p).includes(def.id),
    }
  })
  const finaleNode = NODE_BY_ID[`${world}-finale`]
  const finale = stoneView(p, finaleNode, here && isFinaleOpen(p, world))
  const next = nextStone(regions, finale, placedStart(p.placement)?.over)
  for (const r of regions) for (const s of r.stones) s.next = s.id === next
  finale.next = finale.id === next

  const i = WORLD_IDS.indexOf(world)
  const worlds: WorldView[] = WORLDS.map((w) => ({
    id: w.id, nameClip: w.nameClip, open: built(w.id) && isWorldOpen(p, w.id), soon: !built(w.id),
  }))
  const buddy = p.animals.find((a) => a.uid === p.buddyUid) ?? null
  const need = eggWarmthFor(p.economy.eggsHatched + 1)
  const round = p.round && p.round.nodeId !== 'placement' ? p.round : null
  return {
    world,
    worlds,
    regions,
    finale,
    beyond: worlds[i + 1] ?? null,
    next,
    resume: round ? { target: round.nodeId as PlayTarget, mode: round.mode } : null,
    huts: regions.filter((r) => r.hut).map((r) => r.id),
    goals: p.goals.list,
    buddy,
    hud: {
      level: p.economy.level,
      title: titleFor(p.economy.level),
      levelProgress: levelProgress(p.economy.xp),
      perler: p.economy.perler,
      egg: Math.min(1, p.economy.eggWarmth / need),
      eggReady: p.economy.eggWarmth >= need,
      heart: heartOf(buddy),
      // a wish for a thing that is not drawn yet waits out of sight, like in the shop
      wish: p.economy.wish && isItemDrawn(p.economy.wish) ? wishProgress(p) : null,
    },
  }
}
