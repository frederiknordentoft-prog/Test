// Rytter · ryg: en dobbelt sadeltaske. De to lædertasker hænger bag kroppen (lag 2) på hver sin side
// af flanken, så mindst halvdelen af hver taske med klap, rem og spænde ses ved siden af kroppen på
// butikskortet og i spillet (review G1-r4, B1: ryggenstande skal kunne ses forfra). På stor klemmes de
// ind, så de bliver i den sikre zone. En brystrem (stroplaget 6b: over kroppen og kropstøjet, under poterne og
// halsgenstanden) går hen over brystet med et spænde og forsvinder rundt om kroppens sider, så taskerne
// ser fastspændte ud. Alene (butik) ligger de to tasker side om side, samlet af et læderstykke foroven.
// Taskerne rækker med vilje ud over silhuetten (`reach`). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, poly, rect, softBand } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemArtProps, ItemDef } from '../../rig/types'

/** Taskernes centrum (x til hver side), bredde og højde: på dyret og alene. */
interface Bags {
  x: number
  y: number
  w: number
  h: number
}
const WORN: Bags = { x: 60, y: -1, w: 28, h: 36 }
/** Taskernes højde pr. kropsform: på de runde kroppe lidt lavere, så de hænger ved hoften og ikke ved armene. */
const WORN_Y: Record<BodyKind, number> = { round: 4, pear: 4, tall: -1 }
const SOLO: Bags = { x: 19.5, y: 6, w: 30, h: 38 }

/** Begge tasker (venstre og højre) som samlede stier: krop, skygge, klap, rem, spænde og syning. */
function bags(b: Bags) {
  const one = (s: 1 | -1) => {
    const cx = s * b.x
    const hw = b.w / 2
    const top = b.y - b.h / 2
    const bot = b.y + b.h / 2
    const fy = top + b.h * 0.42
    // Remmen sidder på taskens ydre halvdel, så den ses ved siden af kroppen.
    const sx = cx + s * hw * 0.3
    const body: Vec[] = [[cx - hw, top + 2], [cx + hw, top + 2], [cx + hw + 1.2, bot - 5], [cx + hw - 3.4, bot], [cx - hw + 3.4, bot], [cx - hw - 1.2, bot - 5]]
    const shade: Vec[] = [[cx - hw - 0.4, bot - 9], [cx + hw + 0.4, bot - 9], [cx + hw + 1, bot - 4.6], [cx + hw - 3.4, bot - 0.4], [cx - hw + 3.4, bot - 0.4], [cx - hw - 1, bot - 4.6]]
    const flap: Vec[] = [[cx - hw - 1.4, top], [cx + hw + 1.4, top], [cx + hw + 0.8, fy - 2], [cx + s * hw * 0.3, fy + 2.6], [cx - hw - 0.8, fy - 2]]
    return {
      body: blob(body, 0.5),
      shade: blob(shade, 0.5),
      flap: blob(flap, 0.35),
      strap: rect(sx - 2.4, fy - 6, 4.8, b.h * 0.42, 1.2),
      buckle: rect(sx - 3.6, fy - 1.2, 7.2, 5.6, 1.6),
      shine: ellipse(cx - s * hw * 0.42, top + b.h * 0.6, 1.6, 4.6, 0),
    }
  }
  const [l, r] = [one(-1), one(1)]
  return {
    body: join(l.body, r.body),
    shade: join(l.shade, r.shade),
    flap: join(l.flap, r.flap),
    strap: join(l.strap, r.strap),
    buckle: join(l.buckle, r.buckle),
    shine: join(l.shine, r.shine),
  }
}

/**
 * Hvor langt ud taskerne må sidde (lokale enheder fra midten) for at holde sig i den sikre zone i stadiet
 * (kroppen og dermed taskerne vokser på stor), som kappen.
 */
function safeHalf(p: Pick<ItemArtProps, 'a' | 'local' | 'stage'>): number {
  const k = STAGE_XF[p.stage].fig * STAGE_XF[p.stage].body
  const model = (wx: number) => p.a.ground.x + (wx - p.a.ground.x) / k
  const l = p.local({ x: model(SAFE.x0 + 2.5), y: p.a.bodyCenter.y })
  const r = p.local({ x: model(SAFE.x1 - 2.5), y: p.a.bodyCenter.y })
  return Math.min(-l.x, r.x)
}

const front: ItemArt = ({ c, sw, solo, a, local, stage, body }) => {
  // Mindst halvdelen af hver taske ses ved siden af kroppen (review G1-r4, B1), men aldrig uden for zonen.
  const b = bags(solo ? SOLO : { ...WORN, y: WORN_Y[body], x: Math.min(WORN.x, safeHalf({ a, local, stage }) - WORN.w / 2 - 1.2 - sw) })
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <>
      {/* Alene: læderstykket, der samler taskerne foroven (på dyret ligger det over ryggen, bag kroppen). */}
      {solo && <path d={softBand(-12, 12, -17, -9.5, 1.4, 1.4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />}
      <path d={b.body} fill={c.main} {...stroke} />
      <path d={b.shade} fill={c.mainShade} />
      <path d={b.flap} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={b.strap} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={b.buckle} fill="none" stroke={c.accentOutline} strokeWidth={sw * 1.5} strokeLinejoin="round" />
      <path d={b.buckle} fill="none" stroke={c.accent} strokeWidth={sw * 0.6} strokeLinejoin="round" />
      <path d={b.shine} fill={c.highlight} />
    </>
  )
}

/** Brystremmen pr. kropsform: højde (lokalt) og hvor meget den hænger midtpå. */
const CHEST: Record<BodyKind, number> = { round: -15, pear: -12, tall: -20 }

/** Brystremmen med spænde, klippet til kroppen (den går rundt om kroppens sider). */
const straps: ItemArt = ({ c, sw, ids, restroke, body: kind }) => {
  const clip = `${ids.uid}-rs-${kind}`
  const y = CHEST[kind]
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={softBand(-70, 70, y - 2.6, y + 2.6, 3.4, 3.4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
        <path d={join(rect(-4.6, y - 3.4, 9.2, 6.8, 1.8), poly([[0, y - 2.6], [0, y + 2.6]], false))} fill="none" stroke={c.accentOutline} strokeWidth={sw * 0.75} strokeLinejoin="round" strokeLinecap="round" />
      </g>
    </>
  )
}

export const rytterBack: ItemDef = {
  id: 'rytter-back',
  set: 'rytter',
  slot: 'back',
  nameClip: 'name.item.rytter-back',
  source: { kind: 'finale', world: 'bakke' },
  colorways: [
    fabric('laeder', 'læderbrun', 'cocoa', 'sand', 'gold'),
    fabric('roed', 'rød', 'tomato', 'cocoa', 'silver'),
    fabric('havgroen', 'havgrøn', 'teal', 'cream', 'gold'),
  ],
  art: { front, straps },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 136 },
  reach: true,
  icon: { box: [-38, -19, 76, 46] },
}

export default rytterBack
