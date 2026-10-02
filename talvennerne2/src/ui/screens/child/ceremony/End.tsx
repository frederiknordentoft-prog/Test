// The last screen of the end of a round: the buddy, and "Også i dag" — the smaller news as cards (a
// trophy, a stamp, a lantern lit, the hut). The heading and then every card are read aloud in turn,
// each card lit while it is named (review r1 P2-4: a child who cannot read hears all of it); a tap on
// a card reads that card again. Then the child chooses: "Næste" or "Til kortet", the same size,
// neither in focus, nothing starting by itself.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Animal, SpeechPart } from '../../../../engine/types'
import type { CeremonyCard } from '../../../../meta/ceremonyQueue'
import { Icon } from '../../../design/Icon'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Buddy } from '../round/Buddy'
import { lineText } from '../map/words'
import { cardSpeech, rewardIcon } from './describe'

/** What the end screen reads, in order: the heading, then each card (index) with its words. */
export function endReadout(cards: readonly CeremonyCard[]): { card: number | null; parts: SpeechPart[] }[] {
  if (cards.length === 0) return []
  return [{ card: null, parts: [{ clip: 's.reward.alsoToday' }] }, ...cards.map((c, i) => ({ card: i, parts: cardSpeech(c) }))]
}

export interface EndScreenProps {
  cards: readonly CeremonyCard[]
  buddy: Animal | null
  /** Set the moment the child leaves ("Næste", "Til kortet"): the reading stops before the next card. */
  halt?: { readonly current: boolean }
}

export function EndScreen({ cards, buddy, halt }: EndScreenProps) {
  const speech = useSpeech()
  const [speaking, setSpeaking] = useState<number | null>(null)
  // bumps when the reading is taken over (a tap on a card) or the screen goes
  const run = useRef(0)

  useEffect(() => {
    const me = ++run.current
    const steps = endReadout(cards)
    void (async () => {
      for (const step of steps) {
        if (run.current !== me || halt?.current) return
        setSpeaking(step.card)
        await speech.speak(step.parts).ended
      }
      if (run.current === me) setSpeaking(null)
    })()
    return () => {
      run.current++
    }
    // read once per screen
  }, [cards])

  const readCard = (i: number) => {
    run.current++
    setSpeaking(i)
    const me = run.current
    void speech.speak(cardSpeech(cards[i])).ended.then(() => {
      if (run.current === me) setSpeaking(null)
    })
  }

  return (
    <div className={cx('tv-cer-end', cards.length > 0 && 'has-cards')} data-cer-end={cards.length}>
      <div className="tv-cer-end__buddy">
        <Buddy animal={buddy} mood="happy" />
      </div>
      {cards.length > 0 && (
        <>
          <SpokenText as="h2" clip="s.reward.alsoToday" silent className="tv-cer-end__title" />
          <ul className="tv-alsotoday">
            {cards.map((card, i) => (
              <AlsoCard key={i} card={card} index={i} speaking={speaking === i} onRead={() => readCard(i)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function AlsoCard({ card, index, speaking, onRead }: { card: CeremonyCard; index: number; speaking: boolean; onRead(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const parts = cardSpeech(card)
  const text = lineText(parts, speech.text)
  return (
    <li style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className={cx('tv-alsocard tv-touch', speaking && 'is-speaking')}
        aria-label={text}
        onClick={(e) => {
          e.stopPropagation()
          onRead()
        }}
        data-also={card.reward.t}
        data-speaking={speaking ? '' : undefined}
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
