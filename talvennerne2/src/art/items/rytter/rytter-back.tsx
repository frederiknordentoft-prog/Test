// Rytter · ryg: en dobbelt sadeltaske. To bløde lærposer hænger på flankerne ved hoften, bag kroppen (lag 2) og
// bag armene, med klap, spænde og rem på posens yderside, så hver pose ses ved siden af kroppen på butikskortet og
// i spillet (review G1-r4, B1). Remmen over ryggen anes kun som en kort stump ved hoften (stroplaget 6b: klippet til
// kroppen, så den forsvinder rundt om flanken); der går ingen stang hen over skødet (review G2-r1, T12 og B9). Posen
// stikker højst ca. 6 enheder ud over hoften på stor og holder sig i den sikre zone. Alene (butik) ligger de to poser
// side om side, samlet af remmen foroven. Poserne rækker med vilje ud over silhuetten (`reach`). (0,0) = bodyCenter,
// tegnet ved bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, join, softBand } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemArtProps, ItemDef, Stage } from '../../rig/types'

/** Posernes centrum (x til hver side), bredde og højde. */
interface Bags {
  x: number
  y: number
  w: number
  h: number
  /** Posens hældning (grader, udad foroven ved hoften). */
  tilt: number
}
/** På dyret: poserne er højere end brede (poser, ikke en bakke). */
const WORN = { w: 21, h: 29 }
/** Hvor langt posen stikker ud over hoften pr. stadie (lokale enheder; review G2-r1, T12: højst ca. 6 på stor). */
const OUT: Record<Stage, number> = { 1: 13, 2: 11, 3: 6.5 }
const SOLO: Bags = { x: 17.5, y: 7, w: 28, h: 38, tilt: 0 }

/** En pose (venstre s = −1, højre s = 1) som stier: krop, skygge, klap, rem, spænde og glans. */
function bag(b: Bags, s: 1 | -1) {
  const cx = s * b.x
  const hw = b.w / 2
  const top = b.y - b.h / 2
  const bot = b.y + b.h / 2
  const fy = top + b.h * 0.44
  const t = (s * b.tilt * Math.PI) / 180
  const turn = (pts: Vec[]): Vec[] => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(t) - (y - b.y) * Math.sin(t), b.y + (x - cx) * Math.sin(t) + (y - b.y) * Math.cos(t)])
  // Remmen og spændet sidder på posens ydre halvdel, så de ses ved siden af kroppen.
  const sx = cx + s * hw * 0.28
  const body: Vec[] = [
    [cx - hw * 0.84, top + 1.5], [cx + hw * 0.84, top + 1.5], [cx + hw, top + b.h * 0.42], [cx + hw * 0.94, bot - 6],
    [cx + hw * 0.55, bot], [cx - hw * 0.55, bot], [cx - hw * 0.94, bot - 6], [cx - hw, top + b.h * 0.42],
  ]
  const shade: Vec[] = [[cx - hw * 0.98, bot - 10], [cx + hw * 0.98, bot - 10], [cx + hw * 0.92, bot - 5], [cx + hw * 0.52, bot - 0.5], [cx - hw * 0.52, bot - 0.5], [cx - hw * 0.92, bot - 5]]
  const flap: Vec[] = [[cx - hw - 1, top], [cx + hw + 1, top], [cx + hw + 0.6, fy - 2.4], [sx, fy + 2.8], [cx - hw - 0.6, fy - 2.4]]
  return {
    body: blob(turn(body), 0.6),
    shade: blob(turn(shade), 0.5),
    flap: blob(turn(flap), 0.35),
    strap: blob(turn([[sx - 2.3, fy - 2], [sx + 2.3, fy - 2], [sx + 2.3, fy + b.h * 0.3], [sx - 2.3, fy + b.h * 0.3]]), 0.3),
    buckle: blob(turn([[sx - 3.4, fy - 0.6], [sx + 3.4, fy - 0.6], [sx + 3.4, fy + 4.8], [sx - 3.4, fy + 4.8]]), 0.4),
    shine: blob(turn([[cx - s * hw * 0.5, top + b.h * 0.5], [cx - s * hw * 0.38, top + b.h * 0.5], [cx - s * hw * 0.4, top + b.h * 0.78], [cx - s * hw * 0.52, top + b.h * 0.78]]), 0.9),
  }
}

/** Begge poser som samlede stier. */
function bags(b: Bags) {
  const [l, r] = [bag(b, -1), bag(b, 1)]
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
 * Posernes højde pr. kropsform (brøk af bodyRy under midten): ved hoften over lårene og fødderne (de tegnes
 * foran ryggenstanden og ville ellers skjule poserne), bag armene.
 */
const HIP_Y: Record<BodyKind, number> = { round: 0.08, pear: 0.08, tall: -0.02 }

/** Hoftens højde og flankens kant (lokalt) og hvor langt ud poserne må sidde i den sikre zone. */
function hip(p: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'body'>) {
  const k = STAGE_XF[p.stage].fig * STAGE_XF[p.stage].body
  const model = (wx: number) => p.a.ground.x + (wx - p.a.ground.x) / k
  const y = p.a.bodyCenter.y + p.a.bodyRy * HIP_Y[p.body]
  const edge = p.local({ x: p.a.bodyCenter.x + p.a.bodyRx, y })
  const l = p.local({ x: model(SAFE.x0 + 2.5), y: p.a.bodyCenter.y })
  const r = p.local({ x: model(SAFE.x1 - 2.5), y: p.a.bodyCenter.y })
  return { x: edge.x, y: edge.y, safe: Math.min(-l.x, r.x) }
}

/** Posernes plads på dyret: ved hoften, `OUT` ud over flanken, aldrig uden for den sikre zone. */
function worn(p: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'sw' | 'body'>): Bags {
  const h = hip(p)
  const x = Math.min(h.x + OUT[p.stage] - WORN.w / 2, h.safe - WORN.w / 2 - 1.2 - p.sw)
  return { x, y: h.y + 2, w: WORN.w, h: WORN.h, tilt: 6 }
}

const front: ItemArt = ({ c, sw, solo, a, local, stage, body }) => {
  const b = solo ? SOLO : worn({ a, local, stage, sw, body })
  const p = bags(b)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const top = b.y - b.h / 2
  return (
    <>
      {/* Remmen over ryggen: alene samler den poserne foroven; på dyret går den skråt op bag kroppen fra posens
          inderside (kroppen dækker resten, så kun en stump anes ved hoften). */}
      {solo ? (
        <path d={softBand(-14, 14, -16.5, -10, 1.6, 1.6)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      ) : (
        <path
          d={join(...([-1, 1] as const).map((s) => blob([[s * (b.x - 4), top + 4], [s * (b.x - 4), top - 1.5], [s * (b.x - 26), top - 12], [s * (b.x - 26), top - 6]], 0.3)))}
          fill={c.trim}
          stroke={c.trimOutline}
          strokeWidth={sw * 0.8}
          strokeLinejoin="round"
        />
      )}
      <path d={p.body} fill={c.main} {...stroke} />
      <path d={p.shade} fill={c.mainShade} />
      <path d={p.flap} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={p.strap} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={p.buckle} fill="none" stroke={c.accentOutline} strokeWidth={sw * 1.5} strokeLinejoin="round" />
      <path d={p.buckle} fill="none" stroke={c.accent} strokeWidth={sw * 0.6} strokeLinejoin="round" />
      <path d={p.shine} fill={c.highlight} />
    </>
  )
}

/**
 * Remmens stump ved hoften (lag 6b, klippet til kroppen): en kort, skrå rem fra flanken ind over hoften, der
 * forsvinder rundt om kroppens side mod posen. Ingen brystrem og ingen stang hen over skødet (review G2-r1, T12).
 */
const straps: ItemArt = ({ c, sw, ids, restroke, body: kind, a, local, stage }) => {
  const clip = `${ids.uid}-rs-${kind}`
  const h = hip({ a, local, stage, body: kind })
  const y = h.y - WORN.h / 2 + 3
  const stub = (s: 1 | -1) => blob([[s * (h.x + 6), y - 4.4], [s * (h.x + 6), y + 0.6], [s * (h.x - 8), y + 3.6], [s * (h.x - 8), y - 1.4]], 0.3)
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={join(stub(-1), stub(1))} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
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
