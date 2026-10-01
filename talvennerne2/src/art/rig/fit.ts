// Fit-algoritmen (SPEC §7.1) som ren funktion af (genstand, bærerens modelankre, art).
// Regel 3 (kropstøj klippes til kroppen +2) og 5 (poten over håndtaget) håndhæves af Rig.tsx;
// regel 6 (øjnene dækkes ikke) af kontaktarkets bbox-lint; regel 7 af `overrideShare`.
import { fmt3, n } from './shapes'
import type { AnchorSet, CreatureId, Family, FitResult, ItemDef, Pt, ScaleBy } from './types'

/** Referencebredderne genstande tegnes ved (standardankrene for stadie 2/round). */
export const FIT_REFERENCE: Record<Exclude<ScaleBy, 'fixed'>, number> = {
  headWidth: 104,
  bodyWidth: 100,
  neckWidth: 58,
}

/** Hatte med `earMode: 'under'` må højst være earGap · 1,15 brede. */
export const EAR_GAP_FACTOR = 1.15
/** Højst 10 % af (genstand, art)-par må have en overskrivning. */
export const MAX_OVERRIDE_SHARE = 0.1

export interface Wearer {
  id: CreatureId
  family: Family
}

type FitItem = Pick<ItemDef, 'slot' | 'fit'>

export function fitItem(item: FitItem, a: AnchorSet, who: Wearer): FitResult {
  const f = item.fit
  // 1. Skalér efter ankermålet.
  let scale = f.scaleBy === 'fixed' ? f.baseScale : (f.baseScale * a[f.scaleBy]) / FIT_REFERENCE[f.scaleBy]
  // 2. Hatte mellem ørerne klemmes til earGap · 1,15.
  const earMode = item.slot === 'head' ? (f.earMode ?? 'through') : 'through'
  if (item.slot === 'head' && earMode === 'under') scale = Math.min(scale, (a.earGap * EAR_GAP_FACTOR) / f.baseWidth)
  // 5. Håndgenstande følger potens vinkel.
  let rot = item.slot === 'hand' ? a.handRot : 0
  const anchor = a[f.anchor]
  let { x, y } = anchor
  // 4 (katalogreglen): overskrivninger slås op pr. art og derefter pr. familie.
  const key = f.overrides?.[who.id] ? who.id : f.overrides?.[who.family] ? who.family : null
  if (key) {
    const o = f.overrides![key]!
    x += o.dx ?? 0
    y += o.dy ?? 0
    scale *= o.scale ?? 1
    rot += o.rot ?? 0
  }
  return { x, y, scale, rot, earMode, override: key }
}

/** SVG-transform for et fit-resultat: translate → rotate → scale. */
export function fitTransform(r: FitResult): string {
  return `translate(${n(r.x)} ${n(r.y)})${r.rot ? ` rotate(${n(r.rot)})` : ''} scale(${fmt3(r.scale)})`
}

/** Modelpunkt → genstandens lokale koordinater (invers af fitTransform). */
export function toLocal(r: FitResult, p: Pt): Pt {
  const dx = p.x - r.x
  const dy = p.y - r.y
  const t = (-r.rot * Math.PI) / 180
  return {
    x: (dx * Math.cos(t) - dy * Math.sin(t)) / r.scale,
    y: (dx * Math.sin(t) + dy * Math.cos(t)) / r.scale,
  }
}

/** Invers transform som SVG-streng (modelrum inde i genstandens gruppe). */
export function inverseTransform(r: FitResult): string {
  return `scale(${fmt3(1 / r.scale)})${r.rot ? ` rotate(${n(-r.rot)})` : ''} translate(${n(-r.x)} ${n(-r.y)})`
}

/** Andelen af (genstand, art)-par, der bruger en overskrivning (regel 7: ≤ 10 %). */
export function overrideShare(items: readonly FitItem[], wearers: readonly (Wearer & { anchors: AnchorSet })[]): number {
  let pairs = 0
  let over = 0
  for (const it of items)
    for (const w of wearers) {
      pairs++
      if (fitItem(it, w.anchors, w).override) over++
    }
  return pairs ? over / pairs : 0
}
