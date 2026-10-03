// Ridder · hals: en ordenskæde. En kæde af aflange guldled med små runde led imellem ligger i en blød bue
// under hagen, og midt for hænger ordenstegnet i en ring: et ottetakket guldstjerneskær bag et emaljekors med
// buede arme (et tatzenkors) og en rund midterplade. Leddene drejes efter buen, så kæden følger brystets
// rundning. Cel-skygge på leddene og korset og et lille glimt. Hele smykket flyttes ned under hagen på arter
// med lang mule (hest, enhjørning), og babyens store hoved tages med. (0,0) = halsleddet, tegnet ved
// neckWidth 58.
import type { Vec } from '../../rig/shapes'
import type { ItemArt } from '../../rig/types'
import { S, cws, def, fitAt, group, neckDrop, pattee } from './kit/mestring'

/** Kædens bue: halv bredde, top (ved halsens sider) og bund (midt for). */
const CHAIN = { w: 25, top: -1.5, bottom: 20 }
/** Antal led (skiftevis firkantede og runde; ulige, så et firkantet led sidder midt for under ringen). */
const LINKS = 11
/** Ordenstegnet: centrum under kædens bund, korsets og stjerneskærets radius. */
const BADGE = { y: 34.5, cross: 9.6, rays: 13.2 }

/** Leddenes centre og retning langs buen (jævnt fordelt i x, så de ligger tæt på tværs af brystet). */
function links(): { p: Vec; rot: number }[] {
  const y = (x: number) => CHAIN.bottom - (CHAIN.bottom - CHAIN.top) * (x / CHAIN.w) ** 2
  return Array.from({ length: LINKS }, (_, i) => {
    const t = -1 + (2 * i) / (LINKS - 1)
    const x = CHAIN.w * Math.sin((t * Math.PI) / 2)
    const slope = (-2 * (CHAIN.bottom - CHAIN.top) * x) / CHAIN.w ** 2
    return { p: [x, y(x)] as Vec, rot: (Math.atan(slope) * 180) / Math.PI }
  })
}

const ALL = links()
/** De aflange led (lige numre) drejet efter buen og de små runde led (ulige numre) imellem. */
const PLATES = S.join(...ALL.map(({ p, rot }, i) => (i % 2 ? S.circle(p[0], p[1], 2.2) : S.ellipse(p[0], p[1], 3.9, 3, rot))))

const front: ItemArt = ({ c, sw, a, local, stage, solo }) => {
  const drop = neckDrop({ a, local, stage, solo }, 6)
  const B = BADGE
  return group(
    drop > 0.05 ? `translate(0 ${drop.toFixed(1)})` : undefined,
    [PLATES, c.trim, c.trimOutline, sw * 0.7],
    [S.circle(0, CHAIN.bottom + 6.6, 2.6), 'none', c.trimOutline, sw * 1.2],
    // Ordenstegnet: stjerneskæret, korset med skygge og midterpladen.
    [S.star(0, B.y, B.rays, B.rays * 0.5, 8, 22.5), c.trim, c.trimOutline, sw * 0.7],
    [pattee(0, B.y, B.cross), c.main, c.outline, sw * 0.8],
    [S.lune(0, B.y, B.cross * 0.72, B.cross * 0.72, 2.6, -20, 110), c.mainShade],
    [S.circle(0, B.y, 3.8), c.accent, c.accentOutline, sw * 0.6],
    [S.join(S.ellipse(-3.4, B.y - 4.4, 1.6, 1, -40), S.circle(-1.2, B.y - 1.3, 1)), c.highlight],
  )
}

export const ridderNeck = def('ridder-neck', {
  colorways: cws('roed|rødt kors|tomato|gold|snow', 'blaa|blåt kors|sky|gold|tomato', 'groen|grønt kors|leaf|silver|sunflower'),
  art: { front },
  fit: fitAt('neck', 'neckWidth', 54),
  icon: { box: [-29, -6, 58, 54] },
})

export default ridderNeck
