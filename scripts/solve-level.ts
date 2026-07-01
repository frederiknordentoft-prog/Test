import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LEVELS, getLevel } from '../data/levels'
import { solveLevel } from '../src/physics/solver'
import { simulate } from '../src/physics/simulate'
import { BALL_TYPES } from '../src/physics/constants'
import type { LevelDef } from '../src/types'

// ---------------------------------------------------------------------------
// `npm run solve:levels` — runs the headless deterministic solver against every
// shipped level (or a single level id passed as an argument), prints a report,
// writes solver-report.json, and exits non-zero if ANY level is unsolvable.
// This is the executable proof that the shipped pack is playable.
// ---------------------------------------------------------------------------

const MAX_SOLUTIONS = 50
const MAX_CANDIDATES = 500_000

type LevelReport = {
  levelId: string
  levelName: string
  solvable: boolean
  trivialEmptyWin: boolean
  solutionsFound: number
  candidatesTried: number
  stopReason: string
  example: { ballType: string; placements: { slotId: string; type: string; rotation: number }[] } | null
}

function describe(example: LevelReport['example']): string {
  if (!example) return '—'
  const pieces =
    example.placements.length === 0
      ? '(no pieces)'
      : example.placements.map((p) => `${p.slotId}=${p.type}#${p.rotation}`).join(', ')
  return `ball=${example.ballType} · ${pieces}`
}

function solveOne(level: LevelDef): LevelReport {
  const rep = solveLevel(level, { maxSolutions: MAX_SOLUTIONS, maxCandidates: MAX_CANDIDATES })
  // A level that wins with no pieces on ANY ball is not a real puzzle.
  const trivialEmptyWin = BALL_TYPES.some((b) => simulate(level, [], b).result === 'won')
  return {
    levelId: rep.levelId,
    levelName: rep.levelName,
    solvable: rep.solvable,
    trivialEmptyWin,
    solutionsFound: rep.solutionsFound,
    candidatesTried: rep.candidatesTried,
    stopReason: rep.stopReason,
    example: rep.example,
  }
}

function main(): void {
  const filter = process.argv[2]
  const levels = filter ? [getLevel(filter)].filter((l): l is LevelDef => !!l) : LEVELS

  if (filter && levels.length === 0) {
    console.error(`No level with id "${filter}". Known: ${LEVELS.map((l) => l.id).join(', ')}`)
    process.exitCode = 1
    return
  }

  const reports = levels.map(solveOne)

  console.log('Kuglebanen — solver report')
  console.log('='.repeat(72))
  for (const r of reports) {
    const status = r.solvable ? 'SOLVABLE  ' : 'UNSOLVABLE'
    const warn = r.trivialEmptyWin ? '  ⚠ trivial (wins with no pieces)' : ''
    console.log(
      `${r.levelId.padEnd(4)} ${r.levelName.padEnd(16)} ${status} ` +
        `solutions=${String(r.solutionsFound).padStart(2)} tried=${String(r.candidatesTried).padStart(5)} ` +
        `stop=${r.stopReason}${warn}`,
    )
    console.log(`     example: ${describe(r.example)}`)
  }
  console.log('='.repeat(72))

  const unsolvable = reports.filter((r) => !r.solvable)
  const trivial = reports.filter((r) => r.trivialEmptyWin)
  const allSolvable = unsolvable.length === 0
  const anyTrivial = trivial.length > 0

  const out = {
    generatedBy: 'npm run solve:levels',
    allSolvable,
    anyTrivial,
    levelCount: reports.length,
    levels: reports,
  }
  const outPath = resolve(process.cwd(), 'solver-report.json')
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${outPath}`)

  if (!allSolvable) {
    console.error(`\n✗ ${unsolvable.length} level(s) UNSOLVABLE: ${unsolvable.map((r) => r.levelId).join(', ')}`)
    process.exitCode = 1
    return
  }
  if (anyTrivial) {
    console.error(`\n✗ ${trivial.length} level(s) win with no pieces: ${trivial.map((r) => r.levelId).join(', ')}`)
    process.exitCode = 1
    return
  }
  console.log(`\n✓ All ${reports.length} levels solvable, each requires pieces.`)
}

main()
