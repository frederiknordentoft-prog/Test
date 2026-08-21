import { hashSeed, makeRng } from '../engine/rng'

/**
 * A talven's appearance, derived entirely from its id. A handful of primitives —
 * body silhouette, eyes, a topping, a pattern — multiply out to hundreds of
 * creatures that all look hand-made and none of which is a file on disk.
 */
export interface CreatureLook {
  hue: number
  hue2: number
  /** half-width of the body at its widest, in a 100×100 box */
  width: number
  top: number
  bottom: number
  topBias: number
  bottomBias: number
  eyes: 1 | 2 | 3
  eyeSize: number
  pupil: 'dot' | 'ring' | 'sleepy'
  mouth: 'smile' | 'o' | 'wave' | 'fang'
  crown: 'none' | 'ears' | 'horns' | 'antenna' | 'fin'
  pattern: 'none' | 'spots' | 'stripes' | 'belly'
  feet: boolean
  blush: boolean
  /** seconds of offset so a crowd of creatures does not bob in lockstep */
  phase: number
}

const pick = <T,>(rng: { next(): number }, items: readonly T[]): T =>
  items[Math.floor(rng.next() * items.length)]

export function lookFor(speciesId: string, variant = 0, hueBase?: number): CreatureLook {
  const rng = makeRng(hashSeed(`${speciesId}#${variant}`))
  const hue = hueBase === undefined ? Math.floor(rng.next() * 360) : (hueBase + (rng.next() - 0.5) * 60 + 360) % 360

  const silhouette = pick(rng, ['blob', 'round', 'egg', 'tall'] as const)
  const width = silhouette === 'tall' ? 26 + rng.next() * 5 : silhouette === 'round' ? 33 + rng.next() * 5 : 29 + rng.next() * 6
  const top = silhouette === 'tall' ? 16 + rng.next() * 4 : 24 + rng.next() * 6
  const bottom = 84 + rng.next() * 4

  return {
    hue,
    hue2: (hue + 25 + rng.next() * 45) % 360,
    width,
    top,
    bottom,
    topBias: silhouette === 'egg' ? 0.42 + rng.next() * 0.15 : 0.62 + rng.next() * 0.28,
    bottomBias: silhouette === 'egg' ? 0.86 + rng.next() * 0.12 : 0.62 + rng.next() * 0.3,
    eyes: pick(rng, [2, 2, 2, 2, 1, 3] as const),
    eyeSize: 7 + rng.next() * 4,
    pupil: pick(rng, ['dot', 'dot', 'ring', 'sleepy'] as const),
    mouth: pick(rng, ['smile', 'smile', 'o', 'wave', 'fang'] as const),
    crown: pick(rng, ['none', 'ears', 'horns', 'antenna', 'fin'] as const),
    pattern: pick(rng, ['none', 'spots', 'stripes', 'belly'] as const),
    feet: rng.next() > 0.35,
    blush: rng.next() > 0.45,
    phase: rng.next() * 2,
  }
}

/** The body outline. Two bias values pinch the top and bottom into egg/pear shapes. */
export function bodyPath(look: CreatureLook): string {
  const { width: w, top: t, bottom: b, topBias, bottomBias } = look
  const midY = (t + b) / 2
  const k = 0.86
  const wTop = w * topBias
  const wBot = w * bottomBias
  return [
    `M 50 ${t}`,
    `C ${50 + wTop * k} ${t} ${50 + w} ${midY - (midY - t) * 0.55} ${50 + w} ${midY}`,
    `C ${50 + w} ${midY + (b - midY) * 0.55} ${50 + wBot * k} ${b} 50 ${b}`,
    `C ${50 - wBot * k} ${b} ${50 - w} ${midY + (b - midY) * 0.55} ${50 - w} ${midY}`,
    `C ${50 - w} ${midY - (midY - t) * 0.55} ${50 - wTop * k} ${t} 50 ${t}`,
    'Z',
  ].join(' ')
}

/** Horizontal positions for the eyes, evenly spread across the face. */
export function eyePositions(look: CreatureLook): number[] {
  if (look.eyes === 1) return [50]
  if (look.eyes === 2) return [50 - look.width * 0.36, 50 + look.width * 0.36]
  return [50 - look.width * 0.5, 50, 50 + look.width * 0.5]
}
