// The map's top bar (SPEC §5.7, §8): the buddy in the child's frame colour (a tap opens the
// wardrobe with it), the level and the title, three meters without numbers (egg, buddy heart, the
// pinned wish) and the perler — numbers are fine on the map, never during a round.
import type { CSSProperties } from 'react'
import { FRAME_HEX } from '../../../../content/catalog'
import type { Animal, FrameColor } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import { Meter } from '../../../design/Meter'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { AnimalPicture } from './art'
import type { Hud } from './model'

export function HudBuddy({ buddy, frame, hud, onBuddy }: { buddy: Animal | null; frame: FrameColor; hud: Hud; onBuddy(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const levelParts = [{ clip: 's.map.level' }, { num: hud.level, form: 'end' as const }, { clip: hud.title.clip }]
  return (
    <div className="tv-hud-me">
      <button
        type="button"
        className="tv-hud-me__buddy tv-touch"
        style={{ '--frame': FRAME_HEX[frame] } as CSSProperties}
        aria-label={speech.text('s.map.buddy')}
        onClick={() => {
          speech.speak([{ clip: 's.map.buddy' }])
          onBuddy()
        }}
        data-hud-buddy=""
        {...pressProps}
      >
        <AnimalPicture animal={buddy} size={52} crop="head" mood="happy" className="tv-hud-me__face" />
      </button>
      <SpokenText
        parts={levelParts}
        text={`${speech.text('s.map.level')} ${hud.level}\n${speech.text(hud.title.clip)}`}
        className="tv-hud-me__level"
      />
    </div>
  )
}

/**
 * "Skift spiller" (two or more children): the child's first letter in its frame colour; a tap asks
 * "Hvem skal spille?" and goes to the picker.
 */
export function HudSwitch({ initial, frame, onSwitch }: { initial: string; frame: FrameColor; onSwitch(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className="tv-hud-switch tv-touch"
      style={{ '--frame': FRAME_HEX[frame] } as CSSProperties}
      aria-label={speech.text('s.map.switch')}
      onClick={() => {
        speech.speak([{ clip: 's.profiles.title' }])
        onSwitch()
      }}
      data-switch-player=""
      {...pressProps}
    >
      <span className="tv-hud-switch__initial" aria-hidden>
        {initial}
      </span>
      <span className="tv-hud-switch__badge" aria-hidden>
        <Icon name="child" size={14} strokeWidth={2.6} />
      </span>
    </button>
  )
}

export function HudMeters({ hud }: { hud: Hud }) {
  return (
    <div className="tv-hud-meters">
      <Meter kind="egg" value={hud.egg} size="sm" className={cx(hud.eggReady && 'is-ready')} />
      {hud.heart !== null && <Meter kind="heart" value={hud.heart} size="sm" />}
      {hud.wish !== null && <Meter kind="wish" value={hud.wish} size="sm" />}
    </div>
  )
}

export function PerlerPill({ perler }: { perler: number }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const parts = [{ clip: 's.map.perler.have' }, { num: perler, form: 'mid' as const }, { clip: 's.map.perler.word' }]
  return (
    <button
      type="button"
      className="tv-perler tv-touch"
      aria-label={`${speech.text('s.map.perler.have')} ${perler} ${speech.text('s.map.perler.word')}`}
      onClick={() => speech.speak(parts)}
      data-perler={perler}
      {...pressProps}
    >
      <span className="tv-perler__icon" aria-hidden>
        <Icon name="pearl" size="100%" solid strokeWidth={2} />
      </span>
      <span className="tv-perler__n">{perler}</span>
    </button>
  )
}
