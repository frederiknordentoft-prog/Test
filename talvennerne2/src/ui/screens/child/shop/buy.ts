// Buying goes through the game layer (useMeta → meta/actions → useProfile.update), the one place
// perler go down: the action refuses what is not allowed, and the profile store refuses any change
// that would take something earned away. A refused purchase changes nothing at all.
import { useMeta } from '../../../../state/useMeta'
import type { Purchase } from './model'

/** True only when the purchase was made and saved to the profile. */
export function buy(x: Purchase): boolean {
  const meta = useMeta.getState()
  if (x.kind === 'item') return meta.buyItem(x.item)
  if (x.kind === 'color') return meta.buyRecolor(x.item, x.color)
  return meta.buyDecor(x.id)
}
