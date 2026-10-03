// Talmagiker · hals: en talamulet. En tynd snor kommer frem under hagen på begge sider af halsen
// og samles i en øsken midt på brystet, hvor amuletten hænger: en rund guldramme med otte små takker (som en
// sol) om en dyb emaljesten, og på stenen står et stort syvtal i guld – talmagikerens lykketal. Cel-skygge på
// stenen og rammen og et lille glimt. Hele smykket flyttes ned under hagen på arter med lang mule (hest,
// enhjørning), og babyens store hoved tages med. (0,0) = halsleddet, tegnet ved neckWidth 58.
import type { Vec } from '../../rig/shapes'
 import type { ItemArt } from '../../rig/types'
import { cws, def, fitAt, group, neckDrop, S } from '../ridder/kit/mestring'

/** Amulettens centrum, rammens og stenens radius. */
const C: Vec = [0, 30]
const FRAME = 13.2
const GEM = 9.4
/** Snoren: fra halsens sider ned til øskenen over amuletten. */
const CORD: Vec[][] = [
  [[-22, -3], [-15, 8], [-6, 15.6], [-1.2, 16.4]],
  [[22, -3], [15, 8], [6, 15.6], [1.2, 16.4]],
]
/** Syvtallet på stenen (streger). */
const SEVEN: Vec[] = [[-4.4, 24.4], [4.6, 24.4], [-0.8, 36.4]]

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const drop = neckDrop({ a, local, stage, solo }, 7)
  const cord = S.join(...CORD.map((p) => S.spline(p)))
  const bail = C[1] - FRAME - 1.2
  return group(
    drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined,
    [cord, 'none', c.trimOutline, sw * 1.25],
    [cord, 'none', c.trim, sw * 0.5],
    [S.circle(0, bail, 3), c.trim, c.trimOutline, sw * 0.6],
    // Rammen med takker, stenen med skygge, syvtallet og glimtet.
    [S.star(C[0], C[1], FRAME + 2.8, FRAME + 0.2, 8), c.trim, c.trimOutline, sw * 0.8],
    [S.circle(C[0], C[1], GEM), c.main, c.trimOutline, sw * 0.7],
    [S.lune(C[0], C[1], GEM - 0.6, GEM - 0.6, 2.8, -15, 110), c.mainShade],
    [S.spline(SEVEN, 0.15), 'none', c.trimOutline, sw * 1.45],
    [S.spline(SEVEN, 0.15), 'none', c.accent, sw * 0.75],
    [S.join(S.ellipse(C[0] - 5.2, C[1] - 4.6, 2.4, 1.3, -40), S.star(C[0] + FRAME + 3.6, C[1] - FRAME + 1.4, 4, 1)), c.highlight],
  )
}

export const talmagikerNeck = def('talmagiker-neck', {
  colorways: cws('safir|safir|navy|gold|sunflower', 'rubin|rubin|berry|gold|cream', 'smaragd|smaragd|teal|silver|snow'),
  art: { front },
  fit: fitAt('neck', 'neckWidth', 48),
  icon: { box: [-25, -6, 50, 54] },
})

export default talmagikerNeck
