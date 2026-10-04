// A long-time player for the round measurement (scripts/perf/round.mjs, PROFILE=heavy): every
// released key of waves 1–2 with its history, 60 dressed animals, the whole wardrobe, a full reward
// log and misconceptions under watch. Written as JSON with the ProfileDoc fields that round.mjs puts
// into the child's own export before "Erstat …s data" (the parents' own way in), so every answer of
// the measured round writes a document of that size. Checked with the app's own import validator.
//
//   node scripts/voice/run-vite.mjs scripts/perf/heavy.ts            # ≥ 250 KB → artifacts/perf/heavy.json
//   node scripts/voice/run-vite.mjs scripts/perf/heavy.ts 500        # ≈ 500 KB → artifacts/perf/heavy-500.json
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AVAILABLE_ITEMS } from '../../src/art/items/registry'
import { AVAILABLE_SPECIES } from '../../src/art/species/registry'
import { ITEMS, SPECIES_BY_ID } from '../../src/content/catalog'
import { NODES, REGIONS } from '../../src/content/curriculum'
import { SKILL_BY_ID } from '../../src/content/skills'
import { EXPORT_FORMAT, EXPORT_VERSION, validateExport } from '../../src/data/export'
import { newProfileDoc } from '../../src/data/repo/profiles'
import { learningDay } from '../../src/engine/learningDay'
import { emptyKey } from '../../src/engine/mastery'
import { skillRegistry } from '../../src/engine/registry'
import { makeRng } from '../../src/engine/rng'
import {
  DECOR_IDS, MISCONCEPTION_IDS, NATURAL_COLORWAYS, SLOTS, TASK_KINDS, TROPHY_IDS,
  type Animal, type Box, type ItemId, type KeyState, type MisconceptionId, type MisconceptionState, type ProfileDoc,
  type RewardLogEntry, type SkillId, type Slot,
} from '../../src/engine/types'
import { addDays } from '../../src/parent/format'
import { keyIndexOf } from '../../src/parent/load'

const DAY_MS = 86_400_000
const WAVES_1_2 = new Set(['eng', 'bakke', 'skov'])
const OUT = fileURLToPath(new URL('../../artifacts/perf/', import.meta.url))

/** The fields round.mjs merges into the child's exported document. */
export type HeavyContent = Omit<ProfileDoc, 'id' | 'version' | 'name' | 'grade' | 'frameColor' | 'createdAt' | 'settings' | 'round' | 'buddyUid'>

export function heavyContent(targetKb: number, now = Date.now()): HeavyContent {
  const rng = makeRng(20261004)
  const today = learningDay(now)
  const dayAt = (n: number) => addDays(today, -n)
  const reg = skillRegistry()
  const index = keyIndexOf(reg)
  const regions = REGIONS.filter((r) => WAVES_1_2.has(r.world))
  const skills = [...new Set(regions.flatMap((r) => r.skills.map((s) => s.skill)))].filter((s) => reg.get(s)) as SkillId[]

  // every released key of waves 1–2, with its history
  const keys: Record<string, KeyState> = {}
  for (const skill of skills) {
    const procedure = SKILL_BY_ID[skill]?.mode === 'procedure'
    for (const [i, ref] of (index[skill] ?? []).entries()) {
      const box = rng.between(1, 5) as Box
      const ids = (n: number) => Array.from({ length: n }, (_, j) => `${ref.key}#${(i * 7 + j * 3) % 40}`)
      keys[ref.key] = {
        ...emptyKey(),
        box, seen: 4 + rng.between(0, 30), correct: 3 + rng.between(0, 24), lastRound: 200 + rng.between(0, 180),
        lastDay: dayAt(rng.between(0, 40)), boxDay: dayAt(rng.between(0, 60)), boxAt: now - rng.between(1, 60) * DAY_MS, avgMs: rng.between(1800, 9000),
        ...(procedure ? { recent: ids(5), drawn: ids(10), pendingInstance: box < 5 ? ids(1)[0] : null } : {}),
      }
    }
  }

  const skillStats = Object.fromEntries(skills.map((s) => [s, { prodCorrect: rng.between(20, 160), prodDays: Array.from({ length: 30 }, (_, i) => dayAt(2 * i)).reverse() }]))
  const skillMedals = Object.fromEntries(skills.map((s, i) => [s, (['gold', 'silver', 'bronze'] as const)[i % 3]]))
  const nodes = Object.fromEntries(NODES.filter((n) => WAVES_1_2.has(n.world)).map((n, i) => [n.id, { plays: 1 + (i % 4), stars: (1 + (i % 3)) as 1 | 2 | 3, skipped: false, lastAt: now - (i % 50) * DAY_MS }]))
  const trials = Object.fromEntries([
    ...regions.map((r) => r.id),
    ...[...WAVES_1_2],
  ].map((id, i) => [id, { attempts: 1 + (i % 2), failed: i % 2, best: 9, passedAt: now - (40 - (i % 40)) * DAY_MS, lastAttemptRound: 20 + i * 9 }]))

  // the whole wardrobe in every colour, and 60 animals dressed in it
  const inventory = Object.fromEntries(ITEMS.map((it, i) => [it.id, { at: now - (i % 90) * DAY_MS, colors: [0, 1, 2] as (0 | 1 | 2)[] }]))
  const drawnItems = new Set<ItemId>(AVAILABLE_ITEMS)
  const bySlot = (slot: Slot) => ITEMS.filter((it) => it.slot === slot && drawnItems.has(it.id)).map((it) => it.id)
  const species = AVAILABLE_SPECIES.filter((s) => SPECIES_BY_ID[s])
  const animals: Animal[] = Array.from({ length: 60 }, (_, i) => {
    const id = species[i % species.length]
    const meta = SPECIES_BY_ID[id]
    const outfit: Animal['outfit'] = {}
    for (const slot of SLOTS) {
      if (meta.occupies?.includes(slot)) continue
      const options = bySlot(slot)
      if (options.length > 0 && (i + slot.length) % 5 !== 0) outfit[slot] = { item: options[(i * 3 + slot.length) % options.length], color: (i % 3) as 0 | 1 | 2 }
    }
    const stage = (1 + (i % 3)) as 1 | 2 | 3
    return {
      uid: `heavy-${i}`, species: id, breed: meta.breeds[Math.floor(i / species.length) % meta.breeds.length], colorway: NATURAL_COLORWAYS[(i * 5) % 6],
      name: `Ven ${i + 1}`, friendship: 20 + (i % 80), stage, star: stage === 3 && i % 4 === 0, shown: stage, outfit,
      foundAt: now - (60 - i) * DAY_MS, source: i === 0 ? 'starter' : i % 7 === 0 ? 'friend' : 'egg',
    }
  })

  const kinds: RewardLogEntry['kind'][] = ['perler', 'stars', 'item', 'medal', 'animal', 'level', 'growth', 'trophy', 'recolor', 'decor']
  const rewardLog: RewardLogEntry[] = Array.from({ length: 200 }, (_, i) => ({
    ts: now - (200 - i) * 3_600_000,
    kind: kinds[i % kinds.length],
    what: kinds[i % kinds.length] === 'perler' ? String(8 + (i % 9)) : `${ITEMS[i % ITEMS.length].id}:${i % 3}`,
    why: `round:${NODES[i % NODES.length].id}`,
  }))

  // misconceptions with their 30-day windows: the knob that brings the document to its size
  const state = (i: number): MisconceptionState => ({
    status: (['watching', 'flagged', 'resolved'] as const)[i % 3],
    hits: Array.from({ length: 40 }, (_, j) => ({ day: dayAt(29 - (j % 30)), factId: `add:${j % 10}+${(j * 3) % 10}`, w: j % 4 === 0 ? 0.5 : 1, production: j % 3 !== 0 })),
    opps: Array.from({ length: 80 }, (_, j) => ({ day: dayAt(29 - (j % 30)), pGuess: +(0.05 + (j % 7) * 0.04).toFixed(2), hit: j % 5 === 0, correct: j % 3 !== 0, ts: now - (80 - j) * 3_600_000 })),
    flaggedAt: i % 3 === 0 ? null : now - (10 + i) * DAY_MS,
    resolvedAt: i % 3 === 2 ? now - (2 + i) * DAY_MS : null,
  })

  const content: HeavyContent = {
    placement: { done: true, at: now - 120 * DAY_MS, highest: 'L2' },
    keys, skillStats, skillMedals, nodes, trials,
    unlocked: { worlds: [...WAVES_1_2] as ProfileDoc['unlocked']['worlds'], regions: [] },
    roundIndex: 420,
    newToday: { day: '', total: 0, perSkill: {} },
    offeredTags: Object.fromEntries(MISCONCEPTION_IDS.map((m, i) => [m, 3 + (i % 20)])),
    misconceptions: {},
    economy: { perler: 640, xp: 48_000, level: 30, eggWarmth: 40, eggsHatched: 52, eggSpecies: null, wish: null },
    animals,
    inventory,
    decor: Object.fromEntries(DECOR_IDS.map((d, i) => [d, { at: now - i * DAY_MS, x: 0.1 + i * 0.1, y: 0.2 + (i % 3) * 0.2 }])),
    achievements: Object.fromEntries(TROPHY_IDS.slice(0, 20).map((t, i) => [t, now - (90 - i) * DAY_MS])),
    goals: { day: '', list: [] },
    stamps: 140,
    daysPlayed: 120,
    lastLearningDay: dayAt(1),
    demosSeen: Object.fromEntries(TASK_KINDS.map((k) => [k, 3])),
    instructionsHeard: Object.fromEntries(TASK_KINDS.map((k) => [k, 6])),
    recentFirstTries: [true, true, false, true, true, true, false, true, true, true],
    recentFast: [true, false, false, true, true, false, false, true, false, true],
    rewardLog,
  }
  const size = () => JSON.stringify(content).length
  for (const [i, id] of (MISCONCEPTION_IDS as readonly MisconceptionId[]).entries()) {
    if (i >= 6 && size() >= targetKb * 1024) break
    content.misconceptions[id] = state(i)
  }
  return content
}

export async function main(args: string[]): Promise<number> {
  const kb = Number(args[0] ?? 250)
  const content = heavyContent(kb)
  // the app's own import check, on a whole document with this content
  const base = newProfileDoc('Ida', 2)
  const doc: ProfileDoc = { ...base, ...content, buddyUid: content.animals[0].uid }
  const check = validateExport({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: Date.now(), profiles: [{ doc, daily: [], answers: [] }] })
  if (!check.ok) {
    console.error(check.message, check.errors)
    return 1
  }
  mkdirSync(OUT, { recursive: true })
  const file = `${OUT}${kb === 250 ? 'heavy' : `heavy-${kb}`}.json`
  writeFileSync(file, JSON.stringify(content))
  const bytes = JSON.stringify(doc).length
  console.log(`${file}: ${Object.keys(content.keys).length} nøgler, ${content.animals.length} dyr, ${Object.keys(content.inventory).length} genstande, ${content.rewardLog.length} belønninger, ${Object.keys(content.misconceptions).length} misforståelser; dokumentet er ${(bytes / 1024).toFixed(0)} KB`)
  return bytes >= kb * 1024 * 0.95 ? 0 : 1
}
