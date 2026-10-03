// Ridder · hoved: en ridderhjelm i blankt stål. En rund, tætsiddende kuppel med en kam ned over midten, et
// pandebånd med nitter og en stor fjerbusk, der rejser sig fra en lille holder på toppen og svinger bagud.
// earMode 'through' som ridehjelmen: ørerne går op gennem to huller i kuplen, og hullets forkant (`rim`)
// lægges oven på ørernes rod. Enhjørningen får et hornhul over hornets rod, og fjerbusken flytter til
// venstre for hornet, så hornet står frit. Hjelmen har intet visir og ingen næseskærm: den slutter med
// pandebåndet over øjnene på alle arter og stadier. Pandelokken ligger under hjelmen.
// (0,0) = headTop, tegnet ved headWidth 104.
import type { Vec } from '../../rig/shapes'
import type { ItemArt, Pt } from '../../rig/types'
import { ceiling, cws, def, draw, fitAt, holeSeg, HORN_HOLE, rim, S } from './kit/mestring'

/** Kuplen (venstre halvdel, top → bund på midterlinjen): rund og lidt højere end ridehjelmen. */
const DOME = S.symmetric([
  [0, -20.5], [-17.5, -18], [-31.5, -10], [-41, 0.6], [-45.6, 11.6], [-46.8, 21], [0, 23.6],
])
/** Pandebåndet: et blødt bånd forneden på kuplen (y fra/til og hvor meget det hænger midtpå). */
const BAND = { x: 45.6, y0: 13.6, y1: 21.4, sag: 2.6 }
/** Nitterne i båndet (x) – de midterste udelades, når hornet går op gennem hjelmen. */
const RIVETS = [-36, -24, -12, 0, 12, 24, 36]

/**
 * Fjerbuskens fod på toppen af kuplen: midt på (busken svinger bagud mod højre), eller til venstre for et horn
 * (spejlet, så busken svinger ud mod venstre, væk fra hornet).
 */
function plumeAt(horn: Pt | null | undefined): { x: number; y: number; rot: number; dir: 1 | -1 } {
  return horn ? { x: horn.x - 20, y: -14.6, rot: -12, dir: -1 } : { x: 0, y: -19.2, rot: 0, dir: 1 }
}

/**
 * Fjerbusken i egne koordinater (foden i (0,0), op ad −y): en buet busk, der rejser sig og svinger bagud mod
 * højre med tre bløde fjer forneden og en hængende spids. Højden er `PLUME_H`.
 */
const PLUME: Vec[] = [
  [-4.4, -1], [-6.6, -8], [-5, -13.6], [1.4, -17.2], [10, -17.8], [18.6, -15], [25, -10], [27.4, -3.4],
  [21, -6.6], [20, -2], [14, -7], [12, -2.4], [6.6, -7], [4.4, -1],
]
const PLUME_H = 17.8

const front: ItemArt = ({ c, sw, a, local, holes, horn, stage, solo }) => {
  const lit = S.litCopy(DOME, [-24, -10], 0.88)
  const pl = plumeAt(horn)
  // Busken skaleres ned, hvor der er mindre plads over hovedet (stor på de høje arter), dog højst til 0,6.
  const f = Math.max(0.6, Math.min(1.3, (pl.y - ceiling({ a, local, stage, solo })) / (PLUME_H + sw)))
  const plume = (pts: readonly Vec[]) => S.xf(pts, { sx: pl.dir * f, sy: f, rot: pl.rot, dx: pl.x, dy: pl.y })
  // Kammen ned over midten (til venstre for et horn, så hornet står frit).
  const ridgeX = horn ? horn.x - 21 : 0
  const ridge = S.spline([[ridgeX, -20], [ridgeX - 0.6, -6], [ridgeX - 0.4, 6], [ridgeX, 13.4]])
  const rivets = S.join(...RIVETS.map((x) => S.circle(x, BAND.y0 + (BAND.y1 - BAND.y0) / 2 + BAND.sag * (1 - (x / BAND.x) ** 2) - 0.2, 1.9)))
  // Kuplens højlys ligger mindst 6 enheder fra alle huller (med horn: ude til højre for hornhullet).
  const shine = horn ? { x: horn.x + 22, y: -3 } : { x: -14, y: -6 }
  return draw(
    [S.blob(DOME, 0.9), c.mainShade],
    [S.blob(lit, 0.9), c.main],
    [ridge, 'none', c.outline, sw * 1.9],
    [ridge, 'none', c.main, sw * 0.9],
    [S.blob(DOME, 0.9), 'none', c.outline, sw],
    holeSeg({ c, a, local, holes, horn }),
    [S.softBand(-BAND.x, BAND.x, BAND.y0, BAND.y1, BAND.sag, BAND.sag + 0.2), c.trim, c.trimOutline, sw],
    [rivets, c.trimShade, c.trimOutline, sw * 0.45],
    // Fjerbusken og holderen på toppen.
    [S.blob(plume(PLUME), 0.55), c.accent, c.accentOutline, sw],
    [S.blob(plume([[-5, 1.8], [-4.4, -3.6], [4.4, -3.6], [5, 1.8]]), 0.3), c.trim, c.trimOutline, sw * 0.8],
    // Stålets højlys: et langt på kuplen og et lille på fjerbusken.
    [S.join(S.ellipse(shine.x, shine.y, 5.6, 2.2, -30), S.ellipse(shine.x - 8.6, shine.y + 9.4, 1.8, 1.4, -30)), c.highlight],
  )
}

export const ridderHead = def('ridder-head', {
  colorways: cws('staal|stål|silver|gold|tomato', 'guld|guld|gold|silver|sky', 'nat|natsort|charcoal|silver|mint'),
  art: { front, rim },
  fit: fitAt('headTop', 'headWidth', 96),
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-48, -45, 96, 70] },
})

export default ridderHead
