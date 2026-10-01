// Stempelbogen (SPEC §13.1, §13.9): the days played in total — a number that only grows and is never
// a streak — every stamp the goals have given, numbered in order and without dates, and the next
// three goals, which never run out.
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ProfileDoc, SpeechPart } from '../../../../engine/types'
import { hashSeed } from '../../../../engine/rng'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { cx } from '../../../design/cx'
import { sentenceText } from '../animals/model'
import { stampModel } from './model'

/** Stamp colours take turns, so a full page looks like a stamp book, not a table. */
const INKS = ['primary', 'heart', 'good-strong', 'd-addsub', 'd-number'] as const

export function StampBook({ profile }: { profile: ProfileDoc }) {
  const speech = useSpeech()
  const model = useMemo(() => stampModel(profile), [profile.stamps, profile.daysPlayed, profile.goals])
  const days: SpeechPart[] = [{ clip: 's.books.days' }, { num: model.days, form: 'end' }]
  const stamps: SpeechPart[] = [{ clip: 's.books.stamps.count' }, { num: model.stamps, form: 'end' }]
  return (
    <div className="bk-stamps" data-book="stamps">
      <section className="bk-days" data-days={model.days}>
        <span className="bk-days__icon" aria-hidden>
          <Icon name="calendar" size={36} strokeWidth={2.3} />
        </span>
        <SpokenText parts={days} text={speech.text('s.books.days')} className="bk-days__label" />
        <SpokenText parts={days} text={String(model.days)} className="bk-days__n" />
      </section>

      <section className="bk-goals">
        <SpokenText as="h2" clip="s.books.goals" className="bk-h2" />
        <ul className="bk-goals__list">
          {model.goals.map(({ goal, parts }, i) => (
            <li key={`${goal.kind}-${i}`} className={cx('bk-goal', goal.done && 'is-done')} data-goal={goal.kind} data-done={goal.done ? '' : undefined}>
              <span className="bk-goal__mark" aria-hidden>
                <Icon name={goal.done ? 'stamp' : 'flag'} size={26} solid={goal.done} strokeWidth={2.3} />
              </span>
              <SpokenText parts={parts} text={sentenceText(parts, speech.text)} className="bk-goal__text" />
              {goal.done && <SpokenText clip="s.books.goal.done" className="bk-goal__done" />}
            </li>
          ))}
        </ul>
      </section>

      <section className="bk-stampgrid-wrap">
        <SpokenText as="h2" parts={stamps} text={`${speech.text('s.books.stamps.count')}: ${model.stamps}`} className="bk-h2" />
        {model.stamps === 0 ? (
          <div className="bk-empty bk-empty--inline" data-empty="">
            <SpokenText clip="s.books.stamps.empty" />
          </div>
        ) : (
          <ol className="bk-stampgrid" data-stamps={model.stamps}>
            {Array.from({ length: model.stamps }, (_, i) => (
              <Stamp key={i} n={i + 1} />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Stamp({ n }: { n: number }) {
  const h = hashSeed(`stamp:${n}`)
  const style = { '--rot': `${(h % 17) - 8}deg`, '--ink': `var(--color-${INKS[n % INKS.length]})` } as CSSProperties
  return (
    <li className="bk-stamp" style={style}>
      <SpokenText parts={[{ clip: 's.books.stamp' }, { num: n, form: 'end' }]} text={String(n)} className="bk-stamp__n" />
    </li>
  )
}
