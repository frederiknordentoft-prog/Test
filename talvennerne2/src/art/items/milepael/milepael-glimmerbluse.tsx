// Milepæl · krop (niveau 25): glimmerbluse. En bluse med rund dukkekrave, en flæsekant ved hoften og
// glimmer: små firtakkede stjerner og prikker spredt over stoffet. Kropstøj klippes af riggen til artens
// krop (konturen/2 udenfor); blusen klipper sig selv ved flæsekanten og streger kroppens kontur igen inden
// for sit område. Ærmerne tegnes på armene i alle poser (hvilende og løftede) med en flæsemanchet over
// poten. Babyens korte torso får flæsekanten højere oppe. Én parametrisk tegning giver de 3 grundformer
// (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { band, blob, circle, ellipse, join, outside, rect, scallop, star, symmetric } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemDef, SleeveArt, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** Kravens y (lokalt, (0,0) = bodyCenter) og flæsekantens midte. */
  collar: number
  hem: number
}
const CUTS: Record<BodyKind, Cut> = {
  round: { collar: -36, hem: 13 },
  pear: { collar: -34, hem: 16 },
  tall: { collar: -40, hem: 10 },
}
/** Kanten buer nedad midtpå (kroppens rundning set forfra). */
const SAG = 2.6
/** Babyens torso er kortere: flæsekanten sidder højere. */
const BABY_LIFT = 7

/** Glimmeret: stjerner (x, y, størrelse) og prikker spredt over blusen. */
const STARS: [number, number, number][] = [[-30, -20, 4.2], [26, -26, 3.6], [36, 0, 4], [-38, 4, 3.4], [-8, -6, 3.2], [16, 6, 3.8], [-20, -36, 3]]
const DOTS: Vec[] = [[-14, -24], [8, -30], [30, -12], [-26, -6], [2, 8], [-34, -14], [22, -4], [-4, -18]]
const glitter = (dy: number) => ({
  stars: join(...STARS.map(([x, y, r]) => star(x, y + dy, r, r * 0.3))),
  dots: join(...DOTS.map(([x, y]) => circle(x, y + dy, 1.3))),
})

/** Dukkekraven: to runde flipper, der mødes midt foran. */
const COLLAR_HALF: Vec[] = [[0, 0], [-6, -2], [-15, -1.5], [-21, 2], [-20, 7.5], [-13, 10], [-5, 8]]
const collar = (y: number) => join(blob(COLLAR_HALF.map(([x, yy]) => [x, y + yy] as Vec), 0.8), blob(COLLAR_HALF.map(([x, yy]) => [-x, y + yy] as Vec), 0.8))

/** Blusen lagt fladt (ikon uden bærer): krop, pufærmer og flæsekant. Venstre halvdel. */
const FLAT = blob(
  symmetric([[0, -34], [-14, -38.5], [-29, -36.5], [-44, -27], [-56, -10], [-48, -1], [-36, -12], [-37, 16], [0, 17.5]]),
  0.5,
)

const blouse = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const k = CUTS[kind]
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lift = !solo && stage === 1 ? BABY_LIFT : 0
  const hem = solo ? 15 : k.hem - lift
  const clip = `${ids.uid}-gb-${solo ? 'flat' : kind}`
  const g = glitter(solo ? 2 : lift * -0.5)
  const lit = ellipse(-8, -12, 51, 47.5)
  return (
    <>
      <clipPath id={clip}>
        <path d={solo ? FLAT : band(-90, 90, -90, hem, 0, SAG)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 120)} fill={c.main} />
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        <path d={g.stars} fill={c.accent} />
        <path d={g.dots} fill={c.highlight} />
        {!solo && restroke()}
      </g>
      {solo && <path d={FLAT} fill="none" {...stroke} />}
      <path d={scallop(0, hem + SAG, solo ? 40 : 58, 4.6, 18, 0.62, 0)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      <path d={collar(solo ? -38 : k.collar - 4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.85} strokeLinejoin="round" />
    </>
  )
}

/** Ærmet: blusens stof og en flæsemanchet over poten. */
const sleeve: SleeveArt = ({ c, sw, sleeve: d, cuff }) => (
  <>
    <path d={d} fill={c.main} stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" />
    <path d={scallop(0, cuff.y, cuff.half + 0.6, 3.2, 8, 0.62, 0)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
  </>
)

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme stof og en flæsemanchet. */
const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, cuff }) => (
  <>
    <path d={fill} fill={c.main} />
    <path d={edge} fill="none" stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    <path d={cuff} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
  </>
)

export const milepaelGlimmerbluse: ItemDef = {
  id: 'milepael-glimmerbluse',
  set: 'milepael',
  slot: 'body',
  nameClip: 'name.item.milepael-glimmerbluse',
  source: { kind: 'level', level: 25 },
  colorways: [
    fabric('lilla', 'lilla', 'lilac', 'snow', 'sunflower'),
    fabric('rosa', 'rosa', 'rose', 'snow', 'sunflower'),
    fabric('mint', 'mintgrøn', 'mint', 'cream', 'violet'),
  ],
  art: {
    front: blouse('round'),
    bodyShapes: { round: blouse('round'), pear: blouse('pear'), tall: blouse('tall') },
    sleeve,
    sleeveUp,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-58, -42, 116, 64] },
}

export default milepaelGlimmerbluse
