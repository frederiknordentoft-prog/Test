/**
 * Procedural tandhjulsgeometri. Ingen assets — alt genereres.
 */

const TAU = Math.PI * 2

/** Andel af tandafstanden (pitch) som tanden fylder ved roden hhv. spidsen. */
export const TOOTH_ROOT_FRACTION = 0.5
export const TOOTH_TIP_FRACTION = 0.3

function fmt(n: number): string {
  // Kompakt og deterministisk — undgår "-0" og lange haler.
  const v = Math.round(n * 1000) / 1000
  return (Object.is(v, -0) ? 0 : v).toString()
}

/**
 * Returnerer et lukket SVG path centreret i (0,0).
 *
 * @param teeth      antal tænder (>= 3)
 * @param outerR     radius til tandspids
 * @param innerR     radius på akselhullet (<= 0 = intet hul)
 * @param toothDepth radial tanddybde; rodradius = outerR - toothDepth
 *
 * Profilen er en trapez-tand: 4 punkter per tand (rod, spids, spids, rod).
 * Hullet lægges som en separat, lukket subpath; brug fill-rule="evenodd".
 */
export function makeGearPath(teeth: number, outerR: number, innerR: number, toothDepth: number): string {
  if (!Number.isInteger(teeth) || teeth < 3) throw new RangeError('teeth skal være et heltal >= 3')
  if (!(outerR > 0)) throw new RangeError('outerR skal være > 0')
  if (!(toothDepth > 0) || toothDepth >= outerR) throw new RangeError('toothDepth skal ligge i (0, outerR)')
  if (innerR >= outerR - toothDepth) throw new RangeError('innerR skal være mindre end rodradius')

  const rootR = outerR - toothDepth
  const pitch = TAU / teeth
  const rootHalf = (pitch * TOOTH_ROOT_FRACTION) / 2
  const tipHalf = (pitch * TOOTH_TIP_FRACTION) / 2

  const parts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch
    const pts: Array<[number, number]> = [
      [rootR, a - rootHalf],
      [outerR, a - tipHalf],
      [outerR, a + tipHalf],
      [rootR, a + rootHalf],
    ]
    for (const [r, ang] of pts) {
      const x = fmt(r * Math.cos(ang))
      const y = fmt(r * Math.sin(ang))
      parts.push(`${parts.length === 0 ? 'M' : 'L'}${x} ${y}`)
    }
  }
  parts.push('Z')

  if (innerR > 0) {
    const r = fmt(innerR)
    // To halvcirkelbuer giver en lukket cirkel som subpath.
    parts.push(`M${r} 0`, `A${r} ${r} 0 1 0 ${fmt(-innerR)} 0`, `A${r} ${r} 0 1 0 ${r} 0`, 'Z')
  }

  return parts.join(' ')
}

/** Hjælper til tests og layout: tæller tandspidser (2 per tand) i et path fra makeGearPath. */
export function countTeethInPath(path: string, outerR: number, tolerance = 1e-2): number {
  const re = /[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g
  let tips = 0
  for (const m of path.matchAll(re)) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (Math.abs(Math.hypot(x, y) - outerR) <= tolerance) tips++
  }
  return tips / 2
}
