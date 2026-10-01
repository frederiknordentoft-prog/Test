// The sound check (SPEC §8 "Første opstart", step 2): Pip says "Tryk på katten" over two big animal
// cards. The words are only heard, never shown, so passing means the voice is heard. The cat passes
// (device.audioVerified = true). A wrong tap deals the cards again and Pip asks once more; a second
// wrong tap shows the "Tænd for lyden" card with a drawing of the silent switch and the volume
// buttons (audioVerified = false), from where the child can try again or go on.
// "Næste" leads to onboarding on the first start (no profiles yet) and back otherwise.
import { useEffect, useRef, useState } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { playSfx } from '../../../audio/sfx'
import type { SpeakHandle } from '../../../audio/voice'
import { hashSeed } from '../../../engine/rng'
import type { ClipId, SpeciesId } from '../../../engine/types'
import { useSession } from '../../../state/useSession'
import { AnswerCard } from '../../design/AnswerCard'
import { Button } from '../../design/Button'
import { Card } from '../../design/Card'
import { Icon } from '../../design/Icon'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { TopBar } from '../../shell/TopBar'
import { AnimalArt, preloadSpecies } from './onboarding/art'
import { PipFigure } from './onboarding/Pip'
import { SilentSwitchArt } from './onboarding/SilentSwitchArt'
import { SOUND_CHECK_OTHERS, SOUND_CHECK_TARGET, retrySoundCheck, startSoundCheck, tapCard, verdict } from './onboarding/soundCheck'
import type { SoundCheckState } from './onboarding/soundCheck'
import './onboarding/first-start.css'

/** How long a wrong card shows before the cards are dealt again. */
const WRONG_MS = 700

preloadSpecies([SOUND_CHECK_TARGET, ...SOUND_CHECK_OTHERS])

export default function SoundCheckScreen(_: ScreenProps<RouteOf<'soundCheck'>>) {
  const speech = useSpeech()
  const canBack = useNav((s) => s.stack.length > 0)
  const [check, setCheck] = useState<SoundCheckState>(() => startSoundCheck(hashSeed(`sound:${Date.now()}`)))
  const [flash, setFlash] = useState<SpeciesId | null>(null)
  const [talking, setTalking] = useState(false)
  const voice = useRef<SpeakHandle | null>(null)
  const timer = useRef(0)

  const say = (clips: ClipId[]) => {
    voice.current?.cancel()
    const h = speech.speak(clips.map((clip) => ({ clip })))
    voice.current = h
    setTalking(true)
    void h.ended.then(() => {
      if (voice.current === h) setTalking(false)
    })
  }

  const prompt = (): ClipId[] =>
    check.phase === 'passed' ? ['s.sound.good'] : check.phase === 'failed' ? ['s.sound.off.title'] : check.wrong > 0 ? ['s.sound.listen', 's.sound.tapCat'] : ['s.sound.tapCat']

  // Pip speaks on every new deal and when the check ends; the result is stored on the device.
  useEffect(() => {
    say(prompt())
    const v = verdict(check)
    if (v !== null) useSession.getState().setAudioVerified(v)
    // the deal and the phase are what changes what Pip says
  }, [check.deal, check.phase])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      voice.current?.cancel()
    },
    [],
  )

  const tap = (species: SpeciesId) => {
    if (check.phase !== 'listen' || flash) return
    const next = tapCard(check, species)
    if (next.phase === 'passed') {
      playSfx('rigtigt')
      setCheck(next)
      return
    }
    playSfx('hmm')
    setFlash(species)
    timer.current = window.setTimeout(() => {
      setFlash(null)
      setCheck(next)
    }, WRONG_MS)
  }

  const next = () => {
    const nav = useNav.getState()
    if (useSession.getState().profiles.length === 0) nav.replace({ id: 'onboarding' })
    else nav.back()
  }

  const failed = check.phase === 'failed'
  const passed = check.phase === 'passed'
  return (
    <div className="tv-first tv-sound" data-phase={check.phase}>
      <TopBar leading={canBack ? 'back' : null} onLeading={() => useNav.getState().back()} onReplay={() => say(prompt())} />
      <div className="tv-first__body tv-first__body--talk">
        <div className="tv-say">
          <PipFigure talking={talking} className="tv-say__pip" />
          <div className={cx('tv-say__bubble', talking && 'is-talking')}>
            {passed ? (
              <SpokenText clip="s.sound.good" className="tv-say__text" />
            ) : (
              <span className="tv-sound__waves" role="img" aria-label={speech.text(failed ? 's.ui.soundOff' : 's.ui.replay')}>
                <Icon name={failed ? 'soundOff' : 'soundOn'} size={44} />
              </span>
            )}
          </div>
        </div>

        {failed ? (
          <Card className="tv-sound__off">
            <SilentSwitchArt className="tv-sound__switch" />
            <SpokenText as="h2" clip="s.sound.off.title" className="tv-sound__title" />
            <SpokenText as="p" clip="s.sound.off.body" className="tv-sound__body" />
          </Card>
        ) : (
          <div className="tv-sound__cards">
            {check.cards.map((species) => (
              <AnswerCard
                key={`${check.deal}:${species}`}
                size="lg"
                className="tv-sound__card"
                state={flash === species ? 'wrong' : passed ? (species === SOUND_CHECK_TARGET ? 'correct' : 'dim') : 'idle'}
                label={speech.text(`name.species.${species}`)}
                onClick={() => tap(species)}
                data-species={species}
              >
                <AnimalArt
                  look={{ species, stage: 2 }}
                  mood={passed ? (species === SOUND_CHECK_TARGET ? 'cheer' : 'happy') : 'idle'}
                  className="tv-sound__animal"
                />
              </AnswerCard>
            ))}
          </div>
        )}

        <div className="tv-first__actions">
          {failed && <Button variant="secondary" clip="s.sound.retry" icon="retry" onClick={() => setCheck(retrySoundCheck(check))} />}
          {(passed || failed) && <Button clip="s.ui.next" iconEnd="next" onClick={next} data-next="" />}
        </div>
      </div>
    </div>
  )
}
