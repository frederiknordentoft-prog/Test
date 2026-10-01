// What a place on the map is called, how it looks and what colour it wears — shared by the map, the
// round's intro and the end of the round. Pure data over the curriculum (no engine, no registry), so
// it costs nothing on the first screen.
import type { CSSProperties } from 'react'
import { NODE_BY_ID, REGION_BY_ID, WORLD_BY_ID, type NodeDef, type NodeSlot } from '../../../../content/curriculum'
import { SKILL_BY_ID } from '../../../../content/skills'
import { WORLD_IDS, type ClipId, type DomainId, type NodeId, type RegionId } from '../../../../engine/types'
import type { IconName } from '../../../design/icons'

/** A round started from the map: a node, Blandet øvelse or the Træningshytte. */
export type PlayTarget = NodeId | 'practice' | 'hut'

export const SLOT_CLIP: Readonly<Record<NodeSlot, ClipId>> = {
  l1: 's.map.node.l1',
  l2: 's.map.node.l2',
  friend: 's.map.node.friend',
  chest: 's.map.node.chest',
  l3: 's.map.node.l3',
  mix: 's.map.node.mix',
  trial: 's.map.node.trial',
  finale: 's.map.node.finale',
}

export const SLOT_ABOUT: Readonly<Record<NodeSlot, ClipId>> = {
  l1: 's.map.about.l1',
  l2: 's.map.about.l2',
  friend: 's.map.about.friend',
  chest: 's.map.about.chest',
  l3: 's.map.about.l3',
  mix: 's.map.about.mix',
  trial: 's.map.about.trial',
  finale: 's.map.about.finale',
}

const DOMAIN_ICON: Readonly<Record<DomainId, IconName>> = {
  number: 'board', place: 'numberline', addsub: 'plus', muldiv: 'times', algebra: 'equals',
  fractions: 'fraction', shapes: 'shapes', clock: 'clock', money: 'coin', measure: 'ruler',
}

/** Colour families from the tokens (--color-d-*): every region gets its own, never grey. */
export const TONES = ['shapes', 'fractions', 'money', 'addsub', 'number', 'muldiv', 'measure', 'algebra', 'clock', 'place'] as const
export type Tone = (typeof TONES)[number]

export function regionTone(region: RegionId | null | undefined): Tone {
  const def = region ? REGION_BY_ID[region] : undefined
  if (!def) return 'number'
  const w = WORLD_IDS.indexOf(def.world)
  return TONES[(w * 3 + def.index - 1) % TONES.length]
}

/** CSS variables for a tone: --tone, --tone-deep and --tone-soft. */
export function toneStyle(tone: Tone): CSSProperties {
  return {
    '--tone': `var(--color-d-${tone})`,
    '--tone-deep': `var(--color-d-${tone}-deep)`,
    '--tone-soft': `var(--color-d-${tone}-soft)`,
  } as CSSProperties
}

/** The domain the node mostly teaches (its first skill that is not review). */
export function nodeDomain(node: NodeDef): DomainId {
  const first = node.skills.find((s) => !s.reviewOnly) ?? node.skills[0]
  return first ? SKILL_BY_ID[first.skill].domain : 'number'
}

export function nodeIcon(node: NodeDef): IconName {
  switch (node.slot) {
    case 'friend': return 'paw'
    case 'chest': return 'chest'
    case 'l3': return 'pencil'
    case 'mix': return 'sparkle'
    case 'trial': return 'bridge'
    case 'finale': return 'flag'
    default: return DOMAIN_ICON[nodeDomain(node)]
  }
}

export interface TargetInfo {
  /** Where: the region (or world) name, or the practice/hut label. */
  title: ClipId
  /** What: the kind of stone. */
  label: ClipId | null
  icon: IconName
  tone: Tone
  node: NodeDef | null
}

/** How a round's target is named and drawn (the intro, the "Næste" button, the resume banner). */
export function targetInfo(target: PlayTarget, hutRegion?: RegionId | null): TargetInfo {
  if (target === 'practice') return { title: 's.map.practice', label: null, icon: 'retry', tone: 'algebra', node: null }
  if (target === 'hut') {
    const region = hutRegion ? REGION_BY_ID[hutRegion] : undefined
    return { title: 's.map.hut', label: region?.nameClip ?? null, icon: 'hut', tone: regionTone(hutRegion), node: null }
  }
  const node = NODE_BY_ID[target]
  if (!node) return { title: 's.map.practice', label: null, icon: 'retry', tone: 'algebra', node: null }
  const title = node.region ? REGION_BY_ID[node.region].nameClip : WORLD_BY_ID[node.world].nameClip
  return { title, label: SLOT_CLIP[node.slot], icon: nodeIcon(node), tone: node.region ? regionTone(node.region) : 'money', node }
}
