import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LEVELS, getLevel } from '../data/levels'
import { solveLevel, type LevelSolveReport } from '../src/physics/solver'
import { PIECE_TYPES } from '../src/physics/constants'
import type { LevelDef } from '../src/types'

// ---------------------------------------------------------------------------
// `npm run solve:levels` — the executable proof that the shipped pack is a
// real, playable, star-complete puzzle set. For every level (or a single id
// passed as an argument) it exhaustively solves the search space and enforces:
//   · structural limits (≤5 slots, ≤4 pieces, ≤1 portal, portalExit ⇔ portal,
//     1–3 balls, unique coin/breakable ids)
//   · ★1, ★2 and ★3 achievable; par ≤ 3
//   · no level winnable with 0 pieces on ANY allowed ball
//   · solution density strictly decreasing within each world (the curve)
//   · the whole pack verified within the 5-minute budget
// It writes solver-report.json (consumed by the fast vitest suite) and exits
// non-zero if ANY guarantee fails. Fix the level — never this verifier.
// ---------------------------------------------------------------------------

const MAX_CANDIDATES = 500_000
const PER_LEVEL_BUDGET_MS = 240_000
const PACK_BUDGET_MS = 300_000
const PAR_MAX = 3
const EXPECTED_LEVEL_COUNT = 14

type Failure = { levelId: string; problem: string }

function validateStructure(level: LevelDef): string[] {
  const problems: string[] = []
  if (level.slots.length > 5) problems.push(`has ${level.slots.length} slots (max 5)`)
  const totalInventory = PIECE_TYPES.reduce((s, t) => s + (level.inventory[t] ?? 0), 0)
  if (totalInventory > 4) problems.push(`inventory total ${totalInventory} (max 4)`)
  if ((level.inventory.portal ?? 0) > 1) problems.push('more than one portal in inventory')
  if ((level.inventory.portal ?? 0) > 0 && !level.portalExit)
    problems.push('portal in inventory but no portalExit authored')
  if (!(level.inventory.portal ?? 0) && level.portalExit)
    problems.push('portalExit authored but no portal in inventory')
  if (level.balls.length < 1 || level.balls.length > 3)
    problems.push(`offers ${level.balls.length} balls (must be 1–3)`)
  if (new Set(level.balls).size !== level.balls.length) problems.push('duplicate balls')
  const coinIds = (level.coins ?? []).map((c) => c.id)
  if (new Set(coinIds).size !== coinIds.length) problems.push('duplicate coin ids')
  const breakIds = (level.breakables ?? []).map((b) => b.id)
  if (new Set(breakIds).size !== breakIds.length) problems.push('duplicate breakable ids')
  const slotIds = level.slots.map((s) => s.id)
  if (new Set(slotIds).size !== slotIds.length) problems.push('duplicate slot ids')
  return problems
}

function fmtDensity(d: number): string {
  return (d * 100).toFixed(2) + '%'
}

function describeExample(r: LevelSolveReport): string {
  if (!r.example) return '—'
  const pieces =
    r.example.placements.length === 0
      ? '(no pieces)'
      : r.example.placements.map((p) => `${p.slotId}=${p.type}#${p.rotation}`).join(', ')
  return `ball=${r.example.ballType} · ${pieces}`
}

function main(): void {
  const filter = process.argv[2]
  const levels = filter ? [getLevel(filter)].filter((l): l is LevelDef => !!l) : LEVELS

  if (filter && levels.length === 0) {
    console.error(`No level with id "${filter}". Known: ${LEVELS.map((l) => l.id).join(', ')}`)
    process.exitCode = 1
    return
  }

  const failures: Failure[] = []
  const packStart = Date.now()

  console.log('Kuglebanen 2.0 — solver report')
  console.log('='.repeat(100))

  const reports: LevelSolveReport[] = []
  for (const level of levels) {
    for (const p of validateStructure(level)) failures.push({ levelId: level.id, problem: p })

    const r = solveLevel(level, {
      maxCandidates: MAX_CANDIDATES,
      timeBudgetMs: PER_LEVEL_BUDGET_MS,
      now: Date.now,
    })
    reports.push(r)

    if (!r.star1) failures.push({ levelId: level.id, problem: 'no winning assignment (★1 unreachable)' })
    if (!r.star2) failures.push({ levelId: level.id, problem: 'no coin-complete win (★2/★3 unreachable)' })
    if (r.par > PAR_MAX) failures.push({ levelId: level.id, problem: `par ${r.par} exceeds ${PAR_MAX}` })
    if (r.emptyWinBalls.length > 0)
      failures.push({ levelId: level.id, problem: `wins with 0 pieces on: ${r.emptyWinBalls.join(', ')}` })
    if (r.stopReason !== 'exhausted')
      failures.push({ levelId: level.id, problem: `search not exhausted (${r.stopReason}) — density not comparable` })

    const stars = `${r.star1 ? '★' : '☆'}${r.star2 ? '★' : '☆'}${r.star3 ? '★' : '☆'}`
    console.log(
      `${level.id.padEnd(4)} w${level.world} ${level.name.padEnd(18)} ${stars} par=${String(r.par).padStart(2)} ` +
        `density=${fmtDensity(r.solutionDensity).padStart(7)} wins=${String(r.star1Wins).padStart(4)} ` +
        `tried=${String(r.candidatesTried).padStart(6)} ${String(r.elapsedMs).padStart(6)}ms ${r.stopReason}`,
    )
    console.log(`     example: ${describeExample(r)}`)
  }

  // Density must fall strictly within each world (the measured difficulty curve).
  if (!filter) {
    for (const world of [1, 2, 3]) {
      const inWorld = reports.filter((r) => r.world === world)
      for (let i = 1; i < inWorld.length; i++) {
        const prev = inWorld[i - 1]!
        const cur = inWorld[i]!
        if (cur.solutionDensity >= prev.solutionDensity) {
          failures.push({
            levelId: cur.levelId,
            problem: `density ${fmtDensity(cur.solutionDensity)} not below ${prev.levelId}'s ${fmtDensity(prev.solutionDensity)} (world ${world} curve must fall)`,
          })
        }
      }
    }
    if (reports.length !== EXPECTED_LEVEL_COUNT) {
      failures.push({ levelId: 'pack', problem: `expected ${EXPECTED_LEVEL_COUNT} levels, found ${reports.length}` })
    }
  }

  const totalElapsedMs = Date.now() - packStart
  if (!filter && totalElapsedMs > PACK_BUDGET_MS) {
    failures.push({
      levelId: 'pack',
      problem: `pack verification took ${(totalElapsedMs / 1000).toFixed(0)}s (budget ${PACK_BUDGET_MS / 1000}s) — simplify a level's search space`,
    })
  }

  console.log('='.repeat(100))
  console.log(`Pack verified in ${(totalElapsedMs / 1000).toFixed(1)}s`)

  const allPass = failures.length === 0
  const out = {
    generatedBy: 'npm run solve:levels',
    allPass,
    levelCount: reports.length,
    totalElapsedMs,
    failures,
    levels: reports,
  }
  // A filtered run is a design aid — never overwrite the committed pack report.
  if (!filter) {
    const outPath = resolve(process.cwd(), 'solver-report.json')
    writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
    console.log(`Wrote ${outPath}`)
  }

  if (!allPass) {
    console.error(`\n✗ ${failures.length} problem(s):`)
    for (const f of failures) console.error(`  ${f.levelId}: ${f.problem}`)
    process.exitCode = 1
    return
  }
  console.log(`\n✓ All ${reports.length} levels: ★1/★2/★3 proven, par ≤ ${PAR_MAX}, no empty wins, density curve falls per world.`)
}

main()
