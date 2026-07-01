import type { LevelDef, PieceType, PlacedPiece, Slot } from '../types'
import { PIECE_TYPES } from '../physics/constants'

/** How many of `type` are currently placed. */
export function usedCount(placements: PlacedPiece[], type: PieceType): number {
  return placements.filter((p) => p.type === type).length
}

/** How many of `type` remain available given the level inventory. */
export function remaining(level: LevelDef, placements: PlacedPiece[], type: PieceType): number {
  return (level.inventory[type] ?? 0) - usedCount(placements, type)
}

/** Total pieces still available across all types. */
export function totalRemaining(level: LevelDef, placements: PlacedPiece[]): number {
  return PIECE_TYPES.reduce((sum, t) => sum + Math.max(0, remaining(level, placements, t)), 0)
}

/** The piece placed in a slot, if any. */
export function pieceInSlot(placements: PlacedPiece[], slotId: string): PlacedPiece | undefined {
  return placements.find((p) => p.slotId === slotId)
}

export function slotAllows(slot: Slot, type: PieceType): boolean {
  return slot.allowedTypes.length === 0 || slot.allowedTypes.includes(type)
}

/**
 * Whether `type` can be placed into `slot` right now: slot empty, type allowed
 * by the slot, and inventory not exhausted. This is the single guard the UI and
 * store both consult so the inventory limit can never be bypassed.
 */
export function canPlace(level: LevelDef, placements: PlacedPiece[], slot: Slot, type: PieceType): boolean {
  if (pieceInSlot(placements, slot.id)) return false
  if (!slotAllows(slot, type)) return false
  return remaining(level, placements, type) > 0
}

/** Inventory types this level offers, in canonical order. */
export function inventoryTypes(level: LevelDef): PieceType[] {
  return PIECE_TYPES.filter((t) => (level.inventory[t] ?? 0) > 0)
}
