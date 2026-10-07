// Astronaut · hånd: en legetøjsraket. En buttet, rund raket med en spids næsekegle, et rundt koøje med et glimt, tre
// runde finner forneden (to ude i siderne og én forfra) og en lille dyse; et stribe-bånd om livet og cel-skygge langs
// den ene side. Ingen flammer og intet skarpt: det er et stykke legetøj. Den holdes om livet over finnerne i højre pote
// (poten tegnes over grebet), og riggen giver genstanden posen (`hold`): raketten drejes væk fra ansigtet og hovedets
// omrids, til den går fri, og holdes i den sikre zone (fælles `aimAway`, som luppen og stjernestaven). Alt tegnes i en
// ramme, der er drejet tilbage til verdensrummet, så lys og skygge står ens i alle poser. Alene (butik) står raketten
// skråt som på vej op. På butikskortet på dyret (`showcase`) peger raketten skråt ud til siden, så kortet kan beskæres
// under øjnene. På de lange forben, der står på jorden, står raketten næsten lodret på sine finner foran benet og
// tegnes foran det (`art.over`, SPEC A17), så den ikke gemmer sig bag forbenet; poten holder den ved foden.
import { aimAway, aimSolo } from '../../rig/hold'
import type { Vec } from '../../rig/shapes'
import type { ItemArt } from '../../rig/types'
import { aimFrame, cws, def, draw, fitAt, groundPaw, S } from '../ridder/kit/mestring'

/** Raketten langs aksen fra grebet (hovedets modelenheder): profilens halve bredde fra dysen til spidsen. */
const BODY: readonly (readonly [number, number])[] = [[-8.4, 4.6], [-3, 6.4], [5, 7.4], [13, 7.3], [20, 6.2], [26, 4.2], [30.6, 2]]
const TIP = 34
/** Næsekeglens fod, koøjet og båndet om livet. */
const CONE = 21.4
const PORT = { at: 12.6, r: 3.9 }
const BAND = -1.6
/** Foretrukken retning (grader; −90 = op) og trin, når ansigtet er i vejen; på jorden står den næsten lodret. */
const AIM = -34
const GROUND_AIM = -84
const STEP = 18
/** Retningen på butikskortet på dyret: ud til siden, væk fra armen (som stjernestaven, review G2-r3 B16). */
const CARD_AIM = -26
/** Raketten er stor nok til at ses i butikskortet på dyret. */
const SIZE = 1.18

/**
 * På jorden (de lange forben) står raketten på poten: tegningen løftes langs aksen, så dysen sidder ved grebet og
 * finnerne lige over poten (ellers ville finnerne under grebet gå ned under jorden og vippe raketten ned på siden).
 */
const LIFT = 11.4

const front: ItemArt = ({ c, sw, a, hold, showcase }) => {
  const ground = groundPaw(a, hold)
  const lift = ground ? LIFT : 0
  const samples = (ground ? [{ at: 3.2, r: 13.4 }, { at: 17, r: 8 }, { at: 42, r: 5 }] : [{ at: -9, r: 12.5 }, { at: 9, r: 8 }, { at: 30, r: 5 }]).map((p) => ({ at: p.at * SIZE, r: p.r * SIZE }))
  const P = hold ? aimAway(hold, samples, ground ? GROUND_AIM : showcase ? CARD_AIM : AIM, STEP) : aimSolo(a.handRot, -66)
  // Tegnes i en ramme drejet tilbage til verdensrummet (lyset oppefra til venstre).
  const frame = aimFrame(P, SIZE)
  const { m, rot } = frame
  const along = (s: number) => frame.along(s + lift)
  const o = along(0)
  const e = along(10)
  const len = Math.hypot(e[0] - o[0], e[1] - o[1])
  const ax: Vec = [(e[0] - o[0]) / len, (e[1] - o[1]) / len]
  const nx: Vec = [-ax[1], ax[0]]
  const at = (s: number, w: number): Vec => {
    const p = along(s)
    return [p[0] + nx[0] * w * m, p[1] + nx[1] * w * m]
  }
  // Siden væk fra lyset (lyset oppe til venstre) får skyggen; den anden glansen.
  const side = nx[0] + nx[1] > 0 ? 1 : -1
  const hull = S.blob([...BODY.map(([s, w]) => at(s, w)), at(TIP, 0), ...BODY.map(([s, w]) => at(s, -w)).reverse(), at(-9.6, 0)], 0.6)
  const shade = S.blob([at(-7.6, side * 4.2), ...BODY.slice(1, -1).map(([s, w]) => at(s, side * w * 0.96)), at(TIP - 2.4, side * 0.6), ...BODY.slice(1, -1).map(([s, w]) => at(s, side * w * 0.38)).reverse()], 0.6)
  const cone = S.blob([at(CONE, 6.4), at(CONE + 1.6, 0), at(CONE, -6.4), at(26, -4.2), at(30.6, -2), at(TIP, 0), at(30.6, 2), at(26, 4.2)], 0.6)
  const band = S.blob([at(BAND - 2, 6.6), at(BAND - 1.4, 0), at(BAND - 2, -6.6), at(BAND + 2.4, -7), at(BAND + 3, 0), at(BAND + 2.4, 7)], 0.5)
  // Finnerne: to runde vinger ud til siderne og én smal forfra.
  const fin = (k: 1 | -1) => S.blob([at(4, k * 6.6), at(-1, k * 11.6), at(-8.4, k * 13.4), at(-11.2, k * 11.4), at(-8, k * 7), at(-6, k * 4.6)], 0.7)
  const fins = S.join(fin(1), fin(-1), S.blob([at(1.6, 0.6), at(-10.6, 1.9), at(-12, 0), at(-10.6, -1.9), at(1.6, -0.6)], 0.6))
  const nozzle = S.blob([at(-8.2, 3.6), at(-12.4, 4.6), at(-12.4, -4.6), at(-8.2, -3.6)], 0.3)
  const [px, py] = along(PORT.at)
  const pr = PORT.r * m
  const shine = S.join(S.ellipse(...at(9, -side * 4.2), 1.2 * m, 4.4 * m, (Math.atan2(ax[1], ax[0]) * 180) / Math.PI + 90), S.circle(px - pr * 0.36, py - pr * 0.36, pr * 0.3))
  return (
    <g transform={`rotate(${rot.toFixed(2)})`}>
      {draw(
        [nozzle, c.trimShade, c.trimOutline, sw * 0.8],
        [fins, c.trim, c.trimOutline, sw * 0.9],
        [hull, c.main, c.outline, sw],
        [shade, c.mainShade],
        [S.join(cone, band), c.trim, c.trimOutline, sw * 0.85],
        [S.circle(px, py, pr), c.accent, c.trimOutline, sw * 1.15],
        [shine, c.highlight],
      )}
    </g>
  )
}

export const astronautHand = def('astronaut-hand', {
  colorways: cws('hvid|hvid|snow|tomato|sky', 'roed|rød|tomato|snow|sunflower', 'mint|mint|mint|violet|sunflower'),
  // Foran poten kun på forben, der står på jorden (som skjoldet og stjernestaven); ellers ligger poten over grebet.
  art: { front, over: ({ a, hold }) => groundPaw(a, hold) },
  fit: fitAt('pawR', 'fixed', 30),
  reach: true,
  icon: { box: [-16, -50, 50, 60] },
})

export default astronautHand
