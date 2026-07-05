import { ELEMENTS, toMicroU } from '../data/elements'

/**
 * Find en løsning med FÆRREST brikker: et multiset af tray-grundstoffer hvis
 * sum rammer targetMicro ± tolMicro. Iterativ uddybning (IDDFS) over
 * kombinationer i faldende masse-orden med sum-pruning — eksakt optimum
 * inden for maxDepth.
 */
export function solveFewest(
  targetMicro: number,
  tolMicro: number,
  maxDepth = 10,
): string[] | null {
  const masses = ELEMENTS.map((e) => ({
    symbol: e.symbol,
    micro: toMicroU(e.mass),
  })).sort((a, b) => b.micro - a.micro)
  const heaviest = masses[0]?.micro ?? 0

  const lo = targetMicro - tolMicro
  const hi = targetMicro + tolMicro

  for (let depth = 1; depth <= maxDepth; depth++) {
    const chosen: string[] = []

    const dfs = (startIdx: number, sum: number, left: number): boolean => {
      if (sum >= lo && sum <= hi) return left < depth // brugt ≥1 brik
      if (left === 0) return false
      if (sum > hi) return false
      if (sum + left * heaviest < lo) return false
      for (let i = startIdx; i < masses.length; i++) {
        const m = masses[i]
        if (!m) continue
        chosen.push(m.symbol)
        if (dfs(i, sum + m.micro, left - 1)) return true
        chosen.pop()
      }
      return false
    }

    if (dfs(0, 0, depth)) return [...chosen]
  }
  return null
}

/** Verificér at et multiset af symboler rammer målet inden for tolerancen. */
export function isSolution(
  symbols: readonly string[],
  targetMicro: number,
  tolMicro: number,
): boolean {
  let sum = 0
  for (const s of symbols) {
    const el = ELEMENTS.find((e) => e.symbol === s)
    if (!el) return false
    sum += toMicroU(el.mass)
  }
  return symbols.length > 0 && Math.abs(sum - targetMicro) <= tolMicro
}
