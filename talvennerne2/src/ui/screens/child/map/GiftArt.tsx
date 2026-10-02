// A wrapped gift in the colour of a thing's set: what a chest, a level or a ceremony shows for a thing
// whose drawing has not landed in src/art/items yet (review P1-3), instead of an outline that looks
// like another thing. The thing itself is the child's all along; the drawing replaces the gift by
// itself once its file exists. Drawn as UI (tokens via the set's tone, nothing moves).
import { ITEM_BY_ID } from '../../../../content/catalog'
import type { ItemId } from '../../../../engine/types'
import { cx } from '../../../design/cx'
import { SET_TONE, toneStyle } from '../wardrobe/tones'
import './gift.css'

/** viewBox 0 0 100 100: the box on the ground, the lid, the ribbon and a bow. */
const LOOP_L = 'M50 34C41 19 26 19 29 29C31 36 43 36 50 34z'
const LOOP_R = 'M50 34C59 19 74 19 71 29C69 36 57 36 50 34z'

export function GiftArt({ item, className }: { item: ItemId; className?: string }) {
  const set = ITEM_BY_ID[item]?.set
  const tone = set ? SET_TONE[set] : 'star'
  return (
    <svg viewBox="0 0 100 100" className={cx('tv-gift', className)} style={toneStyle(tone)} aria-hidden>
      <ellipse className="tv-gift__shadow" cx="50" cy="90" rx="34" ry="5" />
      <rect className="tv-gift__box" x="18" y="45" width="64" height="42" rx="6" />
      <path className="tv-gift__shade" d="M64 47h12a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H64z" />
      <rect className="tv-gift__ribbon" x="43" y="45" width="14" height="42" />
      <rect className="tv-gift__lid" x="13" y="33" width="74" height="15" rx="5" />
      <rect className="tv-gift__ribbon" x="43" y="33" width="14" height="15" />
      <path className="tv-gift__bow" d={LOOP_L} />
      <path className="tv-gift__bow" d={LOOP_R} />
      <circle className="tv-gift__knot" cx="50" cy="34" r="5.5" />
      <rect className="tv-gift__shine" x="23" y="51" width="6" height="16" rx="3" />
    </svg>
  )
}
