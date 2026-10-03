// Talmagiker · hoved: en troldmandshat. En bred, flad skygge bag en blød kuppel, der sidder tæt om hovedet og
// løber op i en høj kegle, hvis spids knækker og hænger ud mod højre. Et bånd om hatten, en stor guldstjerne
// og små tal og regnetegn (1, 3 og +) strøet på keglen som stjerner. earMode 'through' som ridehjelmen: ørerne
// går op gennem to huller i kuplen, og hullets forkant (`rim`) lægges oven på ørernes rod. Enhjørningen får et
// hornhul over hornets rod, og stjernen og tallene flytter til siderne, så hornet står frit foran keglen.
// Skyggen er en flad ellipse bag kuplen som tropehjelmens; den holder sig over øjnene på alle arter og stadier.
// Keglen er så høj, som der er plads til over hovedet: på stor hos de høje arter er den lavere og knækker
// tidligere, så spidsen bliver i den sikre zone. (0,0) = headTop, tegnet ved headWidth 104.
import type { Vec } from '../../rig/shapes'
 import type { ItemArt } from '../../rig/types'
import { ceiling, cws, def, draw, fitAt, holeSeg, HORN_HOLE, rim, S } from '../ridder/kit/mestring'

/** Skyggen: en flad ellipse bag kuplen; forkanten ses under kuplen (som tropehjelmens). */
const BRIM = { cx: 0, cy: 18.2, rx: 55.5, ry: 8.2 }
/** Båndet om hatten. */
const BAND = { x: 43.4, y0: 9.6, y1: 17.4, sag: 2.4 }
/** Keglens fulde højde over headTop (spidsens knæk) og den laveste, den må klemmes til. */
const CONE_H = 54
const CONE_MIN = 30

/**
 * Hatten (kuppel og kegle) som én lukket form med uret fra den hængende spids: venstre side ned til skyggen,
 * kuplens bund og højre side op til knækket. `h` er keglens højde over headTop.
 */
function hatPts(h: number): Vec[] {
  const s = h / CONE_H
  const k = Math.min(1, s * 1.2)
  return [
    [22 + 6 * s, -38 * s], [12, -54 * s], [4, -50 * s], [-6, -38 * s], [-16, -24 * s], [-27, -9.5 * k], [-39, 2.4], [-44.4, 13.2],
    [-45.4, 20.6], [0, 23.2], [45.4, 20.6], [44.4, 13.2], [39, 2.4], [27, -9 * k], [17.6, -24 * s], [12, -36 * s], [14.4, -42 * s],
  ]
}

/** Små tal og regnetegn: streger i en boks på 10 · 10 (tegnet med højden `h` om (x, y)). */
const GLYPHS = {
  '1': [[[2, 3], [5, 0], [5, 10]]],
  '3': [[[1, 1], [6, 0], [8, 2], [4, 5], [9, 7], [6, 10], [1, 9]]],
  '+': [[[5, 1], [5, 9]], [[1, 5], [9, 5]]],
} as const
function glyph(ch: keyof typeof GLYPHS, x: number, y: number, h: number): string {
  return S.join(...GLYPHS[ch].map((g) => S.spline(g.map(([u, v]) => [x + (u - 5) * h * 0.062, y + (v - 5) * h * 0.1] as Vec), 0.6)))
}

const front: ItemArt = ({ c, sw, a, local, holes, horn, stage, solo }) => {
  // Keglen klemmes, så spidsen (med kontur) bliver under loftet.
  const h = Math.max(CONE_MIN, Math.min(CONE_H, -ceiling({ a, local, stage, solo }) - sw))
  const s = h / CONE_H
  const hat = hatPts(h)
  const lit = S.xf(hat, { sx: 0.9, about: [-30, -12] })
  // Stjernen og tallene: midt på keglen, eller ud til siderne, når hornet står op foran den.
  const starAt: Vec = horn ? [horn.x - 20, -14 * s] : [-1.6, -21 * s]
  const marks = horn
    ? S.join(glyph('3', horn.x + 18, -10 * s, 8), glyph('+', horn.x - 14, -30 * s, 6.4))
    : S.join(glyph('1', -14, -6, 7.6), glyph('+', 13, -10, 7), glyph('+', 4.6, -36 * s, 6), glyph('3', 17, 3, 7.6))
  // Kuplens højlys ligger mindst 6 enheder fra alle huller (med horn: ude til højre for hornhullet).
  const shine = horn ? { x: horn.x + 22, y: -4 } : { x: -24, y: -2 }
  return draw(
    [S.ellipse(BRIM.cx, BRIM.cy, BRIM.rx, BRIM.ry), c.main, c.outline, sw],
    [S.lune(BRIM.cx, BRIM.cy, BRIM.rx - sw / 2, BRIM.ry - sw / 2, 2.4, 22, 158), c.mainShade],
    [S.blob(hat, 0.62), c.mainShade],
    [S.blob(lit, 0.62), c.main],
    [S.blob(hat, 0.62), 'none', c.outline, sw],
    holeSeg({ c, a, local, holes, horn }),
    [S.softBand(-BAND.x, BAND.x, BAND.y0, BAND.y1, BAND.sag, BAND.sag + 0.3), c.trim, c.trimOutline, sw],
    [marks, 'none', c.accent, sw * 0.85],
    [S.star(starAt[0], starAt[1], 8.4, 3.6, 5), c.accent, c.accentOutline, sw * 0.75],
    // Matte højlys: et langt på kuplen og keglen og et på stjernen.
    [S.join(S.ellipse(shine.x, shine.y, 5, 2.2, -40), S.ellipse(-9.6, -30 * s, 1.6, 5.6, 32), S.circle(starAt[0] - 2, starAt[1] - 2.4, 1.2)), c.highlight],
  )
}

export const talmagikerHead = def('talmagiker-head', {
  colorways: cws('nat|natblå|navy|violet|sunflower', 'lilla|lilla|violet|sunflower|snow', 'hav|havblå|teal|navy|gold'),
  art: { front, rim },
  fit: fitAt('headTop', 'headWidth', 112),
  hornHole: HORN_HOLE,
  icon: { box: [-57.5, -56, 115, 83] },
})

export default talmagikerHead
