// The round's intro (SPEC §5.4, §10.5): where the child is going and the buddy waving, read aloud
// while the round, the skill registry and the voice sprites load. After a reload the sound needs a
// tap first, so the intro then waits for "Spil videre"; a stone without tasks says so and offers the
// way back. ✕ is there from the first moment.
import { useEffect } from 'react'
import type { Animal, RegionId, SpeechPart } from '../../../../engine/types'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { ProgressStones } from '../../../design/ProgressStones'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { TopBar } from '../../../shell/TopBar'
import { Buddy } from '../round/Buddy'
import { targetInfo, toneStyle, type PlayTarget } from '../map/nodes'
import type { TrialState } from '../../../../engine/types'
import { TRIAL_PASS } from '../../../../content/curriculum'
import './play.css'

export type IntroState = 'loading' | 'tap' | 'closed'

export interface PlayIntroProps {
  target: PlayTarget
  hutRegion?: RegionId | null
  /** Coming back to a stored round. */
  resume: boolean
  state: IntroState
  buddy: Animal | null
  /** The trial's record, for its planks ("Bedst: 7 planker"). */
  trial?: TrialState | null
  onStart(): void
  onClose(): void
}

export function PlayIntro({ target, hutRegion, resume, state, buddy, trial, onStart, onClose }: PlayIntroProps) {
  const speech = useSpeech()
  const info = targetInfo(target, hutRegion)
  const slot = info.node?.slot
  const isTrial = slot === 'trial' || slot === 'finale'

  useEffect(() => {
    const parts: SpeechPart[] = [{ clip: info.title }]
    if (info.label) parts.push({ clip: info.label })
    parts.push({ clip: resume ? 's.play.resume' : 's.play.ready' })
    const h = speech.speak(parts)
    return () => h.cancel()
    // the intro is read once per screen
  }, [])

  useEffect(() => {
    if (state === 'closed') speech.speak([{ clip: 's.play.empty' }])
    else if (state === 'tap') speech.speak([{ clip: 's.play.tap' }])
  }, [state, speech])

  const size = slot === 'finale' ? TRIAL_PASS.finale.size : TRIAL_PASS.trial.size
  return (
    <div className="tv-play" style={toneStyle(info.tone)} data-play={state}>
      <TopBar leading="close" onLeading={onClose} />
      <div className="tv-play__stage">
        <div className="tv-play__card">
          <span className="tv-play__badge" aria-hidden>
            <Icon name={info.icon} size="58%" strokeWidth={2.2} />
          </span>
          <SpokenText as="h1" clip={info.title} className="tv-play__title" />
          {info.label && <SpokenText as="p" clip={info.label} className="tv-play__label" />}
          {isTrial && (
            <div className="tv-play__planks">
              <ProgressStones total={size} done={0} variant="planks" label={speech.text('s.map.about.trial')} />
              {trial && trial.attempts > 0 && trial.passedAt === null && (
                <SpokenText
                  className="tv-play__best"
                  parts={[{ clip: 's.reward.trial.best' }, { num: trial.best, form: 'mid' }, { clip: 's.reward.trial.planks' }]}
                  text={`${speech.text('s.reward.trial.best')}: ${trial.best} ${speech.text('s.reward.trial.planks')}`}
                />
              )}
            </div>
          )}
        </div>
        <div className="tv-play__buddy" aria-hidden>
          <Buddy animal={buddy} mood={state === 'closed' ? 'think' : 'wave'} />
        </div>
        <div className="tv-play__foot">
          {state === 'loading' && (
            <span className="tv-play__dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          )}
          {state === 'tap' && (
            <Button clip={resume ? 's.round.pause.resume' : 's.ui.play'} icon="play" size="lg" onClick={onStart} className="tv-play__go" data-play-start="" />
          )}
          {state === 'closed' && (
            <>
              <SpokenText as="p" clip="s.play.empty" className="tv-play__note" />
              <Button clip="s.ui.toMap" icon="map" variant="secondary" onClick={onClose} data-play-back="" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
