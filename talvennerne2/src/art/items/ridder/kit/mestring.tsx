// Fælles dele for de to mestringssæt (Ridder og Talmagiker): husets primitiver samlet (`S`), stierne som data
// (`draw`), farvesæt og pasform i kort form, genstandens faste felter fra kataloget (`def`), hattenes øre- og
// hornhuller med forkant og loftet over hovedet, øjenenhederne til maske og briller, hagens højde til smykker og
// kapper, kappen selv (`cape`), tatzenkorset, håndgenstandenes drejede ramme og kropstøjets snit og ærmer. Filen
// ligger i en undermappe, så registeret (`./*/*.tsx`) ikke tager den for en genstand; de tolv genstande er stadig
// hver sin dovne chunk, men deler denne ene (bundlebudgettet, SPEC §12.5: al JS ≤ 600 KB).
import type { ReactNode, SVGProps } from 'react'
import { SAFE, STAGE_XF, regionTransforms } from '../../../rig/anchors'
import type { Aim } from '../../../rig/hold'
import { band, blob, capsule, circle, ellipse, join, line, litCopy, lune, outside, poly, rect, softBand, spline, star, symmetric, xf } from '../../../rig/shapes'
import type { Vec } from '../../../rig/shapes'
import { fabric } from '../../../rig/palette'
import type { FabricName } from '../../../rig/palette'
import type { AnchorName, AnchorSet, BodyKind, Colorway, HandHold, HornHole, ItemArt, ItemArtProps, ItemDef, ItemFit, ItemId, Pt, ScaleBy, SleeveArt, SleeveUpArt, Stage } from '../../../rig/types'
import { ITEM_BY_ID } from '../../../../content/catalog'

/** Husets primitiver samlet, så genstandene kun importerer fra denne fil (én import pr. chunk, bundlebudgettet). */
export const S = { band, blob, capsule, circle, ellipse, join, line, litCopy, lune, poly, rect, softBand, spline, star, symmetric, xf }

/** Tatzenkorset (ordenstegnet, kappens spænde): fire arme, smalle ved midten og brede med lige ender (radius r). */
export function pattee(cx: number, cy: number, r: number): string {
  const arm: Vec[] = [[-r * 0.6, -r], [r * 0.6, -r], [r * 0.24, -r * 0.24]]
  return poly([0, 1, 2, 3].flatMap((i) => xf(arm, { rot: 90 * i, dx: cx, dy: cy })))
}

/**
 * Én sti i en genstand: d, fyld, kontur og stregbredde (altid runde samlinger) og evt. flere attributter. Genstandene
 * beskriver deres stier som lister, så tegningen (og JSX-runtime) kun findes her én gang (bundlebudgettet).
 */
export type Seg = readonly [string, string, string?, number?, SVGProps<SVGPathElement>?] | false | null | undefined | ''

/** Stierne i rækkefølge (falske poster springes over). */
export const draw = (...segs: readonly Seg[]): ReactNode =>
  segs.map((s, i) => s && <path key={i} d={s[0]} fill={s[1]} stroke={s[2]} strokeWidth={s[3]} strokeLinejoin="round" strokeLinecap="round" {...s[4]} />)

/** Stierne i en gruppe med en transform (smykket under hagen, håndgenstandens ramme). */
export const group = (transform: string | undefined, ...segs: readonly Seg[]) => <g transform={transform}>{draw(...segs)}</g>

/**
 * Tre farvesæt fra stofpaletten, hvert skrevet som 'id|navn|hoved|kant|accent' (navnet må have mellemrum).
 */
export const cws = (...specs: readonly string[]) =>
  specs.map((x) => {
    const [id, name, main, trim, accent] = x.split('|') as [string, string, FabricName, FabricName, FabricName]
    return fabric(id, name, main, trim, accent)
  }) as unknown as readonly [Colorway, Colorway, Colorway]

/** Pasformen: anker, skalamål og grundbredde (hatte med ørehuller får earMode 'through'). */
export const fitAt = (anchor: AnchorName, scaleBy: ScaleBy, baseWidth: number): ItemFit =>
  anchor === 'headTop' ? { anchor, scaleBy, baseScale: 1, baseWidth, earMode: 'through' } : { anchor, scaleBy, baseScale: 1, baseWidth }

/** Genstanden med de faste felter fra kataloget (sæt, slot, navneklip og mestringskilden) og sin egen tegning. */
export function def(id: ItemId, rest: Omit<ItemDef, 'id' | 'set' | 'slot' | 'nameClip' | 'source'>): ItemDef {
  const { set, slot, nameClip, source } = ITEM_BY_ID[id]
  return { id, set, slot, nameClip, source, ...rest }
}

// ---------------------------------------------------------------------------------------------
// Hatte med ørehuller (ridderhjelm, troldmandshat), som ridehjelmen og tropehjelmen

/** Ørehullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter kuplens rundning. */
const HOLE = { rx: 11.5, ry: 4.6, rot: 24 }
/** Hornhullet (enhjørningen): en flad ellipse lidt bredere end hornets rod. */
export const HORN_HOLE: HornHole = { lift: 9, rx: 9.2, ry: 3.6 }

const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}

/** Hullets forkant: en halvmåne under hullets nederste kant (hattens tykkelse), spidse ender. */
function lip(h: { x: number; y: number; rot: number }, rx = HOLE.rx, ry = HOLE.ry, th = 2.6): string {
  const outer: Vec[] = []
  const inner: Vec[] = []
  for (let i = 0; i <= 6; i++) {
    const t = (Math.PI * i) / 6
    outer.push([rx * Math.cos(t), (ry + th) * Math.sin(t)])
    inner.push([rx * Math.cos(t), ry * Math.sin(t)])
  }
  return blob(xf([...outer, ...inner.slice(1, -1).reverse()], { rot: h.rot, dx: h.x, dy: h.y }), 0.7)
}

/** Hullerne i kuplen (mørke ellipser), når ørerne går gennem hatten. */
export function holeSeg({ c, a, local, holes, horn }: Pick<ItemArtProps, 'c' | 'a' | 'local' | 'holes' | 'horn'>): Seg {
  if (!holes) return null
  const l = holeAt(local, a.earBaseL, -1)
  const r = holeAt(local, a.earBaseR, 1)
  return [join(ellipse(l.x, l.y, HOLE.rx, HOLE.ry, l.rot), ellipse(r.x, r.y, HOLE.rx, HOLE.ry, r.rot), horn ? ellipse(horn.x, horn.y, HORN_HOLE.rx, HORN_HOLE.ry) : ''), c.outline, , , { opacity: 0.85 }]
}

/** Hullernes forkant over ørernes (og hornets) rod (kun når ørerne går gennem huller). */
export const rim: ItemArt = ({ c, sw, a, local, horn }) => (
  <path
    d={join(lip(holeAt(local, a.earBaseL, -1)), lip(holeAt(local, a.earBaseR, 1)), horn ? lip({ x: horn.x, y: horn.y, rot: 0 }, HORN_HOLE.rx, HORN_HOLE.ry, 2.4) : '')}
    fill={c.main}
    stroke={c.outline}
    strokeWidth={sw * 0.8}
    strokeLinejoin="round"
  />
)

/**
 * Den højeste lokale y, en hat (ankeret headTop) må nå: den sikre zone med 5 enheders luft, så toppen også
 * holder sig inde, når hovedet hælder i humørerne (stor på de høje arter har mindst plads). Alene: ingen grænse.
 */
export function ceiling(p: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'solo'>): number {
  if (p.solo) return -Infinity
  const R = regionTransforms(p.a, p.stage)
  return p.local({ x: p.a.headTop.x, y: (SAFE.y0 + 5 - R.head.ty) / R.head.s }).y
}

// ---------------------------------------------------------------------------------------------
// Maske og briller

/**
 * Øjnene i genstandens lokale koordinater: centre, lokale enheder pr. modelenhed og øjets halvakser (stadiets
 * øjenskala med), samt støvbrillernes glasenheder (øjet, de lukkede øjnes vipper, luft og et halvt stel).
 */
export function eyeUnits({ a, local, stage, sw }: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'sw'>) {
  const es = STAGE_XF[stage].eye
  const L = local(a.eyeL)
  const R = local(a.eyeR)
  const k = Math.hypot(R.x - L.x, R.y - L.y) / Math.hypot(a.eyeR.x - a.eyeL.x, a.eyeR.y - a.eyeL.y)
  const erx = a.eyeRx * es * k
  const ery = a.eyeRy * es * k
  const half = sw * 1.1
  return { L, R, k, erx, ery, ux: Math.max(erx + 2.2 * k, erx * 1.3) + half, uy: ery + 1.6 * k + half, side: local(a.headCenter).x - a.headRx * k * 0.97 }
}

// ---------------------------------------------------------------------------------------------
// Smykker og kapper

/** Hagen ligger under halsleddet på arter med lang mule (og babyens hoved er relativt større). */
export function chinDrop(a: AnchorSet, stage: Stage, extra: number): number {
  return Math.max(0, a.mouth.y + extra - a.neck.y) * (STAGE_XF[stage].head / STAGE_XF[stage].body)
}

/** Halsens smykke flyttet ned under hagen (lokalt), eller 0 alene. */
export const neckDrop = (p: Pick<ItemArtProps, 'a' | 'local' | 'stage' | 'solo'>, extra: number) =>
  p.solo ? 0 : p.local({ x: p.a.neck.x, y: p.a.neck.y + chinDrop(p.a, p.stage, extra) }).y

/**
 * Kappen fra halsen ned mod jorden (lokalt) og hvor bredt den må være for at blive i den sikre zone i stadiet
 * (lokale enheder fra midten; stor har en bredere krop).
 */
export function capeFrame(p: Pick<ItemArtProps, 'a' | 'local' | 'stage'>, gap: number, liftK: number) {
  const top = p.local(p.a.neck).y - 4
  const bot = p.local(p.a.ground).y - gap
  const k = STAGE_XF[p.stage].fig * STAGE_XF[p.stage].body
  const model = (wx: number) => p.a.ground.x + (wx - p.a.ground.x) / k
  const l = p.local({ x: model(SAFE.x0 + 2.5), y: p.a.bodyCenter.y })
  const r = p.local({ x: model(SAFE.x1 - 2.5), y: p.a.bodyCenter.y })
  return { top, bot, lift: (bot - top) * liftK, safe: Math.min(-l.x, r.x) }
}

// ---------------------------------------------------------------------------------------------
// Håndgenstande

/**
 * Rammen for en håndgenstand, der er drejet tilbage til verdensrummet (lyset oppefra til venstre, genstanden
 * opret): punkter langs aksen fra grebet (`along`, i hovedets modelenheder · `size`), et punkt i verdensrummet
 * (`world`) og enheden `m`.
 */
export function aimFrame(P: Aim, size: number) {
  const { at, k, g, d, u, rot } = P
  const t = (-rot * Math.PI) / 180
  const world = (p: Pt): Vec => {
    const q = at(p)
    return [q.x * Math.cos(t) - q.y * Math.sin(t), q.x * Math.sin(t) + q.y * Math.cos(t)]
  }
  const along = (s: number): Vec => world({ x: g.x + d.x * s * size * u, y: g.y + d.y * s * size * u })
  return { along, world, m: u * k * size, rot }
}

/** Poten står på jorden fra denne højde i modellen (lange, lodrette forben), og grebet ligger da under `grip` i verdensrummet (y). */
const GROUND_PAW = { model: 205, grip: 195 }

/**
 * Poten står på jorden (de lange, lodrette forben på kat, hvalp, hest, enhjørning og ræv) og er ikke løftet i
 * humøret: håndgenstanden holdes da nede ved jorden, hvor forbenet tegnes over den (review G2-r3 T15).
 */
export const groundPaw = (a: AnchorSet, hold: HandHold | undefined): hold is HandHold =>
  !!hold && a.pawR.y >= GROUND_PAW.model && hold.grip.y >= GROUND_PAW.grip

// ---------------------------------------------------------------------------------------------
// Kropstøj (rustning, tryllekjortel): snit, fladt ikon, skygge og ærmer

/** Halsudskæringens y (lokalt) og kanten (hoften) pr. kropsform; babyens korte torso får kanten højere. */
const CUTS: Record<BodyKind, readonly [number, number]> = { round: [-36, 19], pear: [-34, 22], tall: [-40, 16] }
/** Kanten buer nedad midtpå (kroppens rundning set forfra). */
export const SAG = 2.6

/** Tøjet lagt fladt (ikon uden bærer): krop, lange ærmer, der hænger let ud til siden, og skøder. */
const FLAT = blob(
  symmetric([
    [0, -37], [-12.5, -41], [-28, -38.5], [-42, -30.5], [-52.5, -9], [-59, 16], [-46.5, 19.5], [-39.5, -5],
    [-41, 26], [-20, 29], [0, 29.5],
  ]),
  0.45,
)

/**
 * Kropstøj klippet til sin længde: stoffet med cel-skygge, genstandens detaljer (`inner` i klippet, `outer`
 * ovenpå) og kroppens kontur streget igen inden for kanten. `longer` forlænger kanten (en kjortel).
 */
export function garment(
  kind: BodyKind,
  key: string,
  longer: number,
  inner: (collar: number, hem: number, p: ItemArtProps) => readonly Seg[],
  outer: (collar: number, hem: number, p: ItemArtProps) => readonly Seg[],
): ItemArt {
  return (p) => {
    const { c, sw, ids, restroke, solo, stage } = p
    const collar = solo ? -37 : CUTS[kind][0]
    const hem = solo ? 26 + longer : CUTS[kind][1] + longer - (stage === 1 ? 7 : 0)
    const clip = `${ids.uid}-${key}-${solo ? 'flat' : kind}`
    return (
      <>
        <clipPath id={clip}>
          <path d={solo ? FLAT : band(-90, 90, -90, hem + sw / 2 + 0.2, 0, SAG)} />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <path d={rect(-80, -80, 160, 130)} fill={c.main} />
          <path d={outside(ellipse(-8, -12, 51, 47.5))} fill={c.mainShade} fillRule="evenodd" />
          {draw(...inner(collar, hem, p))}
          {!solo && restroke()}
        </g>
        {solo && <path d={FLAT} fill="none" stroke={c.outline} strokeWidth={sw} strokeLinejoin="round" />}
        {draw(...outer(collar, hem, p))}
      </>
    )
  }
}

/** Ærmet: stoffet og en manchet over poten (et langt ærme følger forbenet fra skulderen); `extra` lægges ovenpå. */
export const sleeveWith = (cuffUp: number, extra?: (p: Parameters<SleeveArt>[0]) => Seg): SleeveArt => (props) => {
  const { c, sw, sleeve: d, cuff, long } = props
  return draw(
    [long ? long.d : d, c.main, c.outline, sw],
    extra?.(props),
    [softBand(-cuff.half + 2.4, cuff.half - 2.4, cuff.y - cuffUp, cuff.y + 3, 1.8, 1.8), c.trim, c.trimOutline, sw],
  )
}

/** Ærmet på en løftet arm (riggen regner formen ud langs armen): samme stof og manchet. */
export const sleeveUp: SleeveUpArt = ({ c, sw, fill, edge, cuff }) => draw([fill, c.main], [edge, 'none', c.outline, sw], [cuff, c.trim, c.trimOutline, sw])

// ---------------------------------------------------------------------------------------------
// Kapper (ridderkappe, stjernekappe): som superheltekappen hænger de bag kroppen fra skuldrene mod jorden

/** Kappens bue forneden (y ved x): højre hjørne løfter sig mest, som om vinden tager det. */
const hemY = (x: number, L: number, R: number, bot: number, lift: number) => (x > 0 ? bot - lift * (x / R) ** 2 : bot - lift * 0.3 * (x / L) ** 2)

/** Et bånd langs kappens bue forneden fra `up0` til `up1` enheder over bunden (borten). */
function hemBand(L: number, R: number, bot: number, lift: number, up0: number, up1: number): string {
  const xs = Array.from({ length: 9 }, (_, i) => R - ((R + L) * i) / 8)
  return blob([...xs.map((x) => [x, hemY(x, L, R, bot, lift) - up1] as Vec), ...xs.reverse().map((x) => [x, hemY(x, L, R, bot, lift) - up0] as Vec)], 0.5)
}

export interface CapeOpts {
  /** Afstanden fra kappens bund til jorden og løftet i højre hjørne (andel af højden). */
  gap: number
  liftK: number
  /** Antal runde tunger forneden (0 = glat bund) og hakkenes dybde. */
  dags: number
  notch: number
  /** Spændet foran halsen (og øverst på kappen alene) og dets afstand under hagen. */
  clasp: (c: ItemArtProps['c'], sw: number, y: number) => readonly Seg[]
  claspY: number
  /** Mønster på stoffet (stjerner), tegnet i kappens ramme: top, bund, løft og halve bredder. */
  deco?: (f: { top: number; bot: number; lift: number; L: number; R: number }, p: ItemArtProps) => Seg
}

/**
 * Kappen: omridset med siderne, der breder sig godt ud over kroppen (så den ses på begge sider af dyret, også på
 * butikskortet, review G1-r4, B3), og bunden (glat eller i tunger), indersiden i skygge inden for en smal kant,
 * borten forneden, folder fra skuldrene, glans og stoffets mønster. Højden regnes ud fra halsleddet og jordlinjen,
 * så kappen passer alle kropsformer og stadier, og den klemmes vandret, så hjørnerne bliver i den sikre zone.
 * Alene hænger kappen spredt ud med spændet foroven. Foran halsen (lag 9b) sidder spændet.
 */
export function cape(o: CapeOpts): { front: ItemArt; back: ItemArt } {
  // `flare` (butikskortet på dyret): højre side breder sig ud allerede fra skulderen, så kappen ses ved siden af
  // kroppen i kortets beskæring og ikke kun forneden (review G1-r4, B3).
  const outline = (top: number, bot: number, lift: number, L: number, R: number, inset: number, flare: number): Vec[] => {
    const h = bot - top
    const n = o.dags ? 2 * o.dags : 4
    return [
      [0, top + inset],
      [30 - inset * 0.6, top + 2 + inset],
      [R * (0.68 + 0.36 * flare), top + h * (0.36 - 0.2 * flare)],
      [R * (0.94 + 0.1 * flare), top + h * 0.74 - lift * 0.4],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const x = R - ((R + L) * i) / n
        return [x, hemY(x, L, R, bot, lift) - inset * 0.8 - (o.dags && i % 2 === 0 ? o.notch : 0)] as Vec
      }),
      [-L * 0.94, top + h * 0.74],
      [-L * 0.68, top + h * 0.36],
      [-30 + inset * 0.6, top + 2 + inset],
    ]
  }
  const front: ItemArt = (p) => {
    const { c, sw, a, local, solo, stage, showcase } = p
    const f = solo ? { top: -44, bot: 40, lift: 6, safe: 0 } : capeFrame({ a, local, stage }, o.gap, o.liftK)
    const { top, bot, lift } = f
    const fl = showcase ? 1 : 0
    const sx = solo ? 0.56 : Math.min(1, (f.safe - 5.5) / (86 * (1 + 0.1 * fl)))
    const L = 80 * sx
    const R = 86 * sx
    const h = bot - top
    const shape = blob(outline(top, bot, lift, L, R, 0, fl), 0.62)
    const up = o.dags ? o.notch : 0
    const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
    return (
      <>
        <path d={shape} fill={c.main} {...stroke} />
        <path d={blob(outline(top + 5, bot - 4, lift, L, R, 7, fl), 0.62)} fill={c.mainShade} />
        {o.deco && draw(o.deco({ top, bot, lift, L, R }, p))}
        <path d={hemBand(L - 4, R - 4, bot, lift, up + 1.2, up + 6.4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
        <path
          d={join(spline([[-L * 0.24, top + 12], [-L * 0.32, top + h * 0.5], [-L * 0.4, bot - up - 10]]), spline([[R * 0.26, top + 12], [R * 0.38, top + h * 0.5], [R * 0.46, bot - lift * 0.3 - up - 10]]))}
          fill="none"
          stroke={c.mainShade}
          strokeWidth={sw * 0.8}
          strokeLinecap="round"
        />
        <path d={shape} fill="none" {...stroke} />
        <path d={join(ellipse(-L * 0.86, top + h * 0.56, 2.4, 10, 16), ellipse(R * 0.88, top + h * 0.52, 2.2, 9, -18))} fill={c.highlight} />
        {solo && draw(...o.clasp(c, sw, top + 3))}
      </>
    )
  }
  const back: ItemArt = (p) => (p.solo ? null : draw(...o.clasp(p.c, p.sw, neckDrop(p, 5) + o.claspY)))
  return { front, back }
}
