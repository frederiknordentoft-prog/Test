// The `ceremonies` route: the end of a round (SPEC §5.8). Learning first ("Det lærte du" with the
// stars and the count-up), then at most three full-screen ceremonies in the queue's order with the
// hatch always last, then "Også i dag". Each screen reads itself aloud. The summary and a screen
// with "Prøv den på" stay until the child taps (review r1 P2-3); the others move on after their
// planned time (CEREMONY_MS), but never in the middle of their words. A tap moves on sooner (never
// blocked for more than a second); the hatch, a new friend's name and a magic animal to pick wait
// for the child. "Næste" and "Til kortet" are the same size, neither has focus, nothing starts by
// itself. "Prøv den på" visits the wardrobe and comes back to the next screen. At the end the plan
// is dismissed and the map lights up the region whose fog just lifted.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { playSfx, type SfxName } from '../../../audio/sfx'
import type { Animal, ItemId, SpeechPart } from '../../../engine/types'
import type { CeremonyPlan } from '../../../meta/ceremonyQueue'
import type { Reward } from '../../../meta/rewards'
import { useMeta } from '../../../state/useMeta'
import { useProfile } from '../../../state/useProfile'
import { useRound } from '../../../state/useRound'
import { Button } from '../../design/Button'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import type { LearnedContext } from './ceremony/describe'
import { EndScreen } from './ceremony/End'
import { autoAdvanceMs, progressOf, screensOf, setProgress, type Screen } from './ceremony/flow'
import { HatchScreen } from './ceremony/Hatch'
import {
  GrowthScreen, LevelUpScreen, MedalScreen, SummaryScreen, ThingScreen, TrialScreen, levelSpeech, medalSpeech,
  summarySpeech, thingSpeech, trialSpeech,
} from './ceremony/Steps'
import { lastRound, mapAfterRound, nextAfterRound, playNext } from './play/flow'
import './ceremony/ceremony.css'

/**
 * A screen never moves on in the middle of its words; this only guards against words that never
 * report their end.
 */
const SPEECH_SAFETY_MS = 15_000
/** A screen that waits for the child lets "Næste" pulse this long after its words. */
const NUDGE_MS = 3000

function speechOf(screen: Screen, ctx: LearnedContext, animals: readonly Animal[]): SpeechPart[] {
  if (screen.kind === 'summary') return summarySpeech(screen.steps, ctx)
  // the end screen reads its heading and cards itself, lighting each card as it is named
  if (screen.kind === 'end') return []
  const step = screen.step
  switch (step.kind) {
    case 'trial': return trialSpeech(step)
    case 'medal': return medalSpeech(step)
    case 'levelUp': return levelSpeech(step)
    case 'thing': return thingSpeech(step, animals)
    default: return step.speech
  }
}

/**
 * What "Det lærte du" knows about the round that just ended: its right first tries, a failed trial,
 * and the instance of a family the child last answered right (KeyState.recent, newest last).
 */
function learnedContext(all: readonly Reward[]): LearnedContext {
  const round = useRound.getState()
  const correct = round.status === 'finished' ? round.firstTries.filter((f) => f.correct).map(({ key, skill }) => ({ key, skill })) : []
  const keys = useProfile.getState().profile?.keys
  const instanceOf = (key: string) => {
    const recent = keys?.[key]?.recent ?? []
    return recent[recent.length - 1]
  }
  return { correct, failedTrial: all.some((r) => r.t === 'trial' && !r.passed), instanceOf }
}

function soundOf(screen: Screen): SfxName | null {
  if (screen.kind === 'summary') return screen.steps.some((s) => s.kind === 'stars') ? 'stjerne' : 'perle'
  if (screen.kind === 'end') return null
  const r = screen.step.rewards[0]
  switch (screen.step.kind) {
    case 'trial': return r?.t === 'trial' && r.passed ? 'taage' : r?.t === 'opened' ? 'laas-op' : 'glimmer'
    case 'medal': return 'medalje'
    case 'levelUp': return 'level-up'
    case 'growth': return 'vaekst'
    case 'thing':
      if (r?.t === 'item') return r.source.kind === 'chest' ? 'kiste' : 'glimmer'
      if (r?.t === 'trophy') return 'trofae'
      if (r?.t === 'goal') return 'stempel'
      return 'ven'
    case 'hatch': return 'varme'
    default: return null
  }
}

export default function CeremonyScreen(_props: ScreenProps<RouteOf<'ceremonies'>>) {
  const live = useMeta((s) => s.ceremony)
  const rewards = useMeta((s) => s.rewards)
  const profile = useProfile((s) => s.profile)
  const speech = useSpeech()
  // the plan stays on screen while the screen leaves, after it has been dismissed
  const [plan, setPlan] = useState<CeremonyPlan | null>(live)
  useEffect(() => {
    if (live) setPlan(live)
  }, [live])
  const leaving = useRef(false)
  // stops the reading of "Også i dag" the moment the child leaves (before the next card starts)
  const endHalt = useRef(false)

  const screens = useMemo(() => (plan ? screensOf(plan) : []), [plan])
  const [index, setIndex] = useState(() => (live ? Math.min(progressOf(live), screensOf(live).length - 1) : 0))
  const [signal, setSignal] = useState(0)
  const [nudge, setNudge] = useState(false)
  const shownAt = useRef(performance.now())
  const all = useMemo(() => (plan ? [...plan.steps.flatMap((s) => s.rewards), ...plan.alsoToday.map((c) => c.reward)] : []), [plan])
  const learned = useMemo(() => learnedContext(all), [all])
  const screen: Screen | undefined = screens[index]

  // nothing to celebrate (or it was dismissed elsewhere): straight to the map
  useEffect(() => {
    if (!live && !leaving.current && useNav.getState().route.id === 'ceremonies') useNav.getState().root({ id: 'map' }, 'back')
  }, [live])

  useEffect(() => {
    if (plan) setProgress(plan, index)
    shownAt.current = performance.now()
  }, [plan, index])

  const advance = useCallback(() => setIndex((i) => Math.min(i + 1, Math.max(0, screens.length - 1))), [screens.length])

  // Each screen speaks and sounds. One that waits for the child lets "Næste" pulse a while after
  // its words; the others move on once their time is up and their words are over.
  useEffect(() => {
    if (!screen || leaving.current) return
    let alive = true
    setNudge(false)
    const parts = speechOf(screen, learned, useProfile.getState().profile?.animals ?? [])
    const handle = parts.length > 0 ? speech.speak(parts) : null
    const sound = soundOf(screen)
    if (sound) playSfx(sound)
    const wait = autoAdvanceMs(screen)
    const timers: number[] = []
    if (wait === null) {
      if (screen.kind !== 'end') {
        const nudgeLater = () => timers.push(window.setTimeout(() => alive && setNudge(true), NUDGE_MS))
        if (handle) void handle.ended.then(() => alive && nudgeLater())
        else nudgeLater()
      }
      return () => {
        alive = false
        timers.forEach((t) => window.clearTimeout(t))
      }
    }
    let timeUp = false
    let spoken = handle === null
    const tryNext = () => {
      if (alive && timeUp && spoken) advance()
    }
    timers.push(window.setTimeout(() => {
      timeUp = true
      tryNext()
    }, wait))
    timers.push(window.setTimeout(() => {
      spoken = true
      tryNext()
    }, wait + SPEECH_SAFETY_MS))
    void handle?.ended.then(() => {
      spoken = true
      tryNext()
    })
    return () => {
      alive = false
      timers.forEach((t) => window.clearTimeout(t))
    }
    // one run per screen
  }, [index, screen])

  const tapStage = () => {
    if (!screen || screen.kind === 'end') return
    if (screen.kind === 'step' && screen.interactive) return
    if (performance.now() - shownAt.current < screen.blockMs) return
    advance()
  }

  const leave = () => {
    endHalt.current = true
    if (leaving.current) return
    leaving.current = true
    const to = mapAfterRound(all, lastRound())
    useMeta.getState().dismissCeremony()
    useNav.getState().root(to, 'back')
  }

  const playOn = () => {
    endHalt.current = true
    if (leaving.current) return
    leaving.current = true
    const next = nextAfterRound(useProfile.getState().profile, lastRound())
    useMeta.getState().dismissCeremony()
    playNext(next)
  }

  const onNext = () => {
    if (!screen) return
    if (screen.kind === 'end') playOn()
    else if (screen.kind === 'step' && screen.interactive) setSignal((s) => s + 1)
    else advance()
  }

  const tryOn = (item: ItemId) => {
    const uid = useProfile.getState().profile?.buddyUid ?? null
    if (uid) useMeta.getState().wear(uid, item)
    if (plan) setProgress(plan, index + 1)
    useNav.getState().go({ id: 'wardrobe', item, ...(uid ? { uid } : {}) })
  }

  if (!plan || !screen) return null
  const buddy = profile?.animals.find((a) => a.uid === profile.buddyUid) ?? null
  const dots = screens.length - 1
  return (
    <div className={cx('tv-cer', `is-${screen.kind === 'step' ? screen.step.kind : screen.kind}`)} data-ceremony={index}>
      <div className="tv-cer__top" aria-hidden>
        {dots > 1 &&
          Array.from({ length: dots }, (_, i) => <span key={i} className={cx('tv-cer__dot', i < index && 'is-done', i === index && 'is-on')} />)}
      </div>
      <div className="tv-cer__stage" onClick={tapStage} data-cer-stage="">
        <div key={index} className={cx('tv-cer__screen', `is-${screen.kind}`)} style={{ '--enter': screen.kind === 'end' ? 0 : 1 } as CSSProperties}>
          {screen.kind === 'summary' && <SummaryScreen steps={screen.steps} rewards={rewards} ctx={learned} />}
          {screen.kind === 'step' && screen.step.kind === 'trial' && <TrialScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'medal' && <MedalScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'levelUp' && <LevelUpScreen step={screen.step} onTryOn={tryOn} />}
          {screen.kind === 'step' && screen.step.kind === 'growth' && <GrowthScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'thing' && (
            <ThingScreen step={screen.step} nextSignal={signal} onAdvance={advance} onTryOn={tryOn} />
          )}
          {screen.kind === 'step' && screen.step.kind === 'hatch' && screen.step.rewards[0]?.t === 'eggReady' && (
            <HatchScreen reward={screen.step.rewards[0]} nextSignal={signal} onAdvance={advance} />
          )}
          {screen.kind === 'end' && <EndScreen cards={plan.alsoToday} buddy={buddy} halt={endHalt} />}
        </div>
      </div>
      <div className="tv-cer__actions">
        <Button
          clip="s.ui.next"
          icon={screen.kind === 'end' ? 'play' : 'next'}
          variant="primary"
          block
          onClick={onNext}
          className={cx(nudge && screen.kind !== 'end' && 'tv-pulse')}
          data-cer-next=""
          data-waiting={nudge ? '' : undefined}
        />
        <Button clip="s.ui.toMap" icon="map" variant="secondary" block onClick={leave} data-cer-map="" />
      </div>
    </div>
  )
}
