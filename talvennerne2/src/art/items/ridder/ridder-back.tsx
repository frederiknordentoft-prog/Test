// Ridder · ryg: en ridderkappe. Kappen hænger bag kroppen (lag 2) fra skuldrene ned mod jorden og breder sig ud,
// så den ses på begge sider af kroppen og mellem fødderne. Forneden er kanten skåret i fem runde tunger
// (takket som et ridderbanner) med en guldbort over, og folderne løber fra skuldrene ned mod tungerne. Foran
// halsen (lag 9b, under hovedet) samles kappen af en krave i stof og et spænde formet som et tatzenkors i guld,
// så kappen læses som en ridderkappe også på butikskortet (review G1-r4, B3). Højden regnes ud fra halsleddet og
// jordlinjen, så kappen passer alle tre kropsformer og stadier, og på stor klemmes den vandret, så hjørnerne
// bliver i den sikre zone. På butikskortet på dyret (`showcase`) bølger højre side ud til siden helt oppe fra
// skulderen, så kappen ses ved siden af kroppen og ikke kun i kortets hjørner. Alene (butik) hænger kappen
// spredt ud med kraven og spændet foroven. (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import type { ItemArtProps } from '../../rig/types'
import { cape, cws, def, fitAt, pattee, S } from './kit/mestring'
import type { Seg } from './kit/mestring'

/** Kraven over skuldrene og korsspændet. */
const clasp = (c: ItemArtProps['c'], sw: number, y: number): Seg[] => [
  [S.softBand(-25, 25, y - 3.6, y + 3.6, 3.4, 3.6), c.main, c.outline, sw],
  [pattee(0, y + 4, 8.2), c.trim, c.trimOutline, sw * 0.8],
  [S.join(S.ellipse(0, y + 4, 2.6, 2.6), S.ellipse(-2.6, y + 1.2, 1.2, 0.8, -40)), c.accent, c.accentOutline, sw * 0.35],
]

export const ridderBack = def('ridder-back', {
  colorways: cws('roed|rød|tomato|gold|snow', 'blaa|kongeblå|navy|gold|tomato', 'groen|skovgrøn|leaf|silver|sunflower'),
  art: cape({ gap: 6, liftK: 0.1, dags: 5, notch: 8, clasp, claspY: 3 }),
  fit: fitAt('bodyCenter', 'bodyWidth', 164),
  reach: true,
  icon: { box: [-47, -48, 94, 90] },
})

export default ridderBack
