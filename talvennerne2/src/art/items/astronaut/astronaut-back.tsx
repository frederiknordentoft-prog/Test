// Astronaut · ryg: en jetpack. To runde trykflasker med røde næsehætter og et bånd om livet ligger bag kroppen (lag 2)
// og er bredere end kroppen, så hætterne, siderne og dyserne ses ved skuldrene og hofterne, og under hver dyse
// blusser en lille, rund legetøjsflamme (to dråber i hinanden). Stropperne tegnes i stroplaget (6b: over kroppen og
// kropstøjet, under poterne og halsgenstanden), så de går ned over brystet og ind under armene; de klippes til
// kroppen og har et lille rundt spænde. Alene (butik) ses jetpacken forfra med begge flasker, ryggens plade og
// stropperne i siderne. På butikskortet på dyret (`showcase`) er jetpacken skubbet ud til venstre og vippet, så den
// venstre flaske med flammen ses helt ved siden af kroppen (som rygsækken, review G1-r4, B1). Pegasus, drage og ugle
// har ryggen fuld af vinger (`occupies`), så de bærer den ikke. (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { ribbon } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { BodyKind, ItemArt, ItemArtProps } from '../../rig/types'
import { cws, def, draw, fitAt, S } from '../ridder/kit/mestring'
import type { Seg } from '../ridder/kit/mestring'

/** Flaskerne: centrum (x, halvbredde), top og bund (y) – bag kroppen og i butikken. */
const TANK = { x: 52, r: 12.6, top: -50, bot: 2 }
const SOLO = { x: 15.6, r: 13.4, top: -40, bot: 14 }

/** Én flaske om (x, top, bund, r): kroppen, næsehætten, båndet, dysen og flammen. */
function tank(x: number, top: number, bot: number, r: number) {
  const mid = top + (bot - top) * 0.56
  const flame: Vec[] = [[x, bot + 26], [x - 6.4, bot + 13], [x - 5, bot + 7.6], [x, bot + 9.6], [x + 5, bot + 7.6], [x + 6.4, bot + 13]]
  return {
    body: S.capsule([x, top + r], [x, bot - r * 0.4], r),
    shade: S.rect(x + r * 0.32, top + r * 0.9, r * 0.5, bot - top - r * 1.6, r * 0.25),
    cap: S.blob([[x - r, top + r * 1.15], [x - r * 0.86, top + r * 0.3], [x, top - 0.6], [x + r * 0.86, top + r * 0.3], [x + r, top + r * 1.15], [x, top + r * 1.3]], 0.8),
    band: S.rect(x - r - 0.6, mid - 3, 2 * r + 1.2, 6, 2.4),
    nozzle: S.poly([[x - r * 0.62, bot - 2], [x + r * 0.62, bot - 2], [x + r * 0.42, bot + 6.4], [x - r * 0.42, bot + 6.4]]),
    flame: S.blob(flame, 0.75),
    core: S.blob(S.xf(flame, { sx: 0.5, sy: 0.55, about: [x, bot + 8] }), 0.75),
  }
}

/** Flaskerne, dyserne og flammerne (begge sider) som stier. */
function pack(t: typeof TANK, plate: boolean, c: ItemArtProps['c'], sw: number): Seg[] {
  const L = tank(-t.x, t.top, t.bot, t.r)
  const R = tank(t.x, t.top, t.bot, t.r)
  return [
    plate && [S.rect(-t.x, t.top + 8, 2 * t.x, t.bot - t.top - 10, 6), c.mainShade, c.outline, sw],
    [S.join(L.flame, R.flame), c.accent, c.accentOutline, sw * 0.8],
    [S.join(L.core, R.core), c.highlight],
    [S.join(L.nozzle, R.nozzle), c.trimShade, c.trimOutline, sw * 0.85],
    [S.join(L.body, R.body), c.main, c.outline, sw],
    [S.join(L.shade, R.shade), c.mainShade],
    [S.join(L.cap, R.cap, L.band, R.band), c.trim, c.trimOutline, sw * 0.85],
    [S.join(S.ellipse(-t.x - t.r * 0.45, t.top + t.r * 2.2, 1.6, 5.4), S.ellipse(t.x - t.r * 0.45, t.top + t.r * 2.2, 1.6, 5.4)), c.highlight],
  ]
}

/** Butikskortet på dyret: jetpacken ud til venstre og vippet, så venstre flaske og flamme ses ved siden af kroppen. */
const SHOWCASE = 'translate(-26 -6) rotate(-10 0 6)'
/** Stropperne alene (butik): de buer ud i siderne bag flaskerne. */
const SOLO_STRAPS = S.join(S.spline([[-24, -38], [-40, -22], [-42, 4], [-34, 22]]), S.spline([[24, -38], [40, -22], [42, 4], [34, 22]]))

const front: ItemArt = ({ c, sw, solo, showcase }) => {
  if (solo)
    return draw(
      [SOLO_STRAPS, 'none', c.trimOutline, sw * 2.6],
      [SOLO_STRAPS, 'none', c.trim, sw * 1.3],
      ...pack(SOLO, true, c, sw),
    )
  const segs = pack(TANK, false, c, sw)
  return showcase ? <g transform={SHOWCASE}>{draw(...segs)}</g> : draw(...segs)
}

/** Stropperne (rygrad pr. kropsform): fra skulderen under hagen, ned over brystet og ud under armen. */
const STRAP: Record<BodyKind, Vec[]> = {
  round: [[-15, -56], [-19, -38], [-27, -20], [-38, -4], [-52, 8]],
  pear: [[-15, -52], [-20, -35], [-29, -18], [-41, -3], [-56, 8]],
  tall: [[-13, -62], [-16, -44], [-22, -26], [-31, -10], [-46, 6]],
}
const STRAP_W = 7.6

/** Stropperne med hver sit runde spænde, klippet til kroppen (de går rundt om kroppens sider). */
const straps: ItemArt = ({ c, sw, ids, restroke, body: kind }) => {
  const clip = `${ids.uid}-aj-${kind}`
  const s = STRAP[kind]
  const strap = (side: 1 | -1) => S.blob(ribbon(s.map(([x, y]) => [side * x, y] as Vec), STRAP_W), 0.55)
  const [bx, by] = s[2]
  return (
    <>
      <clipPath id={clip}>{restroke()}</clipPath>
      <g clipPath={`url(#${clip})`}>
        {draw(
          [S.join(strap(-1), strap(1)), c.trim, c.trimOutline, sw],
          [S.join(S.circle(bx, by, 4.4), S.circle(-bx, by, 4.4)), c.accent, c.accentOutline, sw * 0.6],
        )}
      </g>
    </>
  )
}

export const astronautBack = def('astronaut-back', {
  colorways: cws('soelv|sølv|silver|tomato|sunflower', 'orange|orange|orange|navy|sunflower', 'lilla|lilla|violet|mint|rose'),
  art: { front, straps },
  fit: fitAt('bodyCenter', 'bodyWidth', 124),
  // Flaskerne og flammerne rækker med vilje ud over kroppens sider (lintet holder dem i den sikre zone).
  reach: true,
  icon: { box: [-44, -42, 88, 84] },
})

export default astronautBack
