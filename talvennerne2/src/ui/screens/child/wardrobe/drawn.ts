// Which things are drawn (review P1-3). The shop sells, and the wardrobe's "Det kan du få" offers,
// only things whose drawing exists in src/art/items: a child never buys, wishes for or is promised
// something it cannot see on its animal. A thing the child already owns without a drawing (from an
// earlier version, a chest or a level) stays the child's and is shown with its stand-in, so nothing
// is lost.
//
// The filter disappears by itself as the drawings land: AVAILABLE_ITEMS lists the item files that
// exist, so a set comes into the shop, and a thing into "Det kan du få", the moment its file is
// added — nothing here or in the screens has to change.
import { AVAILABLE_ITEMS } from '../../../../art/items/registry'
import type { ItemId } from '../../../../engine/types'

/** Is the thing drawn? Screens take it as a parameter so tests can hand in their own. */
export type DrawnItem = (item: ItemId) => boolean

export const isItemDrawn: DrawnItem = (item) => AVAILABLE_ITEMS.includes(item)

/** Every thing counts as drawn (tests of the shop's and the wardrobe's own rules). */
export const everyItemDrawn: DrawnItem = () => true
