// Ridder · hånd: et skjold. Et klassisk trekantskjold (lige top, runde sider, spids forneden) med en bred
// metalkant, et stort kors på feltet og nitter i kanten. Det holdes i højre pote i den nederste indre kant
// (poten tegnes over grebet), og riggen giver genstanden posen (`hold`): skjoldet drejes væk fra ansigtet og
// hovedets omrids, til det går fri, og holdes i den sikre zone (fælles `aimAway`, som luppen). Skjoldet
// tegnes altid opret i en ramme, der er drejet tilbage til verdensrummet, så korset står lodret og lys og
// skygge står ens i alle poser. Alene (butik) står det opret og fylder kortet. Skjoldet rækker med vilje ud
// over silhuetten (`reach`) og er stort nok til at ses tydeligt i butikskortet på dyret (review G1-r4, B2).
// På de lange forben, der står på jorden (kat, hvalp, hest, enhjørning og ræv; review G2-r3 T15 og B15), bæres
// skjoldet i brysthøjde uden på forbenet, så benet kun dækker dets inderste kant, og hele skjoldet ses.
import { aimAway, aimSolo } from '../../rig/hold'
import type { Vec } from '../../rig/shapes'
import type { HandHold, ItemArt, Pt } from '../../rig/types'
import { aimFrame, cws, def, fitAt, groundPaw, group, S } from './kit/mestring'

/** Skjoldets form om centrum (venstre halvdel, top → spids): bredde 30, højde 35. */
const SHIELD = S.symmetric([[0, -15.6], [-8, -16], [-15, -16.6], [-15.4, -6], [-13.4, 4.6], [-8.4, 12.6], [0, 19]])
/** Feltet inden for kanten (skjoldet krympet om et punkt lidt over midten). */
const FIELD = S.xf(SHIELD, { sx: 0.8, about: [0, -1] })
/** Afstanden fra grebet til skjoldets centrum (hovedets modelenheder) og retningen (grader; −90 = op). */
const CENTER = 17
const AIM = -60
const STEP = 18
/** Skjoldet er stort, så det kan ses i butikskortet på dyret. */
const SIZE = 1.5
/**
 * Skjoldets centrum på et forben, der står på jorden (T15), fra grebet ved jorden i hovedets modelenheder: ud forbi
 * benet (det dækker højst ca. 1/4 af skjoldets bredde) og op i brysthøjde (skjoldets bund ca. 11 enheder over jorden).
 * Når babyens store hoved er i vejen, sænkes det i trin på `step`, men aldrig under `low`.
 */
const ON_LEG = { out: 23, up: 40, low: 22, step: 3 }

/** Skjoldets centrum (verdensrummet) uden på et forben, der står på jorden: så højt, at toppen går fri af ansigtet. */
function onLeg(hold: HandHold): Pt {
  const { grip: g, head: H } = hold
  const u = H.s
  // Ansigtet som i `aimAway`: hovedets ellipse ned til under munden (mulen), lidt udvidet.
  const top = H.y - H.ry
  const bottom = Math.max(H.y + H.ry, H.mouth.y + 9 * u)
  const fc = { x: H.x, y: (top + bottom) / 2 }
  const fr = { x: H.rx + 2 * u, y: (bottom - top) / 2 + 2 * u }
  const at = (up: number) => ({ x: g.x + ON_LEG.out * u, y: g.y - up * u })
  for (let up = ON_LEG.up; up > ON_LEG.low; up -= ON_LEG.step) {
    const c = at(up)
    // Skjoldets øverste kant og hjørner (formens top ligger 16,6 over centrum, hjørnerne 15,4 ud til siden).
    const free = [-15.4, 0, 15.4].every((x) => ((c.x + x * SIZE * u - fc.x) / fr.x) ** 2 + ((c.y - 16.6 * SIZE * u - fc.y) / fr.y) ** 2 >= 1)
    if (free) return c
  }
  return at(ON_LEG.low)
}

const front: ItemArt = ({ c, sw, a, hold }) => {
  // Grebet sidder i skjoldets nederste indre kant; prøvepunkterne dækker hele skjoldet.
  const samples = [{ at: 6, r: 10 }, { at: CENTER, r: 22 }].map((p) => ({ at: p.at * SIZE, r: p.r * SIZE }))
  const P = hold ? aimAway(hold, samples, AIM, STEP) : aimSolo(a.handRot, -60)
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, korset lodret).
  const { along, world, m, rot } = aimFrame(P, SIZE)
  const [cx, cy] = groundPaw(a, hold) ? world(onLeg(hold)) : along(CENTER)
  const place = (pts: readonly Vec[]) => S.xf(pts, { sx: m, dx: cx, dy: cy })
  const shield = place(SHIELD)
  const field = place(FIELD)
  // Korset: lodret og vandret bjælke inden for feltet.
  const cross = S.join(
    S.poly(place([[-4, -12.9], [4, -12.9], [4, 13.8], [-4, 13.8]])),
    S.poly(place([[-11, -6], [11, -6], [11, 2], [-11, 2]])),
  )
  const rivets = S.join(...place([[-13.6, -14.4], [13.6, -14.4], [-13.4, 2], [13.4, 2], [0, 17]]).map(([x, y]) => S.circle(x, y, 1.15 * m)))
  const lit = S.xf(field, { sx: 0.94, about: [cx - 12 * m, cy - 14 * m] })
  return group(
    `rotate(${rot.toFixed(2)})`,
    [S.blob(shield, 0.5), c.trim, c.trimOutline, sw],
    [S.blob(field, 0.5), c.mainShade],
    [S.blob(lit, 0.5), c.main],
    [S.blob(field, 0.5), 'none', c.outline, sw * 0.7],
    [cross, c.accent, c.accentOutline, sw * 0.6],
    [rivets, c.trimShade, c.trimOutline, sw * 0.4],
    [S.ellipse(cx - 8.4 * m, cy - 8.6 * m, 1.7 * m, 3.6 * m, 12), c.highlight],
  )
}

export const ridderHand = def('ridder-hand', {
  colorways: cws('roed|rød|tomato|silver|gold', 'blaa|blå|sky|gold|snow', 'groen|grøn|leaf|silver|sunflower'),
  art: { front },
  fit: fitAt('pawR', 'fixed', 30),
  reach: true,
  icon: { box: [-12, -48, 42, 46] },
})

export default ridderHand
