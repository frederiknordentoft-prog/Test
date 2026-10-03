// Talmagiker · hånd: en tryllestav. En slank, mørk stav med lyse ender ligger i højre pote (poten tegnes over
// grebet), og øverst sidder en stor, buttet femtakket stjerne med cel-skygge og et højlys; et lille glimt funkler
// ved stjernen. Riggen giver genstanden posen (`hold`): staven drejes væk fra ansigtet og hovedets omrids, til
// den går fri, og holdes i den sikre zone (fælles `aimAway`, som luppen). Alt tegnes i en ramme, der er drejet
// tilbage til verdensrummet, så stjernen står opret, og lys og skygge står ens i alle poser. Alene (butik) står
// staven skråt som et ikon. Staven rækker med vilje ud over silhuetten (`reach`) og er stor nok til at ses i
// butikskortet på dyret (review G1-r4, B2).
import { aimAway, aimSolo } from '../../rig/hold'
import type { ItemArt } from '../../rig/types'
import { aimFrame, cws, def, fitAt, group, S } from '../ridder/kit/mestring'

/** Staven langs aksen fra grebet (hovedets modelenheder): ende, top, tykkelse, de lyse ender og stjernen. */
const W = { butt: -3, top: 30, r: 2.3, tip: 4.4, star: 38, starR: 11.2 }
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen. */
const AIM = -62
const STEP = 18
/** Staven er stor, så den kan ses i butikskortet på dyret. */
const SIZE = 1.4

const front: ItemArt = ({ c, sw, a, hold }) => {
  const samples = [{ at: W.butt, r: W.r * 1.4 }, { at: 16, r: 3.6 }, { at: W.star, r: W.starR + 5 }].map((p) => ({ at: p.at * SIZE, r: p.r * SIZE }))
  const P = hold ? aimAway(hold, samples, AIM, STEP) : aimSolo(a.handRot, -60)
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre, stjernen opret).
  const { along, m, rot } = aimFrame(P, SIZE)
  const [sx, sy] = along(W.star)
  const R = W.starR * m
  const tips = S.join(S.capsule(along(W.butt), along(W.butt + W.tip), W.r * m), S.capsule(along(W.top - W.tip), along(W.top), W.r * m))
  const glints = S.star(sx - R * 0.98, sy - R * 0.86, 3.4 * m, 0.85 * m)
  return group(
    `rotate(${rot.toFixed(2)})`,
    [S.capsule(along(W.butt), along(W.top), W.r * m), c.main, c.outline, sw],
    [tips, c.trim, c.trimOutline, sw * 0.8],
    [S.star(sx, sy, R, R * 0.56, 5), c.accent, c.accentOutline, sw],
    [S.lune(sx, sy + R * 0.06, R * 0.5, R * 0.5, R * 0.22, -10, 120), c.accentShade],
    [S.join(S.circle(sx - R * 0.26, sy - R * 0.2, R * 0.12), S.circle(sx - R * 0.02, sy - R * 0.46, R * 0.07)), c.highlight],
    [glints, c.trim, c.trimOutline, sw * 0.4],
  )
}

export const talmagikerHand = def('talmagiker-hand', {
  colorways: cws('nat|natblå|navy|snow|sunflower', 'lilla|lilla|violet|cream|rose', 'kul|kulsort|charcoal|gold|mint'),
  art: { front },
  fit: fitAt('pawR', 'fixed', 30),
  reach: true,
  icon: { box: [-14, -60, 60, 70] },
})

export default talmagikerHand
