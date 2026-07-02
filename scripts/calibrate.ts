/* Level-design calibration tool — run while authoring/tuning levels.
 *   npx tsx scripts/calibrate.ts map          → throw calibration map from a canonical slot
 *   npx tsx scripts/calibrate.ts <levelId>    → solver summary + diagnostics for one level
 *   npx tsx scripts/calibrate.ts <levelId> dump → + per-single-piece landing dump
 */
import { LEVELS, getLevel } from '../data/levels'
import { simulate } from '../src/physics/simulate'
import { solveLevel } from '../src/physics/solver'
import { ROTATION_DOMAINS, PIECE_TYPES } from '../src/physics/constants'
import type { BallType, LevelDef, PieceType, PlacedPiece } from '../src/types'

const mode = process.argv[2] ?? 'map'

// trace mode: npx tsx scripts/calibrate.ts trace <levelId> a=ramp#1,b=booster#0 [ball]
if (mode === 'trace') {
  const level = getLevel(process.argv[3] ?? '')
  if (!level) {
    console.error('trace: unknown level')
    process.exit(1)
  }
  const placements: PlacedPiece[] = (process.argv[4] ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => {
      const m = /^(\w+)=(\w+)#(\d+)$/.exec(s.trim())
      if (!m) throw new Error(`bad placement ${s}`)
      return { slotId: m[1]!, type: m[2] as PieceType, rotation: Number(m[3]) }
    })
  const ball = (process.argv[5] ?? level.balls[0]) as BallType
  const r = simulate(level, placements, ball)
  console.log(`${level.id} ${JSON.stringify(placements)} [${ball}] → ${r.result}/${r.reason}@${r.steps}`)
  console.log(`coins=${r.coinsCollected.join(',') || '—'} broke=${r.breakablesBroken.join(',') || '—'} firstContact=${r.firstPlayerContactTick}`)
  for (let i = 0; i < r.trajectory.length; i += 2) {
    const f = r.trajectory[i]!
    console.log(`${i} ${f.x.toFixed(1)} ${f.y.toFixed(1)}`)
  }
  const last = r.trajectory[r.trajectory.length - 1]!
  console.log(`${r.trajectory.length - 1} ${last.x.toFixed(1)} ${last.y.toFixed(1)} END`)
  process.exit(0)
}

function landing(level: LevelDef, placements: PlacedPiece[], ball: BallType) {
  const r = simulate(level, placements, ball)
  const last = r.trajectory[r.trajectory.length - 1]!
  const apex = r.trajectory.reduce((m, f) => Math.min(m, f.y), 1e9)
  return { r, last, apex }
}

if (mode === 'map') {
  // Canonical: 440×680 board, drop (220,24), slot (220,210) → what does each
  // piece+rotation do? Prints landing x, min y after contact (apex), and result.
  const base: LevelDef = {
    id: 'map',
    world: 1,
    name: 'map',
    intent: 'map',
    boardWidth: 440,
    boardHeight: 680,
    dropPoint: { x: 220, y: 24 },
    targetZone: { position: { x: 30, y: 30 }, radius: 6 },
    staticObstacles: [],
    slots: [{ id: 'a', position: { x: 220, y: 210 }, allowedTypes: [] }],
    inventory: { ramp: 1, bouncer: 1, funnel: 1, booster: 1 },
    balls: ['iron'],
  }
  for (const type of ['ramp', 'bouncer', 'funnel', 'booster'] as PieceType[]) {
    console.log(`\n${type} (slot 220,210 · drop 220,24 · iron):`)
    for (const rot of ROTATION_DOMAINS[type]) {
      const { r, last } = landing(base, [{ slotId: 'a', type, rotation: rot }], 'iron')
      const contact = r.firstPlayerContactTick ?? 0
      const after = r.trajectory.slice(contact)
      const apex = after.reduce((m, f) => Math.min(m, f.y), 1e9)
      const maxX = after.reduce((m, f) => Math.max(m, f.x), 0)
      const minX = after.reduce((m, f) => Math.min(m, f.x), 1e9)
      console.log(
        `  rot ${String(rot).padStart(2)} (${(rot * 22.5).toFixed(1).padStart(5)}°): ` +
          `land x=${last.x.toFixed(0).padStart(3)} y=${last.y.toFixed(0)} · apexY=${apex.toFixed(0).padStart(3)} ` +
          `xRange=[${minX.toFixed(0)},${maxX.toFixed(0)}] · ${r.reason} @${r.steps}`,
      )
    }
  }
  process.exit(0)
}

const level = getLevel(mode)
if (!level) {
  console.error(`Unknown level "${mode}". Known: ${LEVELS.map((l) => l.id).join(', ')}`)
  process.exit(1)
}

console.log(`${level.id} "${level.name}" (world ${level.world}) — ${level.intent}`)
console.log(`balls: ${level.balls.join(', ')} · coins: ${(level.coins ?? []).length} · slots: ${level.slots.length}`)

// Empty-drop landing per allowed ball (the "input" the player sees in preview).
for (const ball of level.balls) {
  const { r, last } = landing(level, [], ball)
  console.log(
    `  empty drop [${ball}]: lands (${last.x.toFixed(0)}, ${last.y.toFixed(0)}) ${r.reason}@${r.steps}` +
      `${r.result === 'won' ? '  ⚠ EMPTY WIN' : ''} coins=${r.coinsCollected.join(',') || '—'}`,
  )
}

const rep = solveLevel(level, { maxCandidates: 500_000 })
console.log(
  `solver: par=${rep.par} ★1=${rep.star1} ★2=${rep.star2} wins=${rep.star1Wins}/${rep.candidatesTried} ` +
    `density=${(rep.solutionDensity * 100).toFixed(2)}% stop=${rep.stopReason}`,
)
if (rep.example) {
  console.log(
    `example (par): ball=${rep.example.ballType} ` +
      rep.example.placements.map((p) => `${p.slotId}=${p.type}#${p.rotation}`).join(', '),
  )
}
if (rep.emptyWinBalls.length) console.log(`⚠ EMPTY WIN on: ${rep.emptyWinBalls.join(', ')}`)

if (process.argv[3] === 'dump') {
  console.log('\nSingle-piece landing dump:')
  for (const slot of level.slots) {
    for (const type of PIECE_TYPES) {
      if (!(level.inventory[type] ?? 0)) continue
      if (slot.allowedTypes.length && !slot.allowedTypes.includes(type)) continue
      for (const rot of ROTATION_DOMAINS[type]) {
        for (const ball of level.balls) {
          const place: PlacedPiece[] = [{ slotId: slot.id, type, rotation: rot }]
          const { r, last } = landing(level, place, ball)
          const mark = r.result === 'won' ? ' ✓WIN' : ''
          console.log(
            `  ${slot.id}=${type}#${String(rot).padStart(2)} [${ball.padEnd(10)}] → (${last.x.toFixed(0).padStart(3)}, ${last.y
              .toFixed(0)
              .padStart(3)}) ${r.reason}@${String(r.steps).padStart(3)} coins=${r.coinsCollected.join(',') || '—'} broke=${r.breakablesBroken.join(',') || '—'}${mark}`,
          )
        }
      }
    }
  }
}
