// Kan-bogen (SPEC §1 "tre spor", §5.2): what the child can, in its own words ("Jeg kan tælle til ti."),
// with the medal it earned — gold "Det kan jeg selv" first, then silver and bronze. Medals are kept for
// good, so the book only ever grows. Every line is read aloud on tap.
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ProfileDoc } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { cx } from '../../../design/cx'
import { canBookModel, type CanEntry } from './model'

const TIERS = [
  { medal: 'gold', title: 's.books.can.gold' },
  { medal: 'silver', title: 's.books.can.silver' },
  { medal: 'bronze', title: 's.books.can.bronze' },
] as const

export function CanBook({ profile }: { profile: ProfileDoc }) {
  const model = useMemo(() => canBookModel(profile), [profile.skillMedals])
  if (model.count === 0) {
    return (
      <div className="bk-empty" data-book="can" data-empty="">
        <Icon name="medal" size={56} className="bk-empty__icon" />
        <SpokenText clip="s.books.can.empty" />
      </div>
    )
  }
  return (
    <div className="bk-can" data-book="can">
      {TIERS.map(({ medal, title }) =>
        model[medal].length > 0 ? (
          <section key={medal} className={cx('bk-tier', `bk-tier--${medal}`)} data-tier={medal}>
            <header className="bk-tier__head">
              <span className={cx('bk-medal', `bk-medal--${medal}`)} aria-hidden>
                <Icon name="medal" size={30} strokeWidth={2.4} />
              </span>
              <SpokenText as="h2" clip={title} className="bk-h2" />
            </header>
            <ul className="bk-can__list">
              {model[medal].map((e) => (
                <CanLine key={e.skill} entry={e} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  )
}

function CanLine({ entry }: { entry: CanEntry }) {
  return (
    <li className="bk-can__line" style={{ '--c': `var(--color-d-${entry.domain})`, '--c-soft': `var(--color-d-${entry.domain}-soft)` } as CSSProperties} data-skill={entry.skill}>
      <span className={cx('bk-medal bk-medal--sm', `bk-medal--${entry.medal}`)} aria-hidden>
        <Icon name="medal" size={22} strokeWidth={2.4} />
      </span>
      <SpokenText clip={entry.clip} className="bk-can__text" />
    </li>
  )
}
