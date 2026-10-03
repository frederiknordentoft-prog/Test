// Ridder · krop: en rustning – et blankt brystharnisk med en kam ned midt foran, en halskrave (ringkrave) i
// guld, to skørteplader forneden med nitter og et rundt skjoldmærke med en stjerne på brystet. Kropstøj
// klippes af riggen til artens krop (konturen/2 udenfor); harnisket klipper sig selv til sin længde og
// streger kroppens kontur igen inden for den, så pelsen ses under kanten. Lange ærmer (armskinner) starter
// ved skulderen og ender i en guldmanchet over poten med en albueplade på vejen (review G1-r4, T5); på
// løftede arme følger ærmet armen fra skulderen. Babyens korte torso får kanten og pladerne højere oppe. Én
// parametrisk tegning giver de 3 grundformer (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import type { BodyKind, ItemArt, SleeveArt } from '../../rig/types'
import { cws, def, fitAt, garment, S, SAG, sleeveUp, sleeveWith } from './kit/mestring'
import type { Seg } from './kit/mestring'

/** Skørtepladernes højde. */
const LAME = 6.4

/** Brystets glans, kammen, skørtepladerne med nitter og guldkanten forneden (i klippet). */
const inner = (collar: number, hem: number, { c, sw }: { c: Parameters<ItemArt>[0]['c']; sw: number }): Seg[] => {
  const l1 = hem - LAME
  const l2 = hem - 2 * LAME
  const at = (y: number) => S.spline([[-80, y + SAG * 0.2], [0, y + SAG * 2], [80, y + SAG * 0.2]])
  const rivets = [-30, -15, 15, 30].flatMap((x) => [l1, hem].map((y) => S.circle(x, y - LAME / 2 + SAG * 1.1 * (1 - (x / 80) ** 2), 1.7)))
  return [
    [S.join(S.ellipse(-24, collar + 21, 4.4, 13, 24), S.ellipse(-33, collar + 13, 1.6, 4.4, 24)), c.highlight],
    [S.join(S.spline([[0.6, collar - 2], [0, collar + 16], [0, l2 - 1]]), at(l2), at(l1)), 'none', c.outline, sw * 0.8],
    [S.join(S.band(-80, 80, hem - 3.2, hem, SAG), ...rivets), c.trim, c.trimOutline, sw * 0.6],
  ]
}

/** Skjoldmærket på brystet (en rund emaljeplade med en guldstjerne) og ringkraven om halsen. */
const outer = (collar: number, hem: number, { c, sw }: { c: Parameters<ItemArt>[0]['c']; sw: number }): Seg[] => {
  const y = (collar + hem) / 2 - 7
  return [
    [S.circle(-17, y, 8.2), c.accent, c.trimOutline, sw * 0.9],
    [S.join(S.star(-17, y + 0.4, 5.6, 2.4, 5), S.softBand(-18.5, 18.5, collar - 6.6, collar + 0.4, 3.4, 4.2)), c.trim, c.trimOutline, sw * 0.8],
  ]
}

const armor = (kind: BodyKind) => garment(kind, 'rr', 0, inner, outer)

/** Albuepladen på armskinnen: en bue på tværs midt mellem skulderen og manchetten. */
const elbow = ({ c, sw, cuff }: Parameters<SleeveArt>[0]): Seg => [S.spline([[-cuff.half + 2.2, cuff.y * 0.5 - 1.2], [0, cuff.y * 0.5 + 1.8], [cuff.half - 2.2, cuff.y * 0.5 - 1.2]]), 'none', c.outline, sw * 0.75]

export const ridderBody = def('ridder-body', {
  colorways: cws('staal|stål|silver|gold|tomato', 'guld|guld|gold|silver|sky', 'nat|natsort|charcoal|silver|teal'),
  art: {
    front: armor('round'),
    bodyShapes: { round: armor('round'), pear: armor('pear'), tall: armor('tall') },
    sleeve: sleeveWith(3, elbow),
    sleeveUp,
  },
  fit: fitAt('bodyCenter', 'bodyWidth', 100),
  icon: { box: [-61, -45, 122, 75] },
})

export default ridderBody
