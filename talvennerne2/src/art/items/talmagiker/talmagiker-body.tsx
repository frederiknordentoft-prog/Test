// Talmagiker · krop: en tryllekjortel – en lang kjortel i dyb farve, strøet med små stjerner og regnetegn
// (+ og =), med en rund krave i guld, et bælte med et stjernespænde og en bred bort forneden. Kropstøj klippes
// af riggen til artens krop (konturen/2 udenfor); kjortlen klipper sig selv til sin længde og streger kroppens
// kontur igen inden for den, så pelsen ses under kanten. Lange ærmer starter ved skulderen og ender i en bred
// guldmanchet over poten (review G1-r4, T5); på løftede arme følger ærmet armen fra skulderen. Babyens korte
// torso får kanten, bæltet og mønstret højere oppe. Én parametrisk tegning giver de 3 grundformer
// (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
 import type { BodyKind, ItemArt } from '../../rig/types'
import { cws, def, fitAt, garment, S, SAG, sleeveUp, sleeveWith } from '../ridder/kit/mestring'
import type { Seg } from '../ridder/kit/mestring'

/** Bæltets højde mellem halsen og kanten. */
const beltAt = (collar: number, hem: number) => collar + (hem - collar) * 0.56
const plus = (x: number, y: number, s: number) => S.join(S.line([x - s, y], [x + s, y]), S.line([x, y - s], [x, y + s]))

/** Mønstret (stjerner, plusser og et lighedstegn), borten forneden og bæltet (i klippet). */
const inner = (collar: number, hem: number, { c, sw }: { c: Parameters<ItemArt>[0]['c']; sw: number }): Seg[] => {
  const belt = beltAt(collar, hem)
  return [
    [S.join(S.star(-26, collar + 13, 4.6, 1.9, 5, -8), S.star(28, collar + 20, 3.8, 1.6, 5, 10), S.star(-34, belt + 10, 3.6, 1.5, 5, 6), S.star(18, belt + 11, 4.2, 1.8, 5, -12)), c.accent, c.accentOutline, sw * 0.35],
    [S.join(plus(10, collar + 9, 2.8), plus(-12, belt - 9, 2.6), plus(36, belt + 4, 2.4)), 'none', c.accent, sw * 0.7],
    [S.join(S.band(-80, 80, hem - 6.4, hem, SAG), S.softBand(-80, 80, belt - 3.4, belt + 3.4, SAG * 0.8, SAG * 0.8)), c.trim, c.trimOutline, sw * 0.8],
  ]
}

/** Stjernespændet midt på bæltet og den runde krave (samme guld, én sti). */
const outer = (collar: number, hem: number, { c, sw }: { c: Parameters<ItemArt>[0]['c']; sw: number }): Seg[] => [
  [S.join(S.star(0, beltAt(collar, hem) + SAG * 0.8, 7.2, 3.2, 5), S.band(-18, 18, collar - 7, collar - 1.4, 3.2, 5.6)), c.trim, c.trimOutline, sw * 0.8],
]

const robe = (kind: BodyKind) => garment(kind, 'tk', 2, inner, outer)

export const talmagikerBody = def('talmagiker-body', {
  colorways: cws('nat|natblå|navy|gold|sunflower', 'lilla|lilla|violet|sunflower|snow', 'hav|havblå|teal|gold|cream'),
  art: {
    front: robe('round'),
    bodyShapes: { round: robe('round'), pear: robe('pear'), tall: robe('tall') },
    sleeve: sleeveWith(4),
    sleeveUp,
  },
  fit: fitAt('bodyCenter', 'bodyWidth', 100),
  icon: { box: [-61, -45, 122, 77] },
})

export default talmagikerBody
