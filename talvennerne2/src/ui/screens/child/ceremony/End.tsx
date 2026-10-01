// The last screen of the end of a round: the buddy, and "Også i dag" — the smaller news as cards
// that read themselves on a tap (a trophy, a stamp, a lantern lit, the hut). Then the child chooses:
// "Næste" or "Til kortet", the same size, neither in focus, nothing starting by itself.
import type { CSSProperties } from 'react'
import type { Animal } from '../../../../engine/types'
import type { CeremonyCard } from '../../../../meta/ceremonyQueue'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { Buddy } from '../round/Buddy'
import { lineText } from '../map/words'
import { cardSpeech, rewardIcon } from './describe'

export function EndScreen({ cards, buddy }: { cards: readonly CeremonyCard[]; buddy: Animal | null }) {
  return (
    <div className="tv-cer-end" data-cer-end={cards.length}>
      <div className="tv-cer-end__buddy">
        <Buddy animal={buddy} mood="happy" />
      </div>
      {cards.length > 0 && (
        <>
          <SpokenText as="h2" clip="s.reward.alsoToday" className="tv-cer-end__title" />
          <ul className="tv-alsotoday">
            {cards.map((card, i) => (
              <AlsoCard key={i} card={card} index={i} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AlsoCard({ card, index }: { card: CeremonyCard; index: number }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const parts = cardSpeech(card)
  const text = lineText(parts, speech.text)
  return (
    <li style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className="tv-alsocard tv-touch"
        aria-label={text}
        onClick={(e) => {
          e.stopPropagation()
          speech.speak(parts)
        }}
        data-also={card.reward.t}
        {...pressProps}
      >
        <span className="tv-alsocard__icon" aria-hidden>
          <Icon name={rewardIcon(card.reward)} size="58%" strokeWidth={2.3} />
        </span>
        <SpokenText parts={parts} text={text} silent className="tv-alsocard__text" />
      </button>
    </li>
  )
}
