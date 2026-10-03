// pay (SPEC §3.2), the part without React: which coins and notes the purse offers, what the tray
// hands in, and which pieces picture an amount. Pieces are øre: coins 50–2000, notes 5000–50000
// (the 1000-krone note does not exist). Two answers are possible (src/engine/answer.ts):
//   answerType 'ore' — the tray's sum in øre: any way of paying the exact amount is right;
//   answerType 'set' — the coins themselves, 'c2000|c500|c200' (fewestCoins), compared as a multiset.
import type { AnswerValue, Task } from '../../../engine/types'

export type Piece = number

export const COIN_PIECES: readonly Piece[] = [50, 100, 200, 500, 1000, 2000]
export const NOTE_PIECES: readonly Piece[] = [5000, 10000, 20000, 50000]

export const isCoinPiece = (v: number) => COIN_PIECES.includes(v)
export const isNotePiece = (v: number) => NOTE_PIECES.includes(v)
export const isPiece = (v: number) => isCoinPiece(v) || isNotePiece(v)

/** Most pieces the tray takes (a child can always pay 100 kr with notes and coins in fewer). */
export const MAX_TRAY = 24

const desc = (a: number, b: number) => b - a

/** 'c2000' → 2000 (null when it is no coin or note token). */
export function pieceOfToken(token: string): Piece | null {
  const m = /^c(\d+)$/.exec(token)
  const v = m ? Number(m[1]) : NaN
  return isPiece(v) ? v : null
}

export const tokenOf = (piece: Piece) => `c${piece}`

/** The pieces of a coin set ('c2000|c500' → [2000, 500]); unknown tokens are left out. */
export function piecesOfSet(value: string): Piece[] {
  return value
    .split('|')
    .map(pieceOfToken)
    .filter((v): v is Piece => v !== null)
}

/** The amount the task asks for, in øre (the answer, or the sum of its coin set). */
export function amountOf(task: Pick<Task, 'answer' | 'prompt'>): number {
  if (typeof task.answer === 'number') return task.answer
  if (typeof task.answer === 'string' && task.answer.startsWith('c')) return piecesOfSet(task.answer).reduce((s, v) => s + v, 0)
  const p = task.prompt
  return p.scene === 'shop' ? p.priceOre : p.scene === 'amount' ? p.ore : 0
}

/**
 * The coins and notes in the purse, largest first. The shop's purse is the task's own choice; without
 * one, the coins (with 50 øre only when the amount has øre) and the notes up to the amount.
 */
export function purseOf(task: Pick<Task, 'answer' | 'prompt'>): Piece[] {
  const p = task.prompt
  if (p.scene === 'shop') {
    const own = [...new Set(p.purse.filter(isPiece))].sort(desc)
    if (own.length > 0) return own
  }
  const amount = amountOf(task)
  const coins = COIN_PIECES.filter((v) => v >= 100 || amount % 100 !== 0)
  const notes = NOTE_PIECES.filter((v) => v <= amount)
  return [...notes, ...coins].sort(desc)
}

/** The purse can pay the answer exactly (an amount, or a set of known coins and notes). */
export function canPay(task: Pick<Task, 'answer' | 'answerType' | 'prompt'>): boolean {
  const a = task.answer
  if (typeof a === 'string') return task.answerType === 'set' && a !== '' && a.split('|').every((t) => pieceOfToken(t) !== null)
  return Number.isInteger(a) && a > 0 && fewestPieces(a, purseOf(task)) !== null
}

/** The tray with one more piece laid, or null when it is full or the piece is no coin or note. */
export function trayWith(tray: readonly Piece[], piece: Piece): Piece[] | null {
  if (tray.length >= MAX_TRAY || !isPiece(piece)) return null
  return [...tray, piece]
}

/**
 * The tray with one `piece` taken back (the last one laid), or null when there is none of it: a
 * second tap on a pile that is already gone takes nothing (QA2 P3-15; it used to take the last
 * piece of another kind, since `lastIndexOf` gave −1 and `splice(−1, 1)` cut the end).
 */
export function trayWithout(tray: readonly Piece[], piece: Piece): Piece[] | null {
  const i = tray.lastIndexOf(piece)
  if (i < 0) return null
  return [...tray.slice(0, i), ...tray.slice(i + 1)]
}

/** What the tray hands in: its sum in øre, or its coin set when the task asks for the coins. */
export function payValue(task: Pick<Task, 'answerType'>, tray: readonly Piece[]): AnswerValue {
  if (task.answerType === 'set') return [...tray].sort(desc).map(tokenOf).join('|')
  return tray.reduce((s, v) => s + v, 0)
}

/**
 * The fewest pieces from `purse` that make `ore` exactly (largest first), or null when the purse
 * cannot make it. Exact (not greedy), so a purse of 5 and 2 kroner still pays 6 kr as 2 + 2 + 2.
 */
export function fewestPieces(ore: number, purse: readonly Piece[]): Piece[] | null {
  if (!Number.isInteger(ore) || ore < 0) return null
  const unit = 50
  if (ore % unit !== 0) return null
  const n = ore / unit
  const kinds = [...new Set(purse.filter((v) => isPiece(v) && v % unit === 0))].sort(desc)
  const best = new Array<number>(n + 1).fill(Infinity)
  const last = new Array<number>(n + 1).fill(-1)
  best[0] = 0
  for (let i = 1; i <= n; i++) {
    for (const v of kinds) {
      const k = v / unit
      if (k <= i && best[i - k] + 1 < best[i]) {
        best[i] = best[i - k] + 1
        last[i] = v
      }
    }
  }
  if (!Number.isFinite(best[n])) return null
  const out: Piece[] = []
  for (let i = n; i > 0; i -= last[i] / unit) out.push(last[i])
  return out.sort(desc)
}

/** The pieces that picture an answer value: a coin set as it is, an amount in the fewest pieces. */
export function piecesOf(task: Pick<Task, 'answer' | 'prompt'>, value: AnswerValue): Piece[] {
  if (typeof value === 'string') return piecesOfSet(value).sort(desc)
  return fewestPieces(value, purseOf(task)) ?? fewestPieces(value, [...COIN_PIECES, ...NOTE_PIECES]) ?? []
}

/** Pieces grouped by kind, largest first: [{ piece: 1000, n: 2 }, { piece: 200, n: 1 }]. */
export function groupPieces(pieces: readonly Piece[]): { piece: Piece; n: number }[] {
  const counts = new Map<Piece, number>()
  for (const p of pieces) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([piece, n]) => ({ piece, n }))
}

// The struck answer after a mistake should be the child's own tray, not just its sum: the view
// remembers the pieces it handed in, and the face looks them up for the same task and value.
const trays = new Map<string, Piece[]>()
const trayKey = (taskId: string, value: AnswerValue) => `${taskId}\u0000${String(value)}`

export function rememberTray(taskId: string, value: AnswerValue, tray: readonly Piece[]): void {
  trays.delete(trayKey(taskId, value))
  trays.set(trayKey(taskId, value), [...tray])
  while (trays.size > 8) trays.delete(trays.keys().next().value as string)
}

export function rememberedTray(taskId: string, value: AnswerValue): Piece[] | null {
  return trays.get(trayKey(taskId, value)) ?? null
}
