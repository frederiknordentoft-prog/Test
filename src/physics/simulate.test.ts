import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { LEVELS, getLevel } from '../../data/levels'
import { previewRun, simulate } from './simulate'
import { solveLevel } from './solver'
import { BOOST_SPEED, ROTATION_DOMAINS } from './constants'
import { inventoryTypes } from '../game/inventory'
import type { BallType, LevelDef, PlacedPiece } from '../types'

// The exhaustive search lives in `npm run solve:levels` (which writes the
// report below). These tests cross-check the committed report against the
// current physics + levels and prove the core mechanics — and stay fast.

type ReportLevel = {
  levelId: string
  world: number
  par: number
  star1: boolean
  star2: boolean
  star3: boolean
  solutionDensity: number
  example: { ballType: BallType; placements: PlacedPiece[] } | null
}
type SolverReport = { allPass: boolean; levelCount: number; levels: ReportLevel[] }

const report = JSON.parse(
  readFileSync(resolve(process.cwd(), 'solver-report.json'), 'utf8'),
) as SolverReport

/** Synthetic kitchen-sink level exercising EVERY mechanic in one world. */
const MECHANICS_LEVEL: LevelDef = {
  id: 'test-all',
  world: 1,
  name: 'test',
  intent: 'test',
  boardWidth: 440,
  boardHeight: 680,
  dropPoint: { x: 220, y: 24 },
  targetZone: { position: { x: 30, y: 30 }, radius: 10 },
  staticObstacles: [{ position: { x: 380, y: 300 }, shape: 'peg', size: { x: 10 } }],
  breakables: [{ id: 'p1', position: { x: 220, y: 320 }, size: { x: 45, y: 6 }, breakImpulse: 30 }],
  coins: [
    { id: 'c1', position: { x: 220, y: 200 }, radius: 12 },
    { id: 'c2', position: { x: 260, y: 500 }, radius: 12 },
  ],
  portalExit: { position: { x: 80, y: 120 }, rotation: Math.PI / 4 },
  slots: [
    { id: 'a', position: { x: 220, y: 220 }, allowedTypes: [] },
    { id: 'b', position: { x: 320, y: 420 }, allowedTypes: [] },
  ],
  inventory: { ramp: 1, booster: 1, portal: 1 },
  balls: ['iron', 'wood', 'basketball'],
}

const MECHANICS_PLACEMENTS: PlacedPiece[] = [
  { slotId: 'a', type: 'ramp', rotation: 3 },
  { slotId: 'b', type: 'booster', rotation: 10 },
]

function fingerprint(level: LevelDef, placements: PlacedPiece[], ball: BallType): string {
  // Full SimResult — trajectory floats, spin, coins, breaks, contact tick.
  return JSON.stringify(simulate(level, placements, ball))
}

describe('deterministic simulation 2.0', () => {
  it('is bit-identical across two runs with every mechanic active, for every ball', () => {
    for (const ball of MECHANICS_LEVEL.balls) {
      expect(fingerprint(MECHANICS_LEVEL, MECHANICS_PLACEMENTS, ball)).toBe(
        fingerprint(MECHANICS_LEVEL, MECHANICS_PLACEMENTS, ball),
      )
    }
  })

  it('is deterministic for every shipped level, single placement, and allowed ball', () => {
    for (const lvl of LEVELS) {
      const candidates: PlacedPiece[][] = [[]]
      for (const slot of lvl.slots) {
        for (const type of inventoryTypes(lvl)) {
          if (slot.allowedTypes.length && !slot.allowedTypes.includes(type)) continue
          for (const rot of ROTATION_DOMAINS[type]) {
            candidates.push([{ slotId: slot.id, type, rotation: rot }])
          }
        }
      }
      for (const ball of lvl.balls) {
        for (const placement of candidates) {
          expect(fingerprint(lvl, placement, ball), `${lvl.id} ${ball} ${JSON.stringify(placement)}`).toBe(
            fingerprint(lvl, placement, ball),
          )
        }
      }
    }
  })

  it('different ball types produce different trajectories', () => {
    const iron = simulate(MECHANICS_LEVEL, MECHANICS_PLACEMENTS, 'iron')
    const basketball = simulate(MECHANICS_LEVEL, MECHANICS_PLACEMENTS, 'basketball')
    expect(JSON.stringify(iron.trajectory)).not.toBe(JSON.stringify(basketball.trajectory))
  })

  it('does not depend on the order of the placements array', () => {
    const [p1, p2] = MECHANICS_PLACEMENTS as [PlacedPiece, PlacedPiece]
    expect(fingerprint(MECHANICS_LEVEL, [p1, p2], 'iron')).toBe(fingerprint(MECHANICS_LEVEL, [p2, p1], 'iron'))
  })
})

describe('mechanics semantics (kravspec §4)', () => {
  it('breakable: iron smashes the plank, basketball and slow wood never do', () => {
    const level: LevelDef = { ...MECHANICS_LEVEL, slots: [], inventory: {}, coins: [], portalExit: undefined }
    const iron = simulate(level, [], 'iron')
    expect(iron.breakablesBroken).toEqual(['p1'])
    expect(iron.breakTicks).toHaveLength(1)
    const basketball = simulate(level, [], 'basketball')
    expect(basketball.breakablesBroken).toEqual([])
    // Slow wood (short fall onto the plank) must bounce, not break.
    const shortFall: LevelDef = {
      ...level,
      breakables: [{ id: 'p1', position: { x: 220, y: 120 }, size: { x: 45, y: 6 }, breakImpulse: 30 }],
    }
    expect(simulate(shortFall, [], 'wood').breakablesBroken).toEqual([])
  })

  it('portal: teleports between frames, preserves speed, fires along the exit angle', () => {
    const level: LevelDef = {
      ...MECHANICS_LEVEL,
      breakables: [],
      coins: [],
      portalExit: { position: { x: 100, y: 500 }, rotation: -Math.PI / 2 }, // straight up
      slots: [{ id: 'a', position: { x: 220, y: 300 }, allowedTypes: [] }],
      inventory: { portal: 1 },
    }
    const r = simulate(level, [{ slotId: 'a', type: 'portal', rotation: 0 }], 'iron')
    const t = r.firstPlayerContactTick
    expect(t).not.toBeNull()
    const atEntry = r.trajectory[t!]!
    const afterA = r.trajectory[t! + 1]!
    const afterB = r.trajectory[t! + 2]!
    // Frame at t keeps the pre-teleport pose near the entry; t+1 is at the exit.
    expect(Math.hypot(atEntry.x - 220, atEntry.y - 300)).toBeLessThanOrEqual(16)
    expect(Math.hypot(afterA.x - 100, afterA.y - 500)).toBeLessThan(30)
    // Exit velocity points straight up (negative y, ~zero x drift).
    expect(afterB.y).toBeLessThan(afterA.y)
    expect(Math.abs(afterB.x - afterA.x)).toBeLessThan(0.5)
  })

  it('booster: sets the ball speed to at least BOOST_SPEED along its axis', () => {
    const level: LevelDef = {
      ...MECHANICS_LEVEL,
      breakables: [],
      coins: [],
      portalExit: undefined,
      slots: [{ id: 'a', position: { x: 220, y: 300 }, allowedTypes: [] }],
      inventory: { booster: 1 },
    }
    const r = simulate(level, [{ slotId: 'a', type: 'booster', rotation: 0 }], 'iron') // fires +x
    const t = r.firstPlayerContactTick!
    const a = r.trajectory[t + 2]!
    const b = r.trajectory[t + 3]!
    const vx = b.x - a.x
    expect(vx).toBeGreaterThan(BOOST_SPEED * 0.85)
  })

  it('coins: collected in path order with recorded ticks; off-path coins stay', () => {
    const level: LevelDef = {
      ...MECHANICS_LEVEL,
      breakables: [],
      portalExit: undefined,
      slots: [],
      inventory: {},
      coins: [
        { id: 'high', position: { x: 220, y: 200 }, radius: 12 },
        { id: 'low', position: { x: 220, y: 420 }, radius: 12 },
        { id: 'far', position: { x: 60, y: 300 }, radius: 12 },
      ],
    }
    const r = simulate(level, [], 'iron')
    expect(r.coinsCollected).toEqual(['high', 'low'])
    expect(r.coinTicks).toHaveLength(2)
    expect(r.coinTicks[0]!).toBeLessThan(r.coinTicks[1]!)
  })
})

describe('ghost preview (kravspec §4.5)', () => {
  it('is an EXACT prefix of the real run, cut at the first player-piece contact', () => {
    const cases: { level: LevelDef; placements: PlacedPiece[]; ball: BallType }[] = [
      { level: MECHANICS_LEVEL, placements: MECHANICS_PLACEMENTS, ball: 'iron' },
      { level: MECHANICS_LEVEL, placements: MECHANICS_PLACEMENTS, ball: 'basketball' },
      { level: getLevel('k1')!, placements: [{ slotId: 'a', type: 'ramp', rotation: 1 }], ball: 'iron' },
      { level: getLevel('k14')!, placements: [{ slotId: 'b', type: 'portal', rotation: 0 }], ball: 'iron' },
    ]
    for (const c of cases) {
      const p = previewRun(c.level, c.placements, c.ball)
      const real = simulate(c.level, c.placements, c.ball)
      expect(JSON.stringify(p.frames)).toBe(JSON.stringify(real.trajectory.slice(0, p.frames.length)))
      if (real.firstPlayerContactTick !== null) {
        expect(p.cut).toBe(true)
        expect(p.frames.length).toBe(real.firstPlayerContactTick + 1)
      }
    }
  })

  it('shows the whole run when no player piece is ever touched', () => {
    const p = previewRun(getLevel('k1')!, [], 'iron')
    const real = simulate(getLevel('k1')!, [], 'iron')
    expect(p.cut).toBe(false)
    expect(p.frames.length).toBe(real.trajectory.length)
  })
})

describe('shipped level pack (report-driven)', () => {
  it('the committed solver report covers all 14 levels and passes', () => {
    expect(report.levelCount).toBe(14)
    expect(report.levels.length).toBe(LEVELS.length)
    expect(report.allPass, 'solver-report.json allPass — re-run npm run solve:levels').toBe(true)
  })

  it('every level proves ★1/★2/★3 with par ≤ 3', () => {
    for (const entry of report.levels) {
      expect(entry.star1, `${entry.levelId} ★1`).toBe(true)
      expect(entry.star2, `${entry.levelId} ★2`).toBe(true)
      expect(entry.star3, `${entry.levelId} ★3`).toBe(true)
      expect(entry.par, `${entry.levelId} par`).toBeGreaterThanOrEqual(1)
      expect(entry.par, `${entry.levelId} par`).toBeLessThanOrEqual(3)
    }
  })

  it("each level's example is a live ★2 win at par (report vs. physics)", () => {
    for (const entry of report.levels) {
      const level = getLevel(entry.levelId)
      expect(level, `level ${entry.levelId} exists`).toBeTruthy()
      const ex = entry.example
      expect(ex, `${entry.levelId} has an example`).toBeTruthy()
      expect(ex!.placements.length, `${entry.levelId} example is at par`).toBe(entry.par)
      const r = simulate(level!, ex!.placements, ex!.ballType)
      expect(r.result, `${entry.levelId} example must win — re-run npm run solve:levels`).toBe('won')
      expect(r.coinsCollected.length, `${entry.levelId} example collects all coins`).toBe(
        (level!.coins ?? []).length,
      )
    }
  })

  it('no level can be won with zero pieces on any allowed ball', () => {
    for (const lvl of LEVELS) {
      for (const ball of lvl.balls) {
        expect(simulate(lvl, [], ball).result, `${lvl.id} must not win empty on ${ball}`).not.toBe('won')
      }
    }
  })

  it('solution density falls strictly within each world (the difficulty curve)', () => {
    for (const world of [1, 2, 3]) {
      const inWorld = report.levels.filter((l) => l.world === world)
      expect(inWorld.length).toBeGreaterThan(0)
      for (let i = 1; i < inWorld.length; i++) {
        expect(
          inWorld[i]!.solutionDensity,
          `${inWorld[i]!.levelId} density < ${inWorld[i - 1]!.levelId}`,
        ).toBeLessThan(inWorld[i - 1]!.solutionDensity)
      }
    }
  })

  it('the solver derives par=1 and a winning example for the first level', () => {
    const k1 = getLevel('k1')!
    const rep = solveLevel(k1)
    expect(rep.star2).toBe(true)
    expect(rep.par).toBe(1)
    expect(simulate(k1, rep.example!.placements, rep.example!.ballType).result).toBe('won')
  })
})
