// Opdager · ryg: et sommerfuglenet båret skråt bag ryggen. Skaftet går fra bøjlen ved hovedets
// øverste venstre side (set forfra, væk fra tankeprikker og ballon) skråt ned bag kroppen, og
// håndtagets ende stikker frem ved højre hofte. Bøjlen og nettets pose ligger bag hovedet (lag 2), så
// hoved, ører og manke dækker det, der overlapper; bøjlens plads regnes ud fra hovedets størrelse i
// stadiet (babyens hoved er større) og holdes i den sikre zone. En læderrem går skråt over brystet
// (stroplaget, klippet til kroppen og under poterne), parallelt med skaftet. Alene (butik) står nettet
// skråt med posen hængende. Nettet rækker med vilje ud over silhuetten (`reach`).
// (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { SAFE, STAGE_XF } from '../../rig/anchors'
import { fabric } from '../../rig/palette'
import { blob, capsule, circle, join, line, ribbon, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, BodyKind, ItemArt, ItemDef, Pt, Stage } from '../../rig/types'

/** Bøjlens radius og skaftets halve bredde (modelenheder i kroppens region). */
const R = 17.5
const SHAFT = 2.5

interface Net {
  /** Bøjlens centrum, skaftets to ender (håndtag og bøjle) i genstandens lokale koordinater og målestok. */
  hoop: Vec
  grip: Vec
  neck: Vec
  r: number
  k: number
  /** Den del af skaftet (andele fra bøjlen mod håndtaget), der er skjult bag hovedet og ikke tegnes. */
  hidden: readonly [number, number] | null
}

/** Nettets placering i posen: bøjlen ved hovedets øverste venstre side, håndtaget ved højre hofte. */
function netOn(a: AnchorSet, stage: Stage, local: (p: Pt) => Pt): Net {
  const xf0 = STAGE_XF[stage]
  // Hovedet i kroppens modelrum (hovedregionen skaleres om halsleddet med hoved/krop).
  const kh = xf0.head / xf0.body
  const hc = { x: a.neck.x + (a.headCenter.x - a.neck.x) * kh, y: a.neck.y + (a.headCenter.y - a.neck.y) * kh }
  const hrx = a.headRx * kh
  const hry = a.headRy * kh
  // Verdensrummets sikre zone ført ind i kroppens modelrum (kroppen skaleres om fodpunktet).
  const sb = xf0.fig * xf0.body
  const minX = a.ground.x + (SAFE.x0 + 2.5 - a.ground.x) / sb + R
  const minY = a.ground.y + (SAFE.y0 + 2.5 - a.ground.y) / sb + R
  const hoop = { x: Math.max(hc.x - hrx - R * 0.5, minX), y: Math.max(hc.y - hry * 0.62, minY) }
  const grip = { x: a.bodyCenter.x + a.bodyRx * 1.18, y: a.bodyCenter.y + a.bodyRy * 0.72 }
  // Skaftet ender i bøjlens rand mod hoften.
  const d = Math.hypot(grip.x - hoop.x, grip.y - hoop.y)
  const neck = { x: hoop.x + ((grip.x - hoop.x) * R) / d, y: hoop.y + ((grip.y - hoop.y) * R) / d }
  // Skaftet går bag hovedet: stykket inden for hovedets ellipse (lidt indenfor randen) tegnes ikke, så
  // det aldrig ligger bag øjnene (kontaktarkets øjenlint ser ikke lagene).
  const hidden = chord(neck, grip, hc, hrx * 0.9, hry * 0.9)
  const o = local(hoop)
  const e = local({ x: hoop.x + 1, y: hoop.y })
  const k = Math.hypot(e.x - o.x, e.y - o.y)
  const v = (p: Pt): Vec => {
    const q = local(p)
    return [q.x, q.y]
  }
  return { hoop: v(hoop), grip: v(grip), neck: v(neck), r: R * k, k, hidden }
}

/** Hvor linjestykket a→b skærer ellipsen (andele t0 < t1), eller null. */
function chord(a: Pt, b: Pt, c: Pt, rx: number, ry: number): readonly [number, number] | null {
  const dx = (b.x - a.x) / rx
  const dy = (b.y - a.y) / ry
  const fx = (a.x - c.x) / rx
  const fy = (a.y - c.y) / ry
  const A = dx * dx + dy * dy
  const B = 2 * (fx * dx + fy * dy)
  const C = fx * fx + fy * fy - 1
  const disc = B * B - 4 * A * C
  if (disc <= 0) return null
  const t0 = Math.max(0, (-B - Math.sqrt(disc)) / (2 * A))
  const t1 = Math.min(1, (-B + Math.sqrt(disc)) / (2 * A))
  return t1 > t0 ? [t0, t1] : null
}

/** Alene (butik): skaftet skråt fra nederst til højre op til bøjlen øverst til venstre. */
const SOLO: Net = { hoop: [-22, -28], grip: [30, 40], neck: [-22 + R * 0.607, -28 + R * 0.794], r: R, k: 1, hidden: null }

/** Nettets pose: hænger ned fra bøjlen (tyngdekraften) med en rund bund. */
function bag(h: Vec, r: number): Vec[] {
  return xf(
    [[-1, 0], [-1.16, 0.78], [-1.12, 1.62], [-0.82, 2.26], [-0.36, 2.42], [-0.02, 2.06], [0.38, 1.28], [0.82, 0.62], [1, 0], [0.7, -0.7], [0, -1], [-0.7, -0.7]],
    { sx: r, dx: h[0], dy: h[1] },
  )
}

/** Maskerne: to sæt skrå linjer hen over posen (klippes til posen). */
function mesh(h: Vec, r: number): string {
  const ls: string[] = []
  for (let i = -5; i <= 4; i++) {
    const o = i * r * 0.42
    ls.push(line([h[0] - r * 1.3 + o, h[1] - r * 1.1], [h[0] + r * 0.9 + o, h[1] + r * 2.5]))
    ls.push(line([h[0] + r * 1.1 + o, h[1] - r * 1.1], [h[0] - r * 1.1 + o, h[1] + r * 2.5]))
  }
  return join(...ls)
}

const front: ItemArt = ({ c, sw, a, local, stage, solo, ids }) => {
  const N = solo ? SOLO : netOn(a, stage, local)
  const clip = `${ids.uid}-on`
  const at = (t: number): Vec => [N.neck[0] + (N.grip[0] - N.neck[0]) * t, N.neck[1] + (N.grip[1] - N.neck[1]) * t]
  // Skaftet i ét eller to stykker (bøjle → hoved, hoved → håndtag), når midten er skjult bag hovedet.
  const shaft = N.hidden
    ? join(
        N.hidden[0] > 0.02 ? capsule(N.neck, at(N.hidden[0]), SHAFT * N.k) : '',
        N.hidden[1] < 0.98 ? capsule(at(N.hidden[1]), N.grip, SHAFT * N.k, SHAFT * N.k * 1.15) : '',
      )
    : capsule(N.grip, N.neck, SHAFT * N.k * 1.15, SHAFT * N.k)
  const g0 = N.hidden ? Math.max(N.hidden[1] + 0.04, 0.14) : 0.14
  const grain = g0 < 0.9 ? capsule(at(g0), at(0.92), SHAFT * N.k * 0.32) : ''
  const pouch = blob(bag(N.hoop, N.r), 0.85)
  return (
    <>
      <path d={pouch} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <clipPath id={clip}>
        <path d={pouch} />
      </clipPath>
      <path d={mesh(N.hoop, N.r)} fill="none" stroke={c.trimOutline} strokeWidth={sw * 0.32} opacity={0.75} clipPath={`url(#${clip})`} />
      <path d={shaft} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={grain} fill={c.accentShade} />
      <path d={circle(N.hoop[0], N.hoop[1], N.r)} fill="none" stroke={c.outline} strokeWidth={sw * 2.1} />
      <path d={circle(N.hoop[0], N.hoop[1], N.r)} fill="none" stroke={c.main} strokeWidth={sw * 0.95} />
    </>
  )
}

/** Læderremmen over brystet: fra venstre skulder ned mod højre hofte, parallelt med skaftet. */
const STRAP: Record<BodyKind, Vec[]> = {
  round: [[-24, -58], [-4, -34], [18, -12], [44, 12], [62, 26]],
  pear: [[-24, -54], [-4, -31], [19, -9], [46, 14], [64, 28]],
  tall: [[-22, -66], [-4, -42], [16, -20], [38, 4], [56, 22]],
}

const straps: ItemArt = ({ c, sw, ids, restroke, body }) => {
  const clip = `${ids.uid}-or`
  const s = STRAP[body]
  const mid = s[2]
  const t = Math.atan2(s[3][1] - s[1][1], s[3][0] - s[1][0]) * (180 / Math.PI)
  const buckle = xf([[-4.2, -4.6], [4.2, -4.6], [4.2, 4.6], [-4.2, 4.6]], { rot: t, dx: mid[0], dy: mid[1] })
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={blob(ribbon(s, 7), 0.55)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw} strokeLinejoin="round" />
        <path d={blob(buckle, 0.4)} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      </g>
    </>
  )
}

export const opdagerBack: ItemDef = {
  id: 'opdager-back',
  set: 'opdager',
  slot: 'back',
  nameClip: 'name.item.opdager-back',
  source: { kind: 'finale', world: 'eng' },
  colorways: [
    fabric('groen', 'grøn', 'leaf', 'snow', 'cocoa'),
    fabric('gul', 'solgul', 'sunflower', 'cream', 'cocoa'),
    fabric('blaa', 'himmelblå', 'sky', 'snow', 'navy'),
  ],
  art: { front, straps },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  reach: true,
  icon: { box: [-44.5, -47.5, 78, 91] },
}

export default opdagerBack
