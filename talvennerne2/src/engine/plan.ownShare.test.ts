import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NODES, REGIONS, WORLD_BY_ID, nodesOfRegion, type NodeDef } from '../content/curriculum'
import { OWN_SHARE_MIN, planRound, type PlannedRound } from './plan'
import { skillKeys, skillRegistry } from './registry'
import { hashSeed } from './rng'
import { keyAt, newProfile } from './testing/profile'
import type { KeyState, NodeId, NodeProgress, ProfileDoc, WorldId } from './types'

/**
 * Every stone planned for a few representative children, compared with the plans before QA3c P2-1
 * (63f04ae, src/engine/testing/ownShare.63f04ae.json). A stone with too few keys of its own was
 * filled with other skills' review on a fresh learning day, so a stone never played answered "Her er
 * der nyt i morgen" every day (SPEC A15 says that only once today's new keys are used up, A13). Now
 * its own keys come first, repeated where needed, until they are half of the round. Only those
 * stones may plan differently: every round that was already half its own, and every round today's
 * allowance stopped, is the same round, task for task.
 *
 * WRITE_OWNSHARE_FIXTURE=1 writes the fixture from the code at hand (it was written at 63f04ae).
 */

const FIXTURE = fileURLToPath(new URL('./testing/ownShare.63f04ae.json', import.meta.url))
const DAY = '2026-10-20'
const EARLIER = '2026-10-15'
const reg = skillRegistry()
const ALL_WORLDS: WorldId[] = ['eng', 'bakke', 'skov', 'fjeld']
const unlocked = { worlds: ALL_WORLDS, regions: REGIONS.map((r) => r.id) }

/** A box from the key itself, so a profile is the same on every run. */
const boxOf = (key: string, lo: number, hi: number) => lo + (hashSeed(key) % (hi - lo + 1))

/** Keys of every region in these worlds but the stone's own (their skills too), boxes lo–hi, met on an earlier day. */
function keysAround(n: NodeDef, upTo: number, lo: number, hi: number): Record<string, KeyState> {
  const own = new Set((n.region ? REGIONS.find((r) => r.id === n.region)!.skills : n.skills).map((s) => s.skill))
  const keys: Record<string, KeyState> = {}
  for (const r of REGIONS) {
    if (WORLD_BY_ID[r.world].grade > upTo || r.id === n.region) continue
    for (const s of r.skills) {
      const def = reg.get(s.skill)
      if (!def || own.has(s.skill)) continue
      for (const k of skillKeys(def)) keys[k] = keyAt(boxOf(k, lo, hi), EARLIER, 5)
    }
  }
  return keys
}

/** The stone's own region's keys, every other one met (boxes 1–4). */
function ownSeen(n: NodeDef): Record<string, KeyState> {
  const keys: Record<string, KeyState> = {}
  const region = n.region ? REGIONS.find((r) => r.id === n.region) : undefined
  for (const s of region?.skills ?? n.skills) {
    const def = reg.get(s.skill)
    if (!def) continue
    for (const k of skillKeys(def)) if (hashSeed(k) % 2 === 0) keys[k] = keyAt(boxOf(k, 1, 4), EARLIER, 5)
  }
  return keys
}

/** The stones before this one in its region, played on an earlier day (the map's order). */
function before(n: NodeDef): Partial<Record<NodeId, NodeProgress>> {
  const nodes: Partial<Record<NodeId, NodeProgress>> = {}
  if (!n.region) return nodes
  for (const m of nodesOfRegion(n.region)) {
    if (m.id === n.id) break
    if (m.slot !== 'trial') nodes[m.id] = { plays: 1, stars: 2, skipped: false, lastAt: Date.parse(`${EARLIER}T10:00:00`) }
  }
  return nodes
}

type Kind = 'new' | 'g1' | 'g3' | 'g3own' | 'day'
const KINDS: readonly Kind[] = ['new', 'g1', 'g3', 'g3own', 'day']

function profileFor(kind: Kind, n: NodeDef): ProfileDoc {
  const earlier = { day: EARLIER, total: 12, perSkill: {} }
  switch (kind) {
    // a new child: nothing met, the stone never played
    case 'new':
      return newProfile({ id: 'pNew', grade: WORLD_BY_ID[n.world].grade, unlocked })
    // 1. klasse, Engdalen and Hestebakkerne met (boxes 1–5), a fresh learning day
    case 'g1':
      return newProfile({ id: 'pG1', grade: 1, unlocked, keys: keysAround(n, 1, 1, 5), nodes: before(n), newToday: earlier })
    // 3. klasse, every other region met and most of it sure (boxes 3–5): the QA3c child
    case 'g3':
      return newProfile({ id: 'pG3', grade: 3, unlocked, keys: keysAround(n, 3, 3, 5), nodes: before(n), newToday: earlier })
    // as g3, and half of the stone's own region met too
    case 'g3own':
      return newProfile({ id: 'pG3o', grade: 3, unlocked, keys: { ...keysAround(n, 3, 3, 5), ...ownSeen(n) }, nodes: before(n), newToday: earlier })
    // 2. klasse, today's allowance nearly used (3 new keys left): rounds the allowance stops
    case 'day':
      return newProfile({ id: 'pDay', grade: 2, unlocked, keys: keysAround(n, 2, 0, 5), nodes: before(n), newToday: { day: DAY, total: 17, perSkill: {} } })
  }
}

const SEEDS: readonly (number | undefined)[] = [undefined, 7]

interface Row { hash: string; own: number }

function planOf(kind: Kind, n: NodeDef, seed: number | undefined): PlannedRound {
  return planRound(n, profileFor(kind, n), { day: DAY, sessionId: 's', audioVerified: true, ...(seed === undefined ? {} : { seed }) })
}

const rowOf = (plan: PlannedRound): Row => ({
  hash: hashSeed(JSON.stringify(plan.tasks)).toString(16).padStart(8, '0'),
  own: Math.round(plan.ownShare * 1000) / 1000,
})

const id = (kind: Kind, seed: number | undefined, n: NodeDef) => `${kind}|${seed ?? '-'}|${n.id}`

describe('a stone\'s own keys on a fresh day (QA3c P2-1, SPEC A15)', () => {
  if (process.env.WRITE_OWNSHARE_FIXTURE === '1') {
    it('writes the fixture', () => {
      const out: Record<string, string> = {}
      for (const kind of KINDS) for (const seed of SEEDS) for (const n of NODES) {
        const row = rowOf(planOf(kind, n, seed))
        out[id(kind, seed, n)] = `${row.hash}:${row.own}`
      }
      writeFileSync(FIXTURE, `${JSON.stringify(out, null, 0).replace(/","/g, '",\n"')}\n`)
    })
    return
  }

  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>
  const changed: string[] = []
  const rows = new Map<string, { before: Row; after: Row; plan: PlannedRound }>()
  for (const kind of KINDS) for (const seed of SEEDS) for (const n of NODES) {
    const [hash, own] = fixture[id(kind, seed, n)].split(':')
    const plan = planOf(kind, n, seed)
    rows.set(id(kind, seed, n), { before: { hash, own: Number(own) }, after: rowOf(plan), plan })
  }

  it('plans all 140 stones (and the trials and finales) for five children and two seeds', () => {
    expect(NODES.filter((n) => n.slot !== 'trial' && n.slot !== 'finale')).toHaveLength(140)
    expect(rows.size).toBe(NODES.length * KINDS.length * SEEDS.length)
  })

  it('leaves every round that was half its own, and every round the allowance stopped, as it was', () => {
    for (const [key, { before, after, plan }] of rows) {
      if (before.own >= OWN_SHARE_MIN || plan.capped) expect(after.hash, key).toBe(before.hash)
      if (after.hash !== before.hash) changed.push(key)
    }
  })

  it('gives a stone that was under half its own on a fresh day half or more of its own keys', () => {
    for (const [key, { before, after, plan }] of rows) {
      if (before.own >= OWN_SHARE_MIN || plan.capped) continue
      expect(after.own, key).toBeGreaterThanOrEqual(OWN_SHARE_MIN)
      expect(plan.tasks.length, key).toBe(NODES.find((n) => n.id === key.split('|')[2])!.size)
    }
    // the ten stones QA3c's skeptic found, for the 3. klasse child
    const g3 = new Set(changed.filter((k) => k.startsWith('g3|')).map((k) => k.split('|')[2]))
    for (const stone of ['w3-tabellen-l2', 'w3-areal-l2', 'w3-store-tal-l2', 'w3-division-l2', 'w0-tal10-l2', 'w0-tal20-l2', 'w1-tiere-l2', 'w2-penge-l2', 'w2-hundreder-l2', 'w2-maal-data-l2']) {
      expect(g3.has(stone), stone).toBe(true)
    }
    // a new child had no other skills' review to fill with: nothing of it changed
    expect(changed.filter((k) => k.startsWith('new|'))).toEqual([])
  })
})
