// Astronaut · hals: en stjernemedaljon. Et bredt bånd kommer frem under hagen på begge sider af halsen og samles i en
// ring midt på brystet, hvor medaljonen hænger: en stor, buttet femtakket stjerne i metal med cel-skygge, og midt i
// stjernen en lille rund planet med en ring om, som en tegning af Saturn. Et glimt funkler ved stjernens øverste tak.
// Hele smykket flyttes ned under hagen på arter med lang mule (hest, enhjørning, pegasus), og babyens store hoved tages
// med. (0,0) = halsleddet, tegnet ved neckWidth 58.
import type { Vec } from '../../rig/shapes'
import type { ItemArt } from '../../rig/types'
import { cws, def, fitAt, group, neckDrop, S } from '../ridder/kit/mestring'

/** Stjernens centrum og radius (takker og hak). */
const C: Vec = [0, 31.4]
const R = 15.2
/** Båndet: fra halsens sider ned til ringen over stjernen (to flade bånd, der mødes). */
const RIBBON = S.join(
  S.blob([[-23.4, -3.6], [-17, 6.6], [-7.6, 13.4], [-1.4, 15.4], [-2.6, 9.6], [-10.6, 4.6], [-16.4, -3.2]], 0.55),
  S.blob([[23.4, -3.6], [17, 6.6], [7.6, 13.4], [1.4, 15.4], [2.6, 9.6], [10.6, 4.6], [16.4, -3.2]], 0.55),
)
/** Planeten midt i stjernen og dens ring (en flad ellipse, der går foran planeten forneden). */
const PLANET = S.circle(C[0], C[1] + 0.6, 4.6)
const PLANET_RING = S.ellipse(C[0], C[1] + 1.2, 8.6, 2.4, -14)

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const drop = neckDrop({ a, local, stage, solo }, 7)
  return group(
    drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined,
    [RIBBON, c.main, c.outline, sw * 0.8],
    [S.circle(0, C[1] - R - 0.4, 3.2), 'none', c.trimOutline, sw * 1.1],
    // Stjernen med skygge, planeten med ring og glimtet.
    [S.star(C[0], C[1], R, R * 0.6, 5), c.trim, c.trimOutline, sw * 0.85],
    [S.lune(C[0], C[1] + 1, R * 0.62, R * 0.62, 3.2, -5, 120), c.trimShade],
    [PLANET, c.accent, c.accentOutline, sw * 0.6],
    [PLANET_RING, 'none', c.accentOutline, sw * 0.95],
    [S.join(S.ellipse(C[0] - 4.2, C[1] - 6.4, 1.3, 2.6, 30), S.circle(C[0] - 1.8, C[1] - 1.6, 1)), c.highlight],
    [S.star(C[0] + 10.6, C[1] - R + 1.4, 4.2, 1, 4), c.trim, c.trimOutline, sw * 0.4],
  )
}

export const astronautNeck = def('astronaut-neck', {
  colorways: cws('blaa|blå|navy|gold|sky', 'roed|rød|tomato|silver|mint', 'lilla|lilla|violet|sunflower|rose'),
  art: { front },
  fit: fitAt('neck', 'neckWidth', 48),
  icon: { box: [-25, -6, 50, 54] },
})

export default astronautNeck
