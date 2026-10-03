// Talmagiker · ryg: en stjernekappe. Kappen hænger bag kroppen (lag 2) fra skuldrene ned mod jorden og breder
// sig ud i en blød bue, så den ses på begge sider af kroppen og mellem fødderne. Stoffet er strøet med stjerner
// i to størrelser, og forneden løber en bred bort. Stjernerne ligger ude i siderne og forneden, hvor kappen ses
// ved siden af kroppen. Foran halsen (lag 9b, under hovedet) samles kappen af en snor mellem to små stjerner og
// et spænde formet som en halvmåne med en stjerne, så kappen læses som en troldmandskappe også på butikskortet
// (review G1-r4, B3). Højden regnes ud fra halsleddet og jordlinjen, så kappen passer alle tre kropsformer og
// stadier, og på stor klemmes den vandret, så hjørnerne bliver i den sikre zone. Alene (butik) hænger kappen
// spredt ud med spændet foroven. Selve kappen tegnes af mestringskittet (`cape`), som ridderkappen deler.
// (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import type { ItemArtProps } from '../../rig/types'
import { cape, cws, def, fitAt, S } from '../ridder/kit/mestring'
import type { Seg } from '../ridder/kit/mestring'

/** Stjernerne på stoffet (brøker af kappens halve bredde og højde): store og små, ude i siderne og forneden. */
const STARS: readonly (readonly [number, number, number])[] = [
  [-0.7, 0.44, 5.4], [0.66, 0.38, 5], [-0.62, 0.72, 4], [0.72, 0.66, 4.6], [-0.4, 0.9, 3.4], [0.34, 0.9, 3.4],
]

/** Snoren mellem to små stjerner over skuldrene og halvmånespændet midt for. */
// Halvmånen: en skive med en forskudt skive skåret ud (to buer), åbningen op mod højre.
const clasp = (c: ItemArtProps['c'], sw: number, y: number): Seg[] => [
  [S.spline([[-22, y - 1.6], [-11, y + 2.4], [0, y + 3], [11, y + 2.4], [22, y - 1.6]]), 'none', c.trimOutline, sw * 1.1],
  [S.join(S.star(-22, y - 1.6, 4.4, 1.9, 5), S.star(22, y - 1.6, 4.4, 1.9, 5)), c.trim, c.trimOutline, sw * 0.5],
  [S.blob([[-1.6, y - 6.8], [-6.4, y - 3.4], [-7.2, y + 2.6], [-3.4, y + 7], [2.8, y + 7.4], [7, y + 3.8], [3.2, y + 3.6], [-0.6, y + 2.2], [-2.6, y - 1.6]], 0.75), c.trim, c.trimOutline, sw * 0.8],
  [S.join(S.star(3.4, y - 3, 3.6, 1.5, 5), S.circle(-4.6, y + 0.6, 1)), c.accent, c.accentOutline, sw * 0.35],
]

export const talmagikerBack = def('talmagiker-back', {
  colorways: cws('nat|natblå|navy|gold|sunflower', 'lilla|lilla|violet|sunflower|snow', 'hav|havblå|teal|gold|cream'),
  art: cape({
    gap: 7,
    liftK: 0.14,
    dags: 0,
    notch: 0,
    clasp,
    claspY: 4,
    // Stjernerne (drejet lidt hver) inden for kappen og over borten.
    deco: ({ top, bot, lift, L, R }, { c, sw, solo }) => [
      S.join(...STARS.map(([u, v, r], i) => S.star(u * (u < 0 ? L : R), top + v * (bot - top - 9) - (u > 0 ? lift * v * 0.6 : 0), r * (solo ? 1.3 : 1), r * 0.42 * (solo ? 1.3 : 1), 5, i * 17))),
      c.accent,
      c.accentOutline,
      sw * 0.4,
    ],
  }),
  fit: fitAt('bodyCenter', 'bodyWidth', 166),
  reach: true,
  icon: { box: [-47, -48, 96, 90] },
})

export default talmagikerBack
