// The reward log in words (SPEC §9.1 "hvad der er optjent og hvordan", §13.13): what each row gave
// the child and what earned it. Everything is earned by doing sums; the shop only takes perler.
import { DECOR, ITEM_BY_ID, SPECIES_BY_ID, TROPHIES } from '../content/catalog'
import { REGION_BY_ID, WORLD_BY_ID } from '../content/curriculum'
import { SKILL_BY_ID } from '../content/skills'
import { learningDay } from '../engine/learningDay'
import type { Animal, ColorwayId, ItemId, Medal, ProfileDoc, RewardLogEntry, SkillId, SpeciesId, WorldId } from '../engine/types'
import { MEDAL_LABEL, plural } from './format'
import { nodeName } from './metrics'
import type { RewardDay, RewardRow } from './types'

const MAGIC: Readonly<Record<string, string>> = { gold: 'gylden', rainbow: 'regnbuefarvet', starwhite: 'stjernehvid' }

function animalText(what: string): string {
  const [species, , colorway] = what.split(':')
  const meta = SPECIES_BY_ID[species as SpeciesId]
  if (!meta) return 'En ny ven'
  const i = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].indexOf(colorway as ColorwayId)
  const colour = i >= 0 ? meta.colors[i] : MAGIC[colorway]
  return colour ? `${meta.name} (${colour})` : meta.name
}

const itemName = (id: string) => ITEM_BY_ID[id as ItemId]?.name ?? 'En ting'
const skillLabel = (id: string) => SKILL_BY_ID[id as SkillId]?.label ?? id
const medalWord = (m: string) => `${MEDAL_LABEL[m as Medal] ?? m}medalje`
const capital = (s: string) => s.charAt(0).toLocaleUpperCase('da-DK') + s.slice(1)

/** What the row gave. */
export function rewardWhat(e: RewardLogEntry, animals: readonly Animal[] = []): string {
  switch (e.kind) {
    case 'perler': return `${e.what} perler`
    case 'stars': {
      const [node, n] = [e.what.slice(0, e.what.lastIndexOf(':')), Number(e.what.slice(e.what.lastIndexOf(':') + 1))]
      return `${n} ${plural(n, 'stjerne', 'stjerner')} på ${nodeName(node)}`
    }
    case 'medal': {
      const [medal, skill] = e.what.split(':')
      return `${capital(medalWord(medal))} i ${skillLabel(skill)}`
    }
    case 'level': return `Niveau ${e.what}`
    case 'item': return `Ny ting: ${itemName(e.what)}`
    case 'animal': return `Ny ven: ${animalText(e.what)}`
    case 'growth': {
      const [uid, stage] = e.what.split(':')
      const a = animals.find((x) => x.uid === uid)
      const who = a ? a.name || SPECIES_BY_ID[a.species]?.name : 'En ven'
      return stage === 'star' ? `${who} fik stjerneform` : `${who} voksede`
    }
    case 'trophy': return `Trofæ: ${TROPHIES.find((t) => t.id === e.what)?.name ?? e.what}`
    case 'decor': return `Pynt: ${DECOR.find((d) => d.id === e.what)?.name ?? e.what}`
    case 'recolor': return `Ny farve til ${itemName(e.what.split(':')[0])}`
  }
}

/** What earned it. */
export function rewardWhy(why: string): string {
  const [head, ...rest] = why.split(':')
  const tail = rest.join(':')
  switch (head) {
    case 'round': return `En tur: ${nodeName(tail)}`
    case 'node': return `Kisten: ${nodeName(tail)}`
    case 'finale': return `${WORLD_BY_ID[tail as WorldId]?.name ?? tail}s finale`
    case 'level': return `Nyt niveau (${tail})`
    case 'medal': {
      const [medal, x] = rest
      return /^\d+$/.test(x) ? `${x} ${medalWord(medal)}r i alt` : `${capital(medalWord(medal))} i ${skillLabel(x)}`
    }
    case 'shop': return 'Købt for perler'
    case 'starter': return 'Den første ven'
    case 'egg': return `Klækket af æg nr. ${tail}`
    case 'friendship': return 'Venskab med dyret'
    case 'friend': return tail ? `Fundet på ${nodeName(tail.replace(/^round:/, ''))}` : 'Fundet på en venneknude'
    case 'gold': return 'Valgt efter en guldmedalje'
    case 'rainbow': return 'Valgt efter tre stjerner i et helt område'
    case 'starFoal': return 'Stjernefølet'
    default: return REGION_BY_ID[head] ? REGION_BY_ID[head].name : 'Optjent ved at regne'
  }
}

export function rewardRow(e: RewardLogEntry, animals: readonly Animal[] = []): RewardRow {
  return { ts: e.ts, kind: e.kind, what: rewardWhat(e, animals), why: rewardWhy(e.why) }
}

/** The log by learning day, newest first; perler are summed per day instead of one row per round. */
export function rewardDays(profile: Pick<ProfileDoc, 'rewardLog' | 'animals'>, limitDays = 14): RewardDay[] {
  const days = new Map<string, RewardDay>()
  for (const e of [...profile.rewardLog].sort((a, b) => b.ts - a.ts)) {
    const day = learningDay(e.ts)
    const d = days.get(day) ?? { day, perler: null, rows: [] }
    if (e.kind === 'perler') d.perler = (d.perler ?? 0) + (Number(e.what) || 0)
    else d.rows.push(rewardRow(e, profile.animals))
    days.set(day, d)
  }
  return [...days.values()].slice(0, limitDays)
}
