// Rytter · krop: en ridejakke med reverser, en hvid plastron i V-halsen med en lille nål, knapper, to
// lommeklapper og forstykker, der skilles under den nederste knap. Kropstøj klippes af riggen til artens
// krop (konturen/2 udenfor); jakken klipper sig selv til sin længde og streger kroppens kontur igen inden
// for den, så pelsen ses under jakkens kant. Lange ærmer starter ved skulderen og ender i en hvid
// skjortemanchet over poten (review G1-r4, T5: ærmer starter ved skulderen); på løftede arme følger ærmet
// armen fra skulderen. Babyens korte torso får kanten, lommerne og knapperne højere oppe. Én parametrisk
// tegning giver de 3 grundformer (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, outside, poly, rect, softBand, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, SleeveArt, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** Halsudskæringens y (lokalt) og jakkens kant (hoften). */
  collar: number
  hem: number
}

const CUTS: Record<BodyKind, Cut> = {
  round: { collar: -36, hem: 20 },
  pear: { collar: -34, hem: 23 },
  tall: { collar: -40, hem: 17 },
}
/** Babyens torso er kortere: kanten, lommerne og knapperne sidder højere. */
const BABY_LIFT = 7
/** Kanten buer nedad midtpå (kroppens rundning set forfra). */
const SAG = 2.6

/** Kanten fra venstre mod højre med forstykkerne, der skilles midtpå (en omvendt V under knapperne). */
function hemPts(y: number): Vec[] {
  const at = (x: number) => y + SAG * (1 - (x / 80) ** 2)
  return [[-90, at(-90)], [-60, at(-60)], [-30, at(-30)], [-10, at(-10) + 1.4], [0, at(0) - 7], [10, at(10) + 1.4], [30, at(30)], [60, at(60)], [90, at(90)]]
}

/** Revers, plastron, knapper og lommeklapper ud fra halsudskæringen og kanten. */
function details(collar: number, hem: number) {
  const top = collar - 8
  const vb = collar + 21
  const lapel = (s: 1 | -1): Vec[] => [[s * 12, top], [s * 23.5, collar + 6], [s * 17.5, collar + 8.2], [s * 21, collar + 13], [s * 1.6, vb + 1.4]]
  const flap = (s: 1 | -1): Vec[] => [[s * 39, hem - 13], [s * 19, hem - 11.6], [s * 19.6, hem - 6.6], [s * 39.6, hem - 8.2]]
  return {
    shirt: poly([[-12.5, top], [0, vb], [12.5, top]]),
    pin: rect(-3.2, vb - 9.6, 6.4, 2.6, 1.2),
    lapels: join(blob(lapel(-1), 0.25), blob(lapel(1), 0.25)),
    buttons: join(circle(0, vb + 7.5, 2.3), circle(0, vb + 16.5, 2.3)),
    flaps: join(poly(flap(-1)), poly(flap(1))),
  }
}

/** Jakken lagt fladt (ikon uden bærer): krop, lange ærmer, der hænger let ud til siden, og skøder. */
const FLAT = blob(
  symmetric([
    [0, -36], [-12.5, -41], [-28, -38.5], [-42, -30.5], [-52.5, -9], [-58, 15], [-46.5, 18.5], [-39.5, -5],
    [-38.5, 26], [-9, 28.5], [0, 22],
  ]),
  0.45,
)

const jacket = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const k = CUTS[kind]
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lift = !solo && stage === 1 ? BABY_LIFT : 0
  const collar = solo ? -36 : k.collar
  const hem = solo ? 24 : k.hem - lift
  const d = details(collar, hem)
  const hp = hemPts(hem)
  const shape = solo ? FLAT : poly([[-90, -90], [90, -90], ...hp.slice().reverse()])
  const clip = `${ids.uid}-rj-${solo ? 'flat' : kind}`
  // Skyggen: alt uden for en lys ellipse forskudt op mod venstre (riggen klipper til kroppen).
  const lit = ellipse(-8, -12, 51, 47.5)
  return (
    <>
      <clipPath id={clip}>
        <path d={shape} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 130)} fill={c.main} />
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        <path d={d.shirt} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
        <path d={d.lapels} fill={c.main} {...stroke} />
        <path d={d.flaps} fill={c.mainShade} {...stroke} strokeWidth={sw * 0.8} />
        <path d={join(d.buttons, d.pin)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.5} />
        {!solo && restroke()}
      </g>
      <path d={solo ? FLAT : poly(hp, false)} fill="none" {...stroke} />
    </>
  )
}

/** Ærmet: jakkens stof og en hvid skjortemanchet over poten (et langt ærme følger forbenet fra skulderen). */
const sleeve: SleeveArt = ({ c, sw, sleeve: d, cuff, long }) => {
  const y0 = cuff.y
  return (
    <>
      <path d={long ? long.d : d} fill={c.main} stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      <path d={softBand(-cuff.half + 2.6, cuff.half - 2.6, y0 - 2.4, y0 + 3, 1.8, 1.8)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
    </>
  )
}

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme stof og skjortemanchet. */
const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, cuff }) => (
  <>
    <path d={fill} fill={c.main} />
    <path d={edge} fill="none" stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    <path d={cuff} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
  </>
)

export const rytterBody: ItemDef = {
  id: 'rytter-body',
  set: 'rytter',
  slot: 'body',
  nameClip: 'name.item.rytter-body',
  source: { kind: 'finale', world: 'bakke' },
  colorways: [
    fabric('marine', 'marineblå', 'navy', 'snow', 'gold'),
    fabric('roed', 'rød', 'tomato', 'cream', 'gold'),
    fabric('oliven', 'olivengrøn', 'olive', 'cream', 'cocoa'),
  ],
  art: {
    front: jacket('round'),
    bodyShapes: { round: jacket('round'), pear: jacket('pear'), tall: jacket('tall') },
    sleeve,
    sleeveUp,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-61, -43, 122, 73] },
}

export default rytterBody
