// Astronaut · hoved: en rumhjelm. En stor, rund og blank skal, der sidder tæt om hovedet, med en tyk koblingsring
// forneden (hvor dragten skrues på) med tre små lamper. Visiret er slået op: et stort tonet glasvisir ligger som en bue
// øverst på skallen med et skråt glimt, og i visirets ender sidder to runde hængsler på skallens sider. En lille antenne
// med en kugle står op fra toppen. Hjelmen slutter med ringen over øjnene på alle arter og stadier, så intet dækker
// øjnene. earMode 'through' som ridderhjelmen: ørerne går op gennem to huller i skallen, og hullets forkant (`rim`)
// lægges oven på ørernes rod. Enhjørningen får et hornhul over hornets rod, hornet står op gennem visiret, og antennen
// flytter ud til venstre for hornet. Antennen er så høj, som der er plads til over hovedet (stor på de høje arter har
// mindst plads). Dragen har horn bag ørerne, som skal op ved siden af hjelmen: på den sidder hjelmen mindre mellem
// hornene (pasformens overskrivning, ligesom en hat mellem ørerne). Pandelokken ligger under hjelmen.
// (0,0) = headTop, tegnet ved headWidth 104.
import type { Vec } from '../../rig/shapes'
import type { ItemArt, Pt } from '../../rig/types'
import { ceiling, cws, def, draw, fitAt, holeSeg, HORN_HOLE, rim, S } from '../ridder/kit/mestring'

/** Skallen (venstre halvdel, top → bund på midterlinjen): høj og rund som en kugle, bredest midt på. */
const DOME = S.symmetric([[0, -32.4], [-20.4, -29.6], [-36.6, -19.6], [-46.4, -5], [-49.4, 9.6], [-48, 21.8], [0, 24.2]])
/** Koblingsringen forneden. */
const BAND = { x: 46.6, y0: 14, y1: 22.4, sag: 2.6 }
/** Lamperne i ringen (x). */
const LIGHTS = [-32, 0, 32]
/** Det opslåede visir: en glasbue øverst på skallen (lukket form fra venstre ende over toppen til højre og tilbage). */
const VISOR: Vec[] = [
  [-35.6, -5.8], [-30.6, -14.6], [-17.6, -20.6], [0, -22.4], [17.6, -20.6], [30.6, -14.6], [35.6, -5.8],
  [30.4, -6.4], [17.4, -8.2], [0, -8.8], [-17.4, -8.2], [-30.4, -6.4],
]
/** Hængslerne i visirets ender. */
const HINGES = S.join(S.circle(-38.6, -7.4, 6.4), S.circle(38.6, -7.4, 6.4))
const HINGE_DOTS = S.join(S.circle(-38.6, -7.4, 2.4), S.circle(38.6, -7.4, 2.4))
/** Antennen: foden på toppen (midt på, eller til venstre for et horn), kuglens radius, den fulde og den korteste længde. */
const ANTENNA = { r: 3.9, len: 11, min: 5 }
const antennaAt = (horn: Pt | null | undefined): Vec => (horn ? [horn.x - 22, -27.4] : [0, -31.6])

const front: ItemArt = ({ c, sw, a, local, holes, horn, stage, solo }) => {
  const lit = S.litCopy(DOME, [-26, -18], 0.88)
  // Antennen klemmes, så kuglen (med kontur) holder sig under loftet; er der ikke plads til den korteste (stor på de
  // høje arter med store ører), har hjelmen ingen antenne.
  const [bx, by] = antennaAt(horn)
  const room = by - ceiling({ a, local, stage, solo }) - ANTENNA.r - sw
  const antenna = room >= ANTENNA.min
  const len = Math.min(ANTENNA.len, room)
  const tip: Vec = [bx - (horn ? 2.4 : 0), by - len]
  const lights = S.join(...LIGHTS.map((x) => S.circle(x, BAND.y0 + (BAND.y1 - BAND.y0) / 2 + BAND.sag * (1 - (x / BAND.x) ** 2), 2.2)))
  // Glimtet på visiret (skråt, oppe til venstre) og skallens højlys ude til venstre under visiret.
  const glare = S.join(S.ellipse(-18.6, -14.6, 1.9, 5.6, 66), S.ellipse(-6.4, -17.8, 1, 2.6, 78))
  return draw(
    antenna && [S.capsule([bx, by + 3], tip, 1.6), c.trim, c.trimOutline, sw * 0.7],
    [S.blob(DOME, 0.9), c.mainShade],
    [S.blob(lit, 0.9), c.main],
    [S.blob(DOME, 0.9), 'none', c.outline, sw],
    [S.blob(VISOR, 0.6), c.accent, c.accentOutline, sw],
    [S.lune(0, -15.6, 33.4, 9.4, 3, 32, 148), c.accentShade],
    [glare, c.highlight],
    [HINGES, c.trim, c.trimOutline, sw * 0.85],
    [HINGE_DOTS, c.trimShade],
    holeSeg({ c, a, local, holes, horn }),
    antenna && [S.circle(tip[0], tip[1], ANTENNA.r), c.accent, c.accentOutline, sw * 0.8],
    [S.softBand(-BAND.x, BAND.x, BAND.y0, BAND.y1, BAND.sag, BAND.sag + 0.2), c.trim, c.trimOutline, sw],
    [lights, c.accent, c.accentOutline, sw * 0.45],
    [S.join(S.ellipse(-22, -26.4, 6, 2.2, -22), antenna && S.circle(tip[0] - 1.3, tip[1] - 1.3, 1.1)), c.highlight],
  )
}

export const astronautHead = def('astronaut-head', {
  colorways: cws('hvid|hvid|snow|sky|gold', 'orange|orange|orange|navy|sky', 'lilla|lilla|lilac|teal|sunflower'),
  art: { front, rim },
  fit: { ...fitAt('headTop', 'headWidth', 93), overrides: { dragon: { scale: 0.52, dy: 3 } } },
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-51, -48, 102, 72] },
})

export default astronautHead
