// The dock (SPEC §11): Kort, Dyr, Garderobe, Butik, Bøger. Each tap says the name aloud, so it
// works before the child can read. Every destination has its own colour and icon; the current one
// is filled. A bottom bar in portrait and on iPad, a rail on the left on a phone held sideways.
import type { CSSProperties } from 'react'
import type { ClipId } from '../../engine/types'
import { Icon } from '../design/Icon'
import type { IconName } from '../design/icons'
import { useSpeech } from '../design/speech'
import { usePress } from '../design/usePress'
import { cx } from '../design/cx'

export const DOCK_IDS = ['map', 'animals', 'wardrobe', 'shop', 'books'] as const
export type DockId = (typeof DOCK_IDS)[number]

const ITEMS: Record<DockId, { icon: IconName; clip: ClipId; tone: string }> = {
  map: { icon: 'map', clip: 's.ui.dock.map', tone: 'number' },
  animals: { icon: 'paw', clip: 's.ui.dock.animals', tone: 'addsub' },
  wardrobe: { icon: 'shirt', clip: 's.ui.dock.wardrobe', tone: 'fractions' },
  shop: { icon: 'shop', clip: 's.ui.dock.shop', tone: 'money' },
  books: { icon: 'books', clip: 's.ui.dock.books', tone: 'shapes' },
}

export interface DockProps {
  active: DockId | null
  onSelect: (id: DockId) => void
  /** A small star on items with something new (never a number). */
  news?: Partial<Record<DockId, boolean>>
  className?: string
}

export function Dock({ active, onSelect, news, className }: DockProps) {
  return (
    <nav className={cx('tv-dock', className)} aria-label="Navigation">
      {DOCK_IDS.map((id) => (
        <DockItem key={id} id={id} active={active === id} news={!!news?.[id]} onSelect={onSelect} />
      ))}
    </nav>
  )
}

function DockItem({ id, active, news, onSelect }: { id: DockId; active: boolean; news: boolean; onSelect: (id: DockId) => void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const item = ITEMS[id]
  const style = {
    '--c': `var(--color-d-${item.tone})`,
    '--c-deep': `var(--color-d-${item.tone}-deep)`,
    '--c-soft': `var(--color-d-${item.tone}-soft)`,
  } as CSSProperties
  return (
    <button
      type="button"
      className={cx('tv-dock__item', active && 'is-active')}
      style={style}
      aria-current={active ? 'page' : undefined}
      aria-label={speech.text(item.clip)}
      onClick={() => {
        speech.speak([{ clip: item.clip }])
        onSelect(id)
      }}
      {...pressProps}
    >
      <span className="tv-dock__tile">
        <Icon name={item.icon} className="tv-dock__icon" strokeWidth={2.2} />
        {news && <span className="tv-dock__news" aria-hidden />}
      </span>
      <span className="tv-dock__label" aria-hidden>
        {speech.text(item.clip)}
      </span>
    </button>
  )
}
