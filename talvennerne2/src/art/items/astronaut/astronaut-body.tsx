// Astronaut · krop: en rumdragt – en blød heldragt med en tyk koblingsring om halsen (hvor hjelmen skrues på), en
// lynlås ned midt foran, et betjeningspanel på brystet med tre runde knapper, et rundt missionsmærke med en stjerne og
// et bredt bælte forneden. Kropstøj klippes af riggen til artens krop (konturen/2 udenfor); dragten klipper sig selv
// til sin længde og streger kroppens kontur igen inden for den, så pelsen ses under kanten. Lange ærmer starter ved
// skulderen og ender i en bred handskemanchet over poten (review G1-r4, T5); på løftede arme følger ærmet armen fra
// skulderen. Babyens korte torso får kanten, bæltet og panelet højere oppe. Én parametrisk tegning giver de 3
// grundformer (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import type { BodyKind, ItemArt } from '../../rig/types'
import { cws, def, fitAt, garment, S, SAG, sleeveUp, sleeveWith } from '../ridder/kit/mestring'
import type { Seg } from '../ridder/kit/mestring'

type P = { c: Parameters<ItemArt>[0]['c']; sw: number }

/** Lynlåsen ned midt foran og bæltet forneden (i klippet). */
const inner = (collar: number, hem: number, { c, sw }: P): Seg[] => [
  [S.spline([[0, collar - 2], [0.4, (collar + hem) / 2], [0, hem]]), 'none', c.outline, sw * 0.75],
  [S.band(-80, 80, hem - 7.2, hem, SAG), c.trim, c.trimOutline, sw * 0.8],
]

/** Koblingsringen om halsen, betjeningspanelet med knapper og missionsmærket med stjernen (ovenpå). */
const outer = (collar: number, hem: number, { c, sw }: P): Seg[] => {
  const y = collar + (hem - collar) * 0.36
  return [
    [S.softBand(-20.5, 20.5, collar - 7.4, collar + 0.6, 3.4, 5.4), c.trim, c.trimOutline, sw * 0.9],
    [S.rect(8.6, y - 6.6, 20.4, 13.2, 3.4), c.trim, c.trimOutline, sw * 0.75],
    [S.join(S.circle(13.4, y, 2.1), S.circle(18.8, y, 2.1), S.circle(24.2, y, 2.1)), c.accent, c.accentOutline, sw * 0.4],
    [S.circle(-19.6, y + 1, 7.6), c.accent, c.accentOutline, sw * 0.8],
    [S.star(-19.6, y + 1.2, 5.2, 2.2, 5), c.main, c.outline, sw * 0.45],
  ]
}

const suit = (kind: BodyKind) => garment(kind, 'ar', 1, inner, outer)

export const astronautBody = def('astronaut-body', {
  colorways: cws('hvid|hvid|snow|sky|tomato', 'orange|orange|orange|navy|sky', 'lilla|lilla|lilac|teal|sunflower'),
  art: {
    front: suit('round'),
    bodyShapes: { round: suit('round'), pear: suit('pear'), tall: suit('tall') },
    sleeve: sleeveWith(5),
    sleeveUp,
  },
  fit: fitAt('bodyCenter', 'bodyWidth', 100),
  icon: { box: [-61, -45, 122, 76] },
})

export default astronautBody
