import { describe, expect, it, vi } from 'vitest'
import { NODE_BY_ID, REGIONS } from '../../../../content/curriculum'
import { learningDay } from '../../../../engine/learningDay'
import { ceilingFor, isProduction } from '../../../../engine/kinds'
import { updateKey } from '../../../../engine/mastery'
import { seedFromPlacement } from '../../../../engine/placement'
import { OWN_SHARE_MIN, bumpNewToday, planRound } from '../../../../engine/plan'
import { skillKeys, skillRegistry } from '../../../../engine/registry'
import { keyAt, newProfile } from '../../../../engine/testing/profile'
import type { KeyState, NodeId, ProfileDoc, WorldId } from '../../../../engine/types'
import { chooseStart, type StartContext } from './prepare'

// Stjernefjeldet is built but not released yet: these tests play it as after the release.
vi.mock('../../../../meta/built', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../meta/built')>()
  return { ...real, worldBuilt: () => true }
})

/**
 * QA3c P2-1: a stone with few keys of its own (Tabeltoppen's "Lær mere" is mulTens alone, two keys)
 * was filled with other skills' review on a fresh learning day, so it was under half its own and
 * answered "Her er der nyt i morgen" every day, though none of today's new keys were used. SPEC A15
 * says that only when today's new keys are used up (A13). Now the stone's own keys come first,
 * repeated, until they are half of the round; only today's allowance stops a stone never played.
 */

const reg = skillRegistry()
const START = Date.parse('2026-10-10T10:00:00')
const at = (d: number) => START + d * 86_400_000
const ctx = (now: number): StartContext => ({ sessionId: 's-test', audioVerified: true, now })
const ALL_WORLDS: WorldId[] = ['eng', 'bakke', 'skov', 'fjeld']
const unlocked = { worlds: ALL_WORLDS, regions: REGIONS.map((r) => r.id) }

/** A 3. klasse child sure of everything below Stjernefjeldet (box 3–4), met on an earlier day. */
function strongChild(over: Partial<ProfileDoc> = {}): ProfileDoc {
  const keys: Record<string, KeyState> = {}
  const day = learningDay(at(-3))
  for (const r of REGIONS) {
    if (r.world === 'fjeld') continue
    for (const s of r.skills) {
      const def = reg.get(s.skill)
      if (def) for (const k of skillKeys(def)) keys[k] = keyAt(3 + (k.length % 2), day, 5)
    }
  }
  return newProfile({
    id: 'p-strong', grade: 3, unlocked, keys, roundIndex: 12,
    nodes: { 'w3-tabellen-l1': { plays: 1, stars: 3, skipped: false, lastAt: at(-1) } },
    newToday: { day: learningDay(at(-1)), total: 11, perSkill: { mul34: 10, mul6to9: 1 } },
    ...over,
  })
}

describe('a stone with few keys of its own on a fresh learning day (QA3c P2-1)', () => {
  it('starts Tabeltoppen\'s "Lær mere" with half or more of the round its own', () => {
    const p = strongChild()
    const now = at(0)
    const start = chooseStart('w3-tabellen-l2', p, ctx(now))
    expect(start.kind).toBe('plan')
    const plan = planRound(NODE_BY_ID['w3-tabellen-l2'], p, { day: learningDay(now), sessionId: 's', audioVerified: true })
    expect(plan.capped).toBe(false)
    expect(plan.ownShare).toBeGreaterThanOrEqual(OWN_SHARE_MIN)
    expect(plan.tasks).toHaveLength(10)
    // its own two keys, each asked again (another way where it can), and the rest review of sure keys
    const own = plan.tasks.filter((t) => t.skill === 'mulTens')
    expect(new Set(own.map((t) => t.masteryKey)).size).toBe(2)
    expect(own.length).toBe(5)
    for (const t of plan.tasks.filter((x) => x.skill !== 'mulTens')) expect(p.keys[t.masteryKey]?.box ?? 0).toBeGreaterThanOrEqual(3)
    // never the same key twice in a row
    for (let i = 1; i < plan.tasks.length; i++) expect(plan.tasks[i].masteryKey).not.toBe(plan.tasks[i - 1].masteryKey)
    // nothing new beyond the stone's own keys
    expect(plan.newKeys.map((k) => k.skill)).toEqual(['mulTens', 'mulTens'])
  })

  it('starts the other stones QA3c found on a fresh day as well', () => {
    const p = strongChild({
      nodes: Object.fromEntries(['w3-tabellen-l1', 'w3-areal-l1', 'w3-store-tal-l1', 'w3-division-l1'].map((id) => [id, { plays: 1, stars: 3, skipped: false, lastAt: at(-1) }])),
    })
    for (const id of ['w3-tabellen-l2', 'w3-areal-l2', 'w3-store-tal-l2', 'w3-division-l2'] as NodeId[]) {
      expect(chooseStart(id, p, ctx(at(0))).kind, id).toBe('plan')
    }
  })

  it('still says "nyt i morgen" for a stone never played once today\'s new keys are used (A13, A15)', () => {
    const now = at(0)
    const day = learningDay(now)
    // the allowance and the taste used up
    const used = strongChild({ newToday: { day, total: 24, perSkill: { mul34: 8, mul6to9: 8, mulTens: 0 } } })
    const plan = planRound(NODE_BY_ID['w3-tabellen-l2'], used, { day, sessionId: 's', audioVerified: true })
    expect(plan.capped).toBe(true)
    expect(plan.ownShare).toBeLessThan(OWN_SHARE_MIN)
    expect(chooseStart('w3-tabellen-l2', used, ctx(now))).toEqual({ kind: 'tomorrow' })
    // the allowance used, the taste not: two keys tasted in a round of review is still not the stone's round
    const taste = strongChild({ newToday: { day, total: 20, perSkill: { mul34: 8, mul6to9: 8 } } })
    const tasted = planRound(NODE_BY_ID['w3-tabellen-l2'], taste, { day, sessionId: 's', audioVerified: true })
    expect(tasted.capped).toBe(true)
    expect(chooseStart('w3-tabellen-l2', taste, ctx(now))).toEqual({ kind: 'tomorrow' })
    // a stone already played runs as before (A13)
    const played: ProfileDoc = { ...used, nodes: { ...used.nodes, 'w3-tabellen-l2': { plays: 1, stars: 1, skipped: false, lastAt: at(-1) } } }
    expect(chooseStart('w3-tabellen-l2', played, ctx(now)).kind).toBe('plan')
  })

  it('starts w3-tabellen-l2 every day of QA3c\'s run: a strong child in 3. klasse, day 1 to 17', () => {
    // the ladder all right (L14): Stjernefjeldet, and everything below it seeded
    let p = seedFromPlacement(newProfile({ id: 'p-qa3c', grade: 3, unlocked }), 'L14', { day: learningDay(at(0)), now: at(0) })
    p = { ...p, unlocked }
    /** A round answered right and quickly, as the data layer books it (keys, newToday, the stone played). */
    const play = (id: NodeId, now: number) => {
      const day = learningDay(now)
      const plan = planRound(NODE_BY_ID[id], p, { day, sessionId: 's', audioVerified: true })
      const keys = { ...p.keys }
      plan.tasks.forEach((t, i) => {
        keys[t.masteryKey] = updateKey(keys[t.masteryKey], {
          correct: true, fast: true, production: isProduction(t), ceiling: ceilingFor(t), ms: 2500, ts: now + i * 20_000, day,
          roundIndex: p.roundIndex, mode: 'round', assisted: false, retryOf: null, procedure: t.masteryKey.includes('/'), instanceId: t.factId,
        })
      })
      const prev = p.nodes[id]
      p = {
        ...p, keys, roundIndex: p.roundIndex + 1,
        newToday: bumpNewToday(p.newToday, day, plan.newKeys),
        nodes: { ...p.nodes, [id]: { plays: (prev?.plays ?? 0) + 1, stars: 3, skipped: false, lastAt: now } },
      }
    }
    // days 1–5: the first stone of Tabeltoppen, Minuttårnet, Markedet, Arealhaven and Brøkbageriet
    const firsts: NodeId[] = ['w3-tabellen-l1', 'w3-klokken-l1', 'w3-penge-maal-l1', 'w3-areal-l1', 'w3-broeker-l1']
    const others: NodeId[] = ['w3-klokken-l2', 'w3-penge-maal-l2', 'w3-broeker-l2', 'w3-klokken-l1', 'w3-penge-maal-l1', 'w3-broeker-l1']
    const starts: string[] = []
    for (let d = 1; d <= 17; d++) {
      const now = at(d)
      // as the first thing of a new learning day, "Lær mere" in Tabeltoppen (from day 2, once l1 is played)
      if (d >= 2) {
        const start = chooseStart('w3-tabellen-l2', p, ctx(now))
        starts.push(`${d}:${start.kind}`)
        if (start.kind === 'plan') expect(planRound(NODE_BY_ID['w3-tabellen-l2'], p, { day: learningDay(now), sessionId: 's', audioVerified: true }).ownShare).toBeGreaterThanOrEqual(OWN_SHARE_MIN)
      }
      // then the day's play, leaving Tabeltoppen's l2 to be tried again tomorrow (as QA3c's child had to)
      play(d <= 5 ? firsts[d - 1] : others[(d - 6) % others.length], now + 3_600_000)
      play(others[(d + 1) % others.length], now + 7_200_000)
    }
    expect(starts).toEqual(Array.from({ length: 16 }, (_, i) => `${i + 2}:plan`))
  })
})
