// The `ceremonies` route: the end of a round (SPEC §5.8). Learning first ("Det lærte du" with the
// stars and the count-up), then at most three full-screen ceremonies in the queue's order with the
// hatch always last, then "Også i dag". Each screen reads itself aloud and moves on after its
// planned time (CEREMONY_MS); a tap moves on sooner (never blocked for more than a second); the
// hatch, a new friend's name and a magic animal to pick wait for the child. "Næste" and "Til
// kortet" are the same size, neither has focus, nothing starts by itself. "Prøv den på" visits the
// wardrobe and comes back to the next screen. At the end the plan is dismissed and the map lights
// up the region whose fog just lifted.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { playSfx, type SfxName } from '../../../audio/sfx'
import type { ItemId, SpeechPart } from '../../../engine/types'
import type { CeremonyPlan } from '../../../meta/ceremonyQueue'
import type { Reward } from '../../../meta/rewards'
import { useMeta } from '../../../state/useMeta'
import { useProfile } from '../../../state/useProfile'
import { Button } from '../../design/Button'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { EndScreen } from './ceremony/End'
import { autoAdvanceMs, progressOf, screensOf, setProgress, type Screen } from './ceremony/flow'
import { HatchScreen } from './ceremony/Hatch'
import {
  GrowthScreen, LevelUpScreen, MedalScreen, SummaryScreen, ThingScreen, TrialScreen, levelSpeech, medalSpeech,
  summarySpeech, thingSpeech, trialSpeech,
} from './ceremony/Steps'
import { lastRound, mapAfterRound, nextAfterRound, playNext } from './play/flow'
import './ceremony/ceremony.css'

/** A screen's words may run this much past its planned time before it moves on anyway. */
const SPEECH_GRACE_MS = 1200

function speechOf(screen: Screen, all: readonly Reward[], cards: number): SpeechPart[] {
  if (screen.kind === 'summary') return summarySpeech(screen.steps)
  if (screen.kind === 'end') return cards > 0 ? [{ clip: 's.reward.alsoToday' }] : []
  const step = screen.step
  switch (step.kind) {
    case 'trial': return trialSpeech(step)
    case 'medal': return medalSpeech(step)
    case 'levelUp': return levelSpeech(step, all)
    case 'thing': return thingSpeech(step)
    default: return step.speech
  }
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

  const screens = useMemo(() => (plan ? screensOf(plan) : []), [plan])
  const [index, setIndex] = useState(() => (live ? Math.min(progressOf(live), screensOf(live).length - 1) : 0))
  const [signal, setSignal] = useState(0)
  const shownAt = useRef(performance.now())
  const all = useMemo(() => (plan ? [...plan.steps.flatMap((s) => s.rewards), ...plan.alsoToday.map((c) => c.reward)] : []), [plan])
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

  // each screen speaks, sounds, and moves on after its time (and its words, within a grace)
  useEffect(() => {
    if (!screen || leaving.current) return
    let alive = true
    const parts = speechOf(screen, all, plan?.alsoToday.length ?? 0)
    const handle = parts.length > 0 ? speech.speak(parts) : null
    const sound = soundOf(screen)
    if (sound) playSfx(sound)
    const wait = autoAdvanceMs(screen)
    if (wait === null) {
      return () => {
        alive = false
      }
    }
    let timeUp = false
    let spoken = handle === null
    const tryNext = () => {
      if (alive && timeUp && spoken) advance()
    }
    const t1 = window.setTimeout(() => {
      timeUp = true
      tryNext()
    }, wait)
    const t2 = window.setTimeout(() => {
      if (alive) advance()
    }, wait + SPEECH_GRACE_MS)
    void handle?.ended.then(() => {
      spoken = true
      tryNext()
    })
    return () => {
      alive = false
      window.clearTimeout(t1)
      window.clearTimeout(t2)
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
    if (leaving.current) return
    leaving.current = true
    const to = mapAfterRound(all, lastRound())
    useMeta.getState().dismissCeremony()
    useNav.getState().root(to, 'back')
  }

  const playOn = () => {
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
    useNav.getState().go({ id: 'wardrobe', ...(uid ? { uid } : {}) })
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
        <div key={index} className="tv-cer__screen" style={{ '--enter': screen.kind === 'end' ? 0 : 1 } as CSSProperties}>
          {screen.kind === 'summary' && <SummaryScreen steps={screen.steps} rewards={rewards} />}
          {screen.kind === 'step' && screen.step.kind === 'trial' && <TrialScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'medal' && <MedalScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'levelUp' && <LevelUpScreen step={screen.step} all={all} onTryOn={tryOn} />}
          {screen.kind === 'step' && screen.step.kind === 'growth' && <GrowthScreen step={screen.step} />}
          {screen.kind === 'step' && screen.step.kind === 'thing' && (
            <ThingScreen step={screen.step} nextSignal={signal} onAdvance={advance} onTryOn={tryOn} />
          )}
          {screen.kind === 'step' && screen.step.kind === 'hatch' && screen.step.rewards[0]?.t === 'eggReady' && (
            <HatchScreen reward={screen.step.rewards[0]} nextSignal={signal} onAdvance={advance} />
          )}
          {screen.kind === 'end' && <EndScreen cards={plan.alsoToday} buddy={buddy} />}
        </div>
      </div>
      <div className="tv-cer__actions">
        <Button clip="s.ui.next" icon={screen.kind === 'end' ? 'play' : 'next'} variant="primary" block onClick={onNext} data-cer-next="" />
        <Button clip="s.ui.toMap" icon="map" variant="secondary" block onClick={leave} data-cer-map="" />
      </div>
    </div>
  )
}
