// The ladder's questions (SPEC §8), shown the way a round shows them: the prompt card, the task
// kind's own view, Pip beside it, "Hør igen" in the top bar. It is not a round: no stone path, no
// stars, no perler, no praise and no lightbulb. After every answer Pip says the same kind of
// friendly words ("Godt, næste!"); a miss first goes through the locked error flow (SPEC §3.5: the
// answer struck, the strategy, one big button with the right answer), which is never logged as an
// answer, and then only neutral words ("Tak! Her er den næste."). "Det er nok" ends it at any moment,
// and what was shown counts.
//
// Every question is its own TaskStage (keyed by the task), so its beats, timers and voice end with it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { afterPaint } from '../../../../../app/idle'
import { playSfx } from '../../../../../audio/sfx'
import { preloadSpeech } from '../../../../../audio/voice'
import type { SpeakHandle } from '../../../../../audio/voice'
import type { AnswerValue, ClipId, SpeechPart, Task, TaskKind } from '../../../../../engine/types'
import { NEXT_AFTER_MISS, NEXT_CLIPS } from '../../../../../speech/clips/ui/placement'
import { instructionClip } from '../../../../../speech/clips/ui/kinds'
import { useProfile } from '../../../../../state/useProfile'
import { Button } from '../../../../design/Button'
import { SpokenText } from '../../../../design/SpokenText'
import { useSpeech } from '../../../../design/speech'
import { cx } from '../../../../design/cx'
import { displayText } from '../../../../hint/displayText'
import { hintFor } from '../../../../hint/hintFor'
import type { ResolvedHint } from '../../../../hint/hintFor'
import { PromptScene } from '../../../../scenes/PromptScene'
import type { BlankSlot } from '../../../../scenes/PromptScene'
import { TopBar } from '../../../../shell/TopBar'
import { confirmSpeech, formatMoney, formatNumber } from '../../../../task/answers'
import { OptionFace, UnitSuffix } from '../../../../task/faces'
import { keypadUnit } from '../../../../task/keypad/View'
import { moduleFor, shownKind } from '../../../../task/registry'
import type { Draft, ViewMode } from '../../../../task/types'
import { Teaching } from '../../round/Teaching'
import { afterIntro, pickRotating, readout, taskIntro } from '../../round/intro'
import type { Onboarding, ReadStep, TaskIntro } from '../../round/intro'
import { PipFigure } from '../Pip'
import { usePlacement } from './store'
import '../../../../task/task.css'
import '../../../../scenes/scenes.css'
import '../../../../hint/hint.css'
import '../../round/round.css'

/** The words after an answer, before the next question slides in. */
const NEXT_MS = 1300
/** The struck answer alone, before the strategy (as in a round). */
const WRONG_MS = 850
/** After the last answer: a breath before Pip says thank you. */
const LAST_MS = 600
/** Before the strategy: always the round's gentlest words ("Lad os se på det sammen."), never "Næsten". */
const OOPS: ClipId = 's.round.oops.1'

type Beat = 'intro' | 'asking' | 'next' | 'wrong' | 'teaching'

interface Token {
  alive: boolean
  handle: SpeakHandle | null
}

export interface LadderProps {
  /** "Det er nok", or the last rung answered: the outro takes over (it writes what was shown). */
  onEnd(): void
}

export function Ladder({ onEnd }: LadderProps) {
  const speech = useSpeech()
  const task = usePlacement((s) => s.task)
  const [replay, setReplay] = useState(0)
  /** The kind of the question before (its instruction is read only when the kind changes). */
  const lastKind = useRef<TaskKind | null>(null)
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  const enough = useCallback(() => {
    speech.hush()
    endRef.current()
  }, [speech])

  const onNext = useCallback(() => {
    if (!usePlacement.getState().next()) endRef.current()
  }, [])
  const onLast = useCallback(() => endRef.current(), [])
  const onHear = useCallback(() => setReplay((n) => n + 1), [])
  /** The question's error flow is on: the root says so, as a round's does (round.css gives the strategy
   *  the whole width on a sideways phone, QA3c P2-4). */
  const [teaching, setTeaching] = useState(false)

  return (
    <div className={cx('tv-round tv-place tv-place--ladder', teaching && 'is-teaching')} data-place="ladder">
      <TopBar
        leading={<Button variant="secondary" size="md" icon="flag" clip="s.place.enough" silent onClick={enough} className="tv-place__enough" data-enough="" />}
        onReplay={onHear}
      />
      {task && <TaskStage key={task.id} task={task} prevKind={lastKind} replay={replay} onHear={onHear} onNext={onNext} onLast={onLast} onTeaching={setTeaching} />}
    </div>
  )
}

/** The prompt card is sized by the layout, and its inner size goes to --cw/--ch (as in RoundScreen). */
function useSizeVars() {
  const ro = useRef<ResizeObserver | null>(null)
  return useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    ro.current = new ResizeObserver(([e]) => {
      el.style.setProperty('--cw', `${Math.round(e.contentRect.width)}px`)
      el.style.setProperty('--ch', `${Math.round(e.contentRect.height)}px`)
    })
    ro.current.observe(el)
  }, [])
}

/** What the prompt's answer blank shows for a handed-in value. */
function blankFace(task: Task, value: AnswerValue): ReactNode {
  if (typeof value === 'number') {
    if (task.kind === 'keypad') {
      const unit = keypadUnit(task)
      return (
        <>
          {formatNumber(value / task.entryScale)}
          {unit && <UnitSuffix unit={unit} />}
        </>
      )
    }
    return task.answerType === 'ore' ? formatMoney(value) : formatNumber(value)
  }
  return <OptionFace task={task} value={value} size="sm" />
}

interface TaskStageProps {
  task: Task
  prevKind: { current: TaskKind | null }
  /** Bumped by "Hør igen" (the ear, or the loudspeaker of a heard number). */
  replay: number
  onHear(): void
  onNext(): void
  onLast(): void
  /** Whether the error flow is showing (before paint, so the root's layout changes with it). */
  onTeaching(on: boolean): void
}

function TaskStage({ task, prevKind, replay, onHear, onNext, onLast, onTeaching }: TaskStageProps) {
  const speech = useSpeech()
  const module = moduleFor(task)
  const kind = shownKind(task)
  const View = module.View
  const ownsPrompt = !!module.ownsPrompt?.(task)

  const [beat, setBeat] = useState<Beat>('intro')
  const [given, setGiven] = useState<AnswerValue | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [hint, setHint] = useState<ResolvedHint | null>(null)
  const [bubble, setBubble] = useState<SpeechPart[]>(() => [{ clip: instructionClip(kind, 'short') }])
  const [talking, setTalking] = useState(false)
  const [reading, setReading] = useState(false)
  const [speakingOption, setSpeakingOption] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)

  const beatRef = useRef(beat)
  beatRef.current = beat
  useLayoutEffect(() => {
    onTeaching(beat === 'teaching')
    return () => onTeaching(false)
  }, [beat, onTeaching])
  const hintRef = useRef(hint)
  hintRef.current = hint
  const timers = useRef(new Set<number>())
  const token = useRef<Token>({ alive: false, handle: null })
  /** The answer clock: from the end of the reading, without the time "Hør igen" takes. */
  const clock = useRef({ askedAt: Date.now(), replayMs: 0, replays: 0 })
  const cardRef = useSizeVars()

  // ── Timers and voice ──
  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])
  const stopSpeech = useCallback(() => {
    token.current.alive = false
    token.current.handle?.cancel()
  }, [])
  const newToken = useCallback((): Token => {
    stopSpeech()
    const t: Token = { alive: true, handle: null }
    token.current = t
    return t
  }, [stopSpeech])
  /** Reads the steps one after another; resolves with the time it took (0 when cut short). */
  const sayAll = useCallback(
    async (steps: ReadStep[], tok: Token, onStep?: (s: ReadStep, i: number) => void): Promise<number> => {
      const t0 = performance.now()
      setTalking(true)
      for (let i = 0; i < steps.length; i++) {
        if (!tok.alive) break
        onStep?.(steps[i], i)
        const h = speech.speak(steps[i].parts)
        tok.handle = h
        await h.ended
      }
      if (token.current === tok) setTalking(false)
      return tok.alive ? performance.now() - t0 : 0
    },
    [speech],
  )

  const readTask = useCallback(
    async (intro: TaskIntro, tok: Token) => {
      const short = instructionClip(kind, 'short')
      await sayAll(readout({ ...task, kind }, intro), tok, (st, i) => {
        setReading(i === 0 && !st.instruction && st.option === null)
        setSpeakingOption(st.option)
        if (st.instruction) setBubble(st.parts)
      })
      if (!tok.alive) return
      setReading(false)
      setSpeakingOption(null)
      setBubble([{ clip: short }])
      clock.current = { ...clock.current, askedAt: Date.now(), replayMs: 0 }
      setBeat((b) => (b === 'intro' ? 'asking' : b))
    },
    [kind, task, sayAll],
  )

  // ── The question appears and is read (the kind's instruction when the kind changes) ──
  useEffect(() => {
    const tok = newToken()
    const cancel = afterPaint(() => {
      if (!tok.alive) return
      const store = useProfile.getState()
      const seen: Onboarding = store.profile
        ? { demosSeen: store.profile.demosSeen, instructionsHeard: store.profile.instructionsHeard }
        : { demosSeen: {}, instructionsHeard: {} }
      const intro = taskIntro({ ...task, kind }, prevKind.current, seen, { hasDemo: false })
      prevKind.current = kind
      if (intro.instruction) store.update((doc) => ({ ...doc, ...afterIntro({ demosSeen: doc.demosSeen, instructionsHeard: doc.instructionsHeard }, kind, intro) }))
      void readTask(intro, tok)
    })
    const pending = timers.current
    return () => {
      cancel()
      tok.alive = false
      token.current.alive = false
      token.current.handle?.cancel()
      for (const id of pending) window.clearTimeout(id)
      pending.clear()
    }
    // one reading per question: the stage is keyed by the task
  }, [])

  // ── "Hør igen": the question again (or the strategy during the error flow) ──
  // Only taps made while this question is on screen: the count arrives already bumped by earlier ones.
  const heardAt = useRef(replay)
  useEffect(() => {
    if (replay === heardAt.current) return
    heardAt.current = replay
    const b = beatRef.current
    const h = hintRef.current
    if (b === 'teaching' && h) {
      void sayAll([{ parts: h.speech, option: null }, { parts: confirmSpeech(task), option: null }], newToken())
      return
    }
    if (b !== 'intro' && b !== 'asking') return
    const tok = newToken()
    setFlash((n) => n + 1)
    void sayAll(readout({ ...task, kind }, { demo: false, instruction: null }), tok, (st, i) => {
      setReading(i === 0)
      setSpeakingOption(st.option)
    }).then((ms) => {
      if (!tok.alive) return
      setReading(false)
      setSpeakingOption(null)
      clock.current = { ...clock.current, replayMs: clock.current.replayMs + ms, replays: clock.current.replays + 1 }
    })
  }, [replay])

  // ── Answers ──
  /**
   * Friendly words after every answer, and only neutral ones after a miss (never "Godt, næste!" for a
   * wrong answer); after the last one the outro says thank you.
   */
  const thanks = useCallback((missed: boolean) => {
    setBeat('next')
    const run = usePlacement.getState().session?.run
    if (!run || run.done) {
      newToken()
      later(LAST_MS, onLast)
      return
    }
    const line = missed ? NEXT_AFTER_MISS : pickRotating(NEXT_CLIPS, run.asked - 1)
    setBubble([{ clip: line }])
    const tok = newToken()
    afterPaint(() => {
      if (tok.alive) void sayAll([{ parts: [{ clip: line }], option: null }], tok)
    })
    later(NEXT_MS, onNext)
  }, [newToken, later, onLast, onNext, sayAll])

  const onSubmit = useCallback(
    (value: AnswerValue) => {
      if (beatRef.current !== 'intro' && beatRef.current !== 'asking') return
      const now = Date.now()
      const c = clock.current
      const correct = usePlacement.getState().submit(value, { ms: now - c.askedAt - c.replayMs, replays: c.replays, ts: now })
      if (correct === null) return
      stopSpeech()
      setReading(false)
      setSpeakingOption(null)
      setGiven(value)
      // the next question's words are fetched while these are said
      const upcoming = usePlacement.getState().upcoming()
      if (upcoming && upcoming.speech.length > 0) void preloadSpeech([upcoming.speech]).catch(() => undefined)
      if (correct) {
        thanks(false)
        return
      }
      // a miss: the locked error flow (SPEC §3.5), gently — no sound, no struck card of its own
      setBeat('wrong')
      later(WRONG_MS, () => {
        const h = hintFor(task, value)
        setHint(h)
        setBeat('teaching')
        setBubble([{ clip: OOPS }])
        const tok = newToken()
        afterPaint(() => {
          if (!tok.alive) return
          void sayAll(
            [
              { parts: [{ clip: OOPS }], option: null },
              { parts: h.speech, option: null },
              { parts: confirmSpeech(task), option: null },
            ],
            tok,
          )
        })
      })
    },
    [task, thanks, later, newToken, stopSpeech, sayAll],
  )

  /** The big button with the right answer: not logged, it only moves on. */
  const onConfirm = useCallback(() => {
    if (beatRef.current !== 'teaching') return
    stopSpeech()
    playSfx('pop')
    thanks(true)
  }, [stopSpeech, thanks])

  const onDraft = useCallback((d: Draft | null) => {
    setDraft((prev) => (prev?.text === d?.text && prev?.unit === d?.unit ? prev : d))
  }, [])
  const noop = useCallback(() => undefined, [])

  // ── Render ──
  const viewMode: ViewMode = beat === 'wrong' ? 'wrong' : beat === 'next' ? 'idle' : 'input'
  let entry: ReactNode = undefined
  let slot: BlankSlot = 'empty'
  if ((beat === 'wrong' || beat === 'teaching') && given !== null) {
    entry = <span className="tv-struck">{blankFace(task, given)}</span>
    slot = 'oops'
  } else if (draft) {
    entry = (
      <>
        {draft.text}
        {draft.unit && <UnitSuffix unit={draft.unit} />}
      </>
    )
    slot = 'active'
  } else if (beat === 'next' && given !== null) {
    // handed in: shown as it was typed, neither green nor struck
    entry = blankFace(task, given)
    slot = 'active'
  }
  const bubbleText = displayText(bubble, speech.text)

  return (
    <div className={cx('tv-round__stage', ownsPrompt && 'is-owned')} data-kind={task.kind} data-beat={beat}>
      <div className="tv-round__ask">
        {!ownsPrompt && (
          <div ref={cardRef} className="tv-round__card" data-prompt={task.prompt.scene}>
            <PromptScene
              prompt={task.prompt}
              task={task}
              entry={entry}
              given={slot === 'oops' ? given : null}
              slot={slot}
              replay={flash}
              speaking={reading}
              onHear={onHear}
              className="tv-round__scene"
            />
          </div>
        )}
        <div className="tv-round__companion">
          <PipFigure talking={talking} className="tv-round__buddy tv-place__pip" />
          {bubbleText && (
            <div className="tv-round__bubble" key={bubbleText}>
              <SpokenText parts={bubble} text={bubbleText} className="tv-round__bubbletext" />
            </div>
          )}
        </div>
      </div>
      <div className="tv-round__answer">
        {beat !== 'teaching' && (
          <View task={task} mode={viewMode} given={given} onSubmit={onSubmit} onActivity={noop} onDraft={onDraft} speaking={speakingOption} />
        )}
        {beat === 'teaching' && hint && given !== null && <Teaching task={task} module={module} given={given} hint={hint} onConfirm={onConfirm} />}
      </div>
    </div>
  )
}
