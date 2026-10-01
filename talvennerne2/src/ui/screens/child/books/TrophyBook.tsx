// Trofæerne (SPEC §13, catalog TROPHIES): all 34 in five groups. An earned trophy shines in its
// group's colour; one still to come is an outline with what earns it, read aloud, and — where it
// counts something — a bar of the way there without numbers ("never N more").
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { ProfileDoc, SpeechPart } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { lineText } from '../animals/model'
import { foundParts } from './Collection'
import { trophyModel, type TrophyEntry } from './model'

export function TrophyBook({ profile }: { profile: ProfileDoc }) {
  const speech = useSpeech()
  const model = useMemo(() => trophyModel(profile), [profile])
  const count: SpeechPart[] = [{ clip: 's.books.trophies.have' }, ...foundParts(model.earned, model.total).slice(1)]
  return (
    <div className="bk-trophies" data-book="trophies">
      <SpokenText parts={count} text={lineText(count, speech.text)} className="bk-count" />
      {model.groups.map((g) => (
        <section key={g.category} className={cx('bk-tgroup', `bk-tgroup--${g.category}`)} data-category={g.category}>
          <SpokenText as="h2" clip={g.title} className="bk-h2" />
          <ul className="bk-tgrid">
            {g.entries.map((e) => (
              <Trophy key={e.id} entry={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Trophy({ entry }: { entry: TrophyEntry }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const said: SpeechPart[] = entry.earned ? [{ clip: entry.name }] : [{ clip: entry.name }, { clip: entry.how }]
  return (
    <li className="bk-tcell">
      <button
        type="button"
        className={cx('bk-trophy tv-touch', entry.earned ? 'is-earned' : 'is-locked')}
        aria-label={lineText(said, speech.text)}
        onClick={() => speech.speak(said)}
        data-trophy={entry.id}
        data-earned={entry.earned ? '' : undefined}
        {...pressProps}
      >
        <span className="bk-trophy__cup" aria-hidden>
          <Icon name="trophy" solid={entry.earned} size={40} strokeWidth={entry.earned ? 2 : 2.4} />
        </span>
        <SpokenText clip={entry.name} silent className="bk-trophy__name" />
        {!entry.earned && <SpokenText clip={entry.how} silent className="bk-trophy__how" />}
        {!entry.earned && entry.progress !== null && (
          <span className="bk-bar" aria-hidden>
            <span className="bk-bar__fill" style={{ '--v': entry.progress } as CSSProperties} />
          </span>
        )}
      </button>
    </li>
  )
}
