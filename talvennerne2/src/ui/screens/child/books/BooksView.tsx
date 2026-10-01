// The books (SPEC §1, §6.1, §13): a shelf of four, and each book on its own page with ← back to the
// shelf. Every title, line and number is read aloud on tap.
import type { CSSProperties } from 'react'
import type { BookId } from '../../../../app/routes'
import type { ProfileDoc } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import type { IconName } from '../../../design/icons'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { TopBar } from '../../../shell/TopBar'
import { CanBook } from './CanBook'
import { CollectionBook } from './Collection'
import { shelfModel, type ShelfBook } from './model'
import { StampBook } from './StampBook'
import { TrophyBook } from './TrophyBook'

const COVER: Readonly<Record<BookId, { icon: IconName; tone: string }>> = {
  collection: { icon: 'paw', tone: 'addsub' },
  can: { icon: 'medal', tone: 'number' },
  stamps: { icon: 'stamp', tone: 'fractions' },
  trophies: { icon: 'trophy', tone: 'money' },
}

export interface BooksViewProps {
  profile: ProfileDoc
  book: BookId | null
  onOpen(book: BookId): void
  onBack(): void
  /** "Se den i Dyrehaven" from a found animal's card. */
  onVisit(uid: string): void
}

export function BooksView({ profile, book, onOpen, onBack, onVisit }: BooksViewProps) {
  const speech = useSpeech()
  if (!book) {
    return (
      <div className="bk" data-books="shelf">
        <TopBar center={<SpokenText as="h1" clip="s.books.title" className="bk__title" />} onReplay={() => speech.speak([{ clip: 's.books.shelf' }])} />
        <div className="bk__scroll">
          <div className="bk-shelf">
            {shelfModel(profile).map((b) => (
              <Cover key={b.id} book={b} onOpen={() => onOpen(b.id)} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  const title = `s.books.${book}`
  return (
    <div className={cx('bk', `bk--${book}`)} data-books={book}>
      <TopBar leading="back" onLeading={onBack} center={<SpokenText as="h1" clip={title} className="bk__title" />} />
      <div className="bk__scroll">
        <div className="bk__inner">
          {book === 'collection' && <CollectionBook profile={profile} onVisit={onVisit} />}
          {book === 'can' && <CanBook profile={profile} />}
          {book === 'stamps' && <StampBook profile={profile} />}
          {book === 'trophies' && <TrophyBook profile={profile} />}
        </div>
      </div>
    </div>
  )
}

function Cover({ book, onOpen }: { book: ShelfBook; onOpen(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const look = COVER[book.id]
  const style = {
    '--c': `var(--color-d-${look.tone})`,
    '--c-deep': `var(--color-d-${look.tone}-deep)`,
    '--c-soft': `var(--color-d-${look.tone}-soft)`,
  } as CSSProperties
  return (
    <button
      type="button"
      className="bk-cover tv-touch"
      style={style}
      aria-label={speech.text(book.title)}
      onClick={() => {
        speech.speak([{ clip: book.title }, { clip: book.about }])
        onOpen()
      }}
      data-cover={book.id}
      {...pressProps}
    >
      <span className="bk-cover__spine" aria-hidden />
      <span className="bk-cover__icon" aria-hidden>
        <Icon name={look.icon} size={44} strokeWidth={2.2} />
      </span>
      <SpokenText clip={book.title} silent className="bk-cover__title" />
      <SpokenText clip={book.about} silent className="bk-cover__about" />
      <SpokenText parts={[{ num: book.count, form: 'end' }]} text={String(book.count)} silent className="bk-cover__count" />
    </button>
  )
}
