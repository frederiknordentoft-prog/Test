// "Vis Pip hvad du kan" (SPEC §8) after the grade, for a child in 3. klasse once Stjernefjeldet is
// built (flow.ts placementOffered). Pip says in two short sentences that it is not a test and that
// the child can stop when it likes; two equal buttons start the ladder or skip it ("Spring over":
// the first round at once). The ladder (Ladder.tsx) ends with "Det er nok" or by itself; then what
// was shown is written and Pip says thank you, and "Spil" starts the first round on the map's next
// stone in the child's home world. Never a countdown, never an automatic start.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeakHandle } from '../../../../../audio/voice'
import type { ClipId, Grade, NodeId, SpeechPart } from '../../../../../engine/types'
import { useProfile } from '../../../../../state/useProfile'
import { Button } from '../../../../design/Button'
import { SpokenText } from '../../../../design/SpokenText'
import { useSpeech } from '../../../../design/speech'
import { cx } from '../../../../design/cx'
import { TopBar } from '../../../../shell/TopBar'
import { AnimalArt, lookOf } from '../art'
import { PipFigure } from '../Pip'
import { startOnStone } from './flow'
import { Ladder } from './Ladder'
import { usePlacement } from './store'
import './placement.css'

type Phase = 'intro' | 'ladder' | 'outro'

/** Pip's last words are heard before the round takes over the voice, but never hold it up for long. */
const GO_MAX_MS = 2500

const LINES: Readonly<Record<Exclude<Phase, 'ladder'>, ClipId[]>> = {
  intro: ['s.place.intro', 's.place.intro.stop'],
  outro: ['s.place.done'],
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const clips = (...ids: ClipId[]): SpeechPart[] => ids.map((clip) => ({ clip }))

export interface PlacementStepProps {
  grade: Grade
  /** ← on the intro: back to the grades (nothing is written before the ladder starts). */
  onBack(): void
}

export function PlacementStep({ grade, onBack }: PlacementStepProps) {
  const speech = useSpeech()
  const [phase, setPhase] = useState<Phase>('intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [talking, setTalking] = useState(false)
  const status = usePlacement((s) => s.status)
  const friend = useProfile((s) => s.profile?.animals.find((a) => a.uid === s.profile?.buddyUid) ?? null)
  const voice = useRef<SpeakHandle | null>(null)

  const say = useCallback(
    (parts: SpeechPart[]): SpeakHandle => {
      voice.current?.cancel()
      const h = speech.speak(parts)
      voice.current = h
      setTalking(true)
      void h.ended.then(() => {
        if (voice.current === h) setTalking(false)
      })
      return h
    },
    [speech],
  )

  const lines = error ? (['s.onb.error'] as ClipId[]) : phase === 'ladder' ? [] : LINES[phase]
  const lineKey = lines.join('|')
  useEffect(() => {
    if (lines.length > 0) say(clips(...lines))
  }, [lineKey])

  useEffect(
    () => () => {
      voice.current?.cancel()
      usePlacement.getState().reset()
    },
    [],
  )

  /** The end of the ladder: what was shown is written before "Spil" can be tapped. */
  const finish = useCallback(() => {
    setError(false)
    usePlacement
      .getState()
      .finish()
      .catch(() => setError(true))
  }, [])
  const toOutro = useCallback(() => {
    setPhase((p) => (p === 'ladder' ? 'outro' : p))
  }, [])
  useEffect(() => {
    if (phase !== 'outro') return
    setBusy(false)
    finish()
  }, [phase, finish])

  const start = async () => {
    if (busy) return
    setBusy(true)
    setError(false)
    try {
      const asking = await usePlacement.getState().begin(grade)
      setPhase(asking ? 'ladder' : 'outro')
    } catch {
      setBusy(false)
      setError(true)
    }
  }

  const go = async (stone: Promise<NodeId>) => {
    setBusy(true)
    setError(false)
    const h = say(clips('s.onb.go'))
    try {
      const [node] = await Promise.all([stone, Promise.race([h.ended, wait(GO_MAX_MS)])])
      startOnStone(node)
    } catch {
      setBusy(false)
      setError(true)
    }
  }
  const skip = () => {
    if (!busy) void go(usePlacement.getState().skip(grade))
  }
  const play = () => {
    if (busy) return
    const s = usePlacement.getState()
    if (s.status === 'over' && s.stone) void go(Promise.resolve(s.stone))
    else finish()
  }

  if (phase === 'ladder') return <Ladder onEnd={toOutro} />

  const text = lines.map((id) => speech.text(id)).join(' ')
  return (
    <div className="tv-first tv-onb tv-place" data-place={phase}>
      <TopBar
        leading={phase === 'intro' && !busy ? 'back' : null}
        onLeading={onBack}
        onReplay={() => {
          if (lines.length > 0) say(clips(...lines))
        }}
      />
      <div className="tv-first__body tv-first__body--talk">
        <div className="tv-say">
          <PipFigure talking={talking} className="tv-say__pip" />
          <div className={cx('tv-say__bubble', talking && 'is-talking')}>
            <SpokenText parts={clips(...lines)} text={text} className="tv-say__text" key={lineKey} />
          </div>
        </div>
        <div className="tv-onb__stage tv-place__stage">
          {friend && <AnimalArt look={lookOf(friend)} mood={phase === 'outro' ? 'cheer' : 'happy'} className="tv-onb__friend tv-place__friend" />}
        </div>
        <div className="tv-first__actions tv-place__actions">
          {phase === 'intro' ? (
            <>
              <Button clip="s.place.start" icon="play" block disabled={busy} onClick={() => void start()} data-place-start="" />
              <Button variant="secondary" clip="s.ui.skip" iconEnd="next" block disabled={busy} onClick={skip} data-place-skip="" />
            </>
          ) : (
            <Button clip="s.ui.play" icon="play" disabled={busy || (status !== 'over' && !error)} onClick={play} data-next="" />
          )}
        </div>
      </div>
    </div>
  )
}
