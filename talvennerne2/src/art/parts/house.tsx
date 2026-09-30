// Husets dele (SPEC §6.4): øjne, munde, kinder, jordskygge og fx. Fryses ved G1 og deles af alle
// 16 arter + Pip. Alt tegnes med primitiverne i shapes.ts; begge øjne samles i få paths, så et
// helt ansigt koster ~10 elementer.
import type { Ref } from 'react'
import { HOUSE, INK, SHADOW_ALPHA } from '../rig/palette'
import { arc, circle, dMouth, drop, ellipse, ellipseBelow, join, line, lune, n, quad, rect, spline, star, xf, zee } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, EyeShape, Mood, MouthShape, Palette, Pt } from '../rig/types'

// ---------------------------------------------------------------------------------------------
// Humør → ansigt

export interface MoodFace {
  eyes: EyeShape
  /** 'idle' = artens hvilemund (FaceStyle.idleMouth). */
  mouth: MouthShape | 'idle'
}

export const MOOD_FACE: Record<Mood, MoodFace> = {
  idle: { eyes: 'open', mouth: 'idle' },
  happy: { eyes: 'happy', mouth: 'open-D' },
  cheer: { eyes: 'sparkle', mouth: 'open-D' },
  think: { eyes: 'open', mouth: 'o' },
  oops: { eyes: 'half', mouth: 'smile' },
  sleep: { eyes: 'closed', mouth: 'o' },
  wave: { eyes: 'open', mouth: 'open-D' },
}

/** Hvor pupillerne kigger hen uden et mål (think: op mod højre). Modelenheder. */
export const MOOD_GAZE: Partial<Record<Mood, Pt>> = {
  think: { x: 2.4, y: -2.6 },
}

// ---------------------------------------------------------------------------------------------
// Øjne

export interface EyesProps {
  a: AnchorSet
  shape: EyeShape
  pal: Palette
  /** Stadiets øjenskala (baby ×1,15). */
  scale: number
  sw: number
  /** Pupil-forskydning i modelenheder (højst 3). */
  gaze?: Pt
  /** Animeret: blink-klassen og refs til pupil-tracking. */
  animated?: boolean
  gazeRef?: Ref<SVGGElement>
  glintRef?: Ref<SVGGElement>
}

/**
 * Store lodrette ovaler i ink med en iris-halvmåne i artens accentfarve og to højlys (stort
 * øverst til venstre, lille nederst til højre). Pivot for blink = midt mellem øjnene.
 */
export function Eyes({ a, shape, pal, scale, sw, gaze, animated, gazeRef, glintRef }: EyesProps) {
  const ox = (a.eyeL.x + a.eyeR.x) / 2
  const oy = (a.eyeL.y + a.eyeR.y) / 2
  const rx = a.eyeRx * scale
  const ry = a.eyeRy * scale
  const eyes: Vec[] = [
    [a.eyeL.x - ox, a.eyeL.y - oy],
    [a.eyeR.x - ox, a.eyeR.y - oy],
  ]
  const g = gaze ?? { x: 0, y: 0 }
  const gazeT = g.x || g.y ? `translate(${n(g.x)} ${n(g.y)})` : undefined
  const glintT = g.x || g.y ? `translate(${n(g.x * 0.45)} ${n(g.y * 0.45)})` : undefined
  const inkLine = { fill: 'none', stroke: pal.ink, strokeWidth: sw * 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  let body
  if (shape === 'happy') {
    body = <path d={join(...eyes.map(([x, y]) => quad([x - rx * 0.95, y + ry * 0.22], [x, y - ry * 0.95], [x + rx * 0.95, y + ry * 0.22])))} {...inkLine} />
  } else if (shape === 'closed') {
    body = (
      <path
        d={join(
          ...eyes.map(([x, y], i) => {
            const s = i === 0 ? -1 : 1
            return join(
              quad([x - rx * 0.95, y + ry * 0.05], [x, y + ry * 0.75], [x + rx * 0.95, y + ry * 0.05]),
              quad([x + s * rx * 0.95, y + ry * 0.05], [x + s * rx * 1.25, y - ry * 0.05], [x + s * rx * 1.35, y - ry * 0.3]),
            )
          }),
        )}
        {...inkLine}
      />
    )
  } else {
    const half = shape === 'half'
    // Genert "ups": låget skærer toppen af øjet i en let skrå linje (inderste hjørne højest),
    // og to bekymrede bryn løfter sig mod midten. Aldrig vredt eller trist.
    const tilt = (i: number) => (i === 0 ? -1 : 1) * ry * 0.16
    const cut = (y: number) => y - ry * 0.18
    const eyeD = half
      ? join(...eyes.map(([x, y], i) => ellipseBelow(x, y, rx, ry, cut(y), tilt(i))))
      : join(...eyes.map(([x, y]) => ellipse(x, y, rx, ry)))
    const lidD = join(
      ...eyes.map(([x, y], i) => {
        const w = rx * 1.14
        const t = tilt(i) * 0.57
        return line([x - w, cut(y) - t], [x + w, cut(y) + t])
      }),
    )
    const browD = join(
      ...eyes.map(([x, y], i) => {
        const s = i === 0 ? 1 : -1
        return quad([x - s * rx * 0.85, y - ry * 1.3], [x - s * rx * 0.05, y - ry * 1.66], [x + s * rx * 0.78, y - ry * 1.68])
      }),
    )
    const irisD = join(...eyes.map(([x, y]) => lune(x, y + ry * 0.06, rx * 0.78, ry * 0.8, ry * 0.3)))
    const sparkle = shape === 'sparkle'
    const glints = join(
      ...eyes.map(([x, y]) =>
        sparkle
          ? join(star(x - rx * 0.28, y - ry * 0.3, rx * 0.62, rx * 0.12), circle(x + rx * 0.4, y + ry * 0.42, rx * 0.17))
          : half
            ? join(circle(x - rx * 0.32, y + ry * 0.12, rx * 0.25), circle(x + rx * 0.4, y + ry * 0.5, rx * 0.14))
            : join(ellipse(x - rx * 0.3, y - ry * 0.36, rx * 0.36, ry * 0.3, -20), circle(x + rx * 0.4, y + ry * 0.44, rx * 0.17)),
      ),
    )
    body = (
      <>
        <g ref={gazeRef} transform={gazeT}>
          <path d={eyeD} fill={pal.ink} data-part="eyes" />
          <path d={irisD} fill={pal.iris} opacity={pal.silhouette ? 0 : 0.85} />
        </g>
        <g ref={glintRef} transform={glintT}>
          <path d={glints} fill={pal.silhouette ? 'none' : HOUSE.white} />
        </g>
        {half && <path d={join(lidD, browD)} {...inkLine} strokeWidth={sw * 0.9} />}
      </>
    )
  }
  const blink = animated && (shape === 'open' || shape === 'sparkle' || shape === 'half')
  return (
    <g transform={`translate(${n(ox)} ${n(oy)})`}>
      <g className={blink ? 'a-blink' : undefined}>{body}</g>
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Munde

export interface MouthProps {
  at: Pt
  shape: MouthShape
  pal: Palette
  sw: number
  /** Størrelse relativt til standardhovedet (headRx 56). */
  scale?: number
  buckTeeth?: boolean
}

export function Mouth({ at, shape, pal, sw, scale = 1, buckTeeth }: MouthProps) {
  const { x, y } = at
  const k = scale
  const stroke = { stroke: pal.ink, strokeWidth: sw * 0.78, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (shape) {
    case 'smile':
      return <path d={quad([x - 6 * k, y - 1.5 * k], [x, y + 5 * k], [x + 6 * k, y - 1.5 * k])} fill="none" {...stroke} />
    case 'cat-w':
      return (
        <path
          d={join(
            quad([x - 7.5 * k, y - 1.8 * k], [x - 3.8 * k, y + 4.6 * k], [x, y - 0.6 * k]),
            quad([x, y - 0.6 * k], [x + 3.8 * k, y + 4.6 * k], [x + 7.5 * k, y - 1.8 * k]),
            line([x, y - 5.5 * k], [x, y - 0.6 * k]),
          )}
          fill="none"
          {...stroke}
        />
      )
    case 'o':
      return <path d={ellipse(x, y + 1 * k, 3.4 * k, 4 * k)} fill={pal.silhouette ? pal.ink : HOUSE.mouth} {...stroke} />
    case 'wobble':
      return (
        <path
          d={spline([[x - 7 * k, y + 1 * k], [x - 3.5 * k, y - 1.2 * k], [x, y + 1 * k], [x + 3.5 * k, y - 1.2 * k], [x + 7 * k, y + 1 * k]], 1)}
          fill="none"
          {...stroke}
        />
      )
    case 'open-D': {
      // D-formet åben mund: flad overlæbe, dyb bund, tunge i bunden.
      const top = y - 3 * k
      const w = 8.5 * k
      const mouthD = dMouth(x, top, w, 12 * k, 1.6 * k)
      const tongue = ellipse(x + 0.6 * k, y + 5.1 * k, 4.6 * k, 2.6 * k)
      const teeth = buckTeeth
        ? join(rect(x - 3.9 * k, top - 1 * k, 3.4 * k, 5.6 * k, 1.1 * k), rect(x + 0.5 * k, top - 1 * k, 3.4 * k, 5.6 * k, 1.1 * k))
        : null
      return (
        <>
          <path d={mouthD} fill={pal.silhouette ? pal.ink : HOUSE.mouth} {...stroke} />
          <path d={tongue} fill={pal.silhouette ? pal.ink : HOUSE.tongue} />
          {teeth && (
            <>
              <path d={teeth} fill={pal.silhouette ? pal.ink : HOUSE.teeth} stroke={pal.ink} strokeWidth={sw * 0.32} strokeLinejoin="round" />
              <path d={quad([x - w, top], [x, top + 1.6 * k], [x + w, top])} fill="none" {...stroke} />
            </>
          )}
        </>
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Kinder og jordskygge

export function Cheeks({ a, pal, scale = 1 }: { a: AnchorSet; pal: Palette; scale?: number }) {
  if (pal.silhouette) return null
  const rx = 9.5 * scale
  const ry = 6 * scale
  return <path d={join(ellipse(a.cheekL.x, a.cheekL.y, rx, ry), ellipse(a.cheekR.x, a.cheekR.y, rx, ry))} fill={pal.cheek} opacity={0.55} />
}

/** Jordskyggens gradient (den eneste radialGradient i riggen). */
export function ShadowGradient({ id }: { id: string }) {
  return (
    <radialGradient id={id}>
      <stop offset="0" stopColor={INK} stopOpacity={SHADOW_ALPHA} />
      <stop offset="1" stopColor={INK} stopOpacity={0} />
    </radialGradient>
  )
}

export function GroundShadow({ id, cx, cy, rx, className }: { id: string; cx: number; cy: number; rx: number; className?: string }) {
  return <ellipse className={className} data-part="shadow" cx={n(cx)} cy={n(cy)} rx={n(rx)} ry={n(rx * 0.13)} fill={`url(#${id})`} />
}

// ---------------------------------------------------------------------------------------------
// fx-laget (verdensrum)

/** Statisk glimmer på magiske farver: tre glimt i én path. */
export function Sparkles({ pts, size, fill, stroke, sw, className }: { pts: readonly Pt[]; size: number; fill: string; stroke: string; sw: number; className?: string }) {
  const d = join(...pts.map((p, i) => star(p.x, p.y, size * (i === 1 ? 0.7 : 1), size * 0.2)))
  return <path className={className} d={d} fill={fill} stroke={stroke} strokeWidth={sw * 0.45} strokeLinejoin="round" />
}

/** Tankeprikker (think): tre cirkler, der tændes på skift. */
export function ThoughtDots({ at, s, sw, animated }: { at: Pt; s: number; sw: number; animated: boolean }) {
  const dots: [number, number, number][] = [
    [0, 0, 3.2],
    [7, -7, 4.4],
    [16, -15, 6],
  ]
  return (
    <g>
      {dots.map(([dx, dy, r], i) => (
        <circle
          key={i}
          className={animated ? `a-dot a-dot${i + 1}` : undefined}
          cx={n(at.x + dx * s)}
          cy={n(at.y + dy * s)}
          r={n(r * s)}
          fill={HOUSE.thought}
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={sw * 0.5}
        />
      ))}
    </g>
  )
}

/** Søvn: tre små Z'er, der stiger og fader (ingen <text>). */
export function Zzz({ at, s, sw, animated }: { at: Pt; s: number; sw: number; animated: boolean }) {
  const zs: [number, number, number][] = [
    [0, 0, 3],
    [8, -10, 4],
    [18, -22, 5.2],
  ]
  return (
    <g>
      {zs.map(([dx, dy, r], i) => (
        <path
          key={i}
          className={animated ? `a-z a-z${i + 1}` : undefined}
          d={zee(at.x + dx * s, at.y + dy * s, r * s)}
          fill="none"
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={sw * 0.62}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
}

/** "Ups": en lille, venlig svedperle ved hovedet (aldrig tårer). */
export function SweatDrop({ at, s, sw, className }: { at: Pt; s: number; sw: number; className?: string }) {
  return (
    <g className={className}>
      <path d={drop(at.x, at.y, 4.2 * s)} fill={HOUSE.sweat} stroke={HOUSE.sweatLine} strokeWidth={sw * 0.5} strokeLinejoin="round" />
      <path d={ellipse(at.x - 1.4 * s, at.y - 0.4 * s, 1.1 * s, 1.8 * s, 20)} fill={HOUSE.white} opacity={0.8} />
    </g>
  )
}

/** Stjerneformens aura: en blød, flad glorie bag figuren og en krans af glimt (ingen filtre). */
export function Aura({ c, r, className }: { c: Pt; r: number; className?: string }) {
  const ring = around(c, r * 0.9, [-150, -110, -70, -30, 10, 170, 205, 335])
  return (
    <g className={className} data-part="aura">
      <path d={circle(c.x, c.y, r)} fill={HOUSE.aura} opacity={0.32} />
      <path d={circle(c.x, c.y, r * 0.76)} fill={HOUSE.aura} opacity={0.5} />
      <path d={join(...ring.map((p, i) => star(p.x, p.y, i % 2 ? 4.2 : 6.4, 1.1)))} fill={HOUSE.auraRing} />
    </g>
  )
}

/** Hjælper: punkter i en halvcirkel om et centrum (glimmer-placering). */
export function around(c: Pt, r: number, angles: readonly number[]): Pt[] {
  return xf(
    angles.map((a) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r] as Vec),
    { dx: c.x, dy: c.y },
  ).map(([x, y]) => ({ x, y }))
}

export { arc }
