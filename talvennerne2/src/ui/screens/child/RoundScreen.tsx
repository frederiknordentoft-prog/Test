// The round (SPEC §3.4–3.5, §5.4, §5.7): one task after another on a stone path. It reads each
// task aloud (and starts the answer clock when the reading is over), plays the demo film and the
// kind's instruction the first times, celebrates right answers, walks a mistake through the
// strategy to the child tapping the right answer, offers the lightbulb after 10 s, lets the golden
// egg flutter in, pauses on ✕ (the round is stored) and asks for a tap after the app was away.
// The HUD is the stone path, the buddy and the combo juice — never a currency number.
//
// Usage:
//   <RoundScreen plan={planRound(...)} hooks={roundHooks({ golden, fastMs })} onExit={...} />
//   <RoundScreen snapshot={profile.round} hooks={...} onExit={...} />      // resume
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AnswerValue, Animal, Mood, RoundSnapshot, SpeechPart, Task, TaskKind } from '../../../engine/types'
import type { RoundHooks, RoundPlan } from '../../../state/useRound'
import { useRound } from '../../../state/useRound'
import { useProfile } from '../../../state/useProfile'
import { afterPaint } from '../../../app/idle'
import type { SkillRegistry } from '../../../engine/registry'
import { playSfx } from '../../../audio/sfx'
import { onResumeNeeded } from '../../../audio/unlock'
import { OOPS_CLIPS, PRAISE_CLIPS } from '../../../speech/clips/ui/round'
import { instructionClip } from '../../../speech/clips/ui/kinds'
import { Button, IconButton } from '../../design/Button'
import { ProgressStones } from '../../design/ProgressStones'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import type { SpeakHandle } from '../../../audio/voice'
import { cx } from '../../design/cx'
import { TopBar } from '../../shell/TopBar'
import { PromptScene } from '../../scenes/PromptScene'
import type { BlankSlot } from '../../scenes/PromptScene'
import { HintVisual } from '../../hint/HintVisual'
import { displayText } from '../../hint/displayText'
import { addsToPrompt, hintFor, scaffoldFor, supportFor } from '../../hint/hintFor'
import type { AnyVisual, ResolvedHint } from '../../hint/hintFor'
import { moduleFor, shownKind } from '../../task/registry'
import type { Draft, TaskViewProps, ViewMode } from '../../task/types'
import { confirmSpeech, formatMoney, formatNumber, splitTokens } from '../../task/answers'
import { OptionFace, UnitSuffix } from '../../task/faces'
import { keypadUnit } from '../../task/keypad/View'
import { Buddy } from './round/Buddy'
import { GoldenEgg } from './round/GoldenEgg'
import type { EggState } from './round/GoldenEgg'
import { ContinueOverlay, PauseOverlay, PerfectBanner } from './round/Overlays'
import { Teaching } from './round/Teaching'
import { burst, confetti } from './round/burst'
import { afterIntro, pickRotating, readout, taskIntro } from './round/intro'
import type { Onboarding, ReadStep, TaskIntro } from './round/intro'
import '../../task/task.css'
import '../../scenes/scenes.css'
import '../../hint/hint.css'
import './round/round.css'

export interface RoundScreenProps {
  /** A new round (planRound → useRound.start) … */
  plan?: RoundPlan | null
  /** … or a stored one to resume (profile.round). */
  snapshot?: RoundSnapshot | null
  /** roundHooks({ golden, fastMs, onFinish }) from useProfile. */
  hooks: RoundHooks
  /** Where the strategies come from (default: the registered skills). */
  skills?: SkillRegistry
  /** The buddy beside the task (default: the active profile's buddy, else the rabbit). */
  buddy?: Animal | null
  /** ✕ → "Til kortet" ('paused': stored) or the round is over ('finished': show the rewards). */
  onExit(outcome: 'paused' | 'finished'): void
}

/** How long a right answer is celebrated before the next task. */
const CORRECT_MS = 1000
/** The struck answer alone, before the strategy slides in. */
const WRONG_MS = 850
const IDLE_BULB_MS = 10_000
const END_MS = 2400
/** Modes that test rather than teach: no lightbulb (SPEC §5.4). */
const NO_HELP = new Set(['trial', 'finale', 'placement'])

type Beat = 'intro' | 'demo' | 'asking' | 'correct' | 'wrong' | 'teaching' | 'end'

interface Token {
  alive: boolean
  handle: SpeakHandle | null
}

/**
 * The prompt card is sized by the layout, never by its content (CSS size containment); its inner
 * size goes to --cw/--ch so the picture can scale to fit. (Container query units are not used:
 * Chromium resolves cqh to 0 when a flex item's height comes from min-height.) The observer's first
 * callback comes after layout and before paint, so the first frame already has the card's size;
 * nothing is measured in the commit (that would force a layout).
 */
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

// The round re-renders on every beat; what has not changed is not drawn again.
const PromptSceneMemo = memo(PromptScene)
const ProgressStonesMemo = memo(ProgressStones)
const TeachingMemo = memo(Teaching)
const views = new WeakMap<ComponentType<TaskViewProps>, ComponentType<TaskViewProps>>()
/** Each kind's view, memoised once. */
function memoView(View: ComponentType<TaskViewProps>): ComponentType<TaskViewProps> {
  let m = views.get(View)
  if (!m) {
    m = memo(View)
    views.set(View, m)
  }
  return m
}

/** What the prompt's answer blank shows for a value. */
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
    if (task.answerType === 'ore') return formatMoney(value)
    return formatNumber(value)
  }
  return <OptionFace task={task} value={value} size="sm" />
}

/** An order or a pattern handed in on a row of stones: each part in its own stone (review r1 P2-6). */
function blankFaces(task: Task, value: AnswerValue): ReactNode[] | null {
  if (task.prompt.scene !== 'row' || typeof value !== 'string' || !value.includes('|')) return null
  return splitTokens(value).map((v, i) => <OptionFace key={i} task={task} value={v} size="sm" />)
}

/**
 * Memoised: PlayScreen re-renders with every change to the profile (each answer), and its props for
 * the round stay the same. The round reads only what it draws from useRound, and the profile only
 * for the stand-in buddy.
 */
export const RoundScreen = memo(function RoundScreen({ plan, snapshot, hooks, skills, buddy, onExit }: RoundScreenProps) {
  const speech = useSpeech()
  const round = useRound(
    useShallow((s) => ({
      status: s.status,
      current: s.current,
      goldenTask: s.goldenTask,
      answeredGolden: s.status === 'answered' && !!s.lastResult?.golden,
      mode: s.plan?.mode,
      total: s.total,
      cleared: s.cleared,
      planks: s.planks,
      streak: s.streak,
    })),
  )
  const ownBuddy = useProfile((s) => (buddy !== undefined ? null : (s.profile?.animals.find((a) => a.uid === s.profile?.buddyUid) ?? null)))
  const golden = round.status === 'golden'
  const answeredGolden = round.answeredGolden
  const task: Task | null = golden || answeredGolden ? round.goldenTask : round.current
  const taskKey = task ? `${golden || answeredGolden ? 'g' : 't'}:${task.id}` : null
  const module = task ? moduleFor(task) : null
  const mode = round.mode ?? plan?.mode ?? snapshot?.mode ?? 'round'
  const animal = buddy !== undefined ? buddy : ownBuddy

  const [beat, setBeat] = useState<Beat>('intro')
  const [given, setGiven] = useState<AnswerValue | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [hint, setHint] = useState<ResolvedHint | null>(null)
  const [scaffold, setScaffold] = useState<AnyVisual | null>(null)
  /** What the lightbulb would show on top of the support already on screen (null: nothing more). */
  const [help, setHelp] = useState<AnyVisual | null>(null)
  const [bulbPulse, setBulbPulse] = useState(false)
  const [speakingOption, setSpeakingOption] = useState<number | null>(null)
  const [reading, setReading] = useState(false)
  const [replayCount, setReplayCount] = useState(0)
  const [bubble, setBubble] = useState<SpeechPart[] | null>(null)
  const [mood, setMood] = useState<Mood>('wave')
  const [dancing, setDancing] = useState(false)
  const [perfect, setPerfect] = useState(false)
  const [egg, setEgg] = useState<EggState | null>(null)
  const [demoKind, setDemoKind] = useState<TaskKind | null>(null)
  const [paused, setPaused] = useState(false)
  const [away, setAway] = useState(false)

  const timers = useRef(new Set<number>())
  const token = useRef<Token>({ alive: false, handle: null })
  const lastActivity = useRef(performance.now())
  const clockStarted = useRef(false)
  const bulbSounded = useRef(false)
  const pending = useRef<(() => void) | null>(null)
  const intros = useRef(new Map<string, TaskIntro>())
  const counted = useRef(new Set<string>())
  const prevKind = useRef<TaskKind | null>(null)
  const localSeen = useRef<Onboarding>({ demosSeen: {}, instructionsHeard: {} })
  const praiseAt = useRef(0)
  const answerRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useSizeVars()
  const [compact, setCompact] = useState(false)
  const exitRef = useRef(onExit)
  exitRef.current = onExit
  const beatRef = useRef(beat)
  beatRef.current = beat

  // ─── Timers and speech ──────────────────────────────────────────────────

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])
  const clearTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current.clear()
  }, [])
  const stopSpeech = useCallback(() => {
    token.current.alive = false
    token.current.handle?.cancel()
    speech.hush()
  }, [speech])
  const newToken = useCallback((): Token => {
    stopSpeech()
    const t: Token = { alive: true, handle: null }
    token.current = t
    return t
  }, [stopSpeech])

  /** Reads steps one after another; resolves with the time it took (0 when cut short). */
  const sayAll = useCallback(
    async (steps: ReadStep[], tok: Token, onStep?: (s: ReadStep, i: number) => void): Promise<number> => {
      const t0 = performance.now()
      for (let i = 0; i < steps.length; i++) {
        if (!tok.alive) return 0
        onStep?.(steps[i], i)
        const h = speech.speak(steps[i].parts)
        tok.handle = h
        await h.ended
      }
      return tok.alive ? performance.now() - t0 : 0
    },
    [speech],
  )

  // ─── Onboarding counters (demosSeen, instructionsHeard) ─────────────────

  const seen = (): Onboarding => {
    const p = useProfile.getState().profile
    return p ? { demosSeen: p.demosSeen, instructionsHeard: p.instructionsHeard } : localSeen.current
  }
  const recordIntro = (key: string, kind: TaskKind, intro: TaskIntro) => {
    if (counted.current.has(key) || (!intro.demo && !intro.instruction)) return
    counted.current.add(key)
    const store = useProfile.getState()
    if (store.profile) {
      store.update((doc) => ({ ...doc, ...afterIntro({ demosSeen: doc.demosSeen, instructionsHeard: doc.instructionsHeard }, kind, intro) }))
    } else {
      localSeen.current = afterIntro(localSeen.current, kind, intro)
    }
  }

  // ─── Starting ───────────────────────────────────────────────────────────

  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    if (snapshot) useRound.getState().resume(snapshot, hooks)
    else if (plan) useRound.getState().start(plan, hooks)
    // a round starts once per screen; the props are its seed
  }, [plan, snapshot, hooks])

  useEffect(
    () => () => {
      clearTimers()
      stopSpeech()
    },
    [clearTimers, stopSpeech],
  )

  // ─── Presenting a task ──────────────────────────────────────────────────

  const readTask = useCallback(
    async (t: Task, intro: TaskIntro, tok: Token) => {
      const steps = readout({ ...t, kind: shownKind(t) }, intro)
      const shortClip = instructionClip(shownKind(t), 'short')
      setBubble([{ clip: shortClip }])
      await sayAll(steps, tok, (st, i) => {
        setReading(i === 0 && !st.instruction && st.option === null)
        setSpeakingOption(st.option)
        if (st.instruction) setBubble(st.parts)
      })
      if (!tok.alive) return
      setReading(false)
      setSpeakingOption(null)
      setBubble([{ clip: shortClip }])
      useRound.getState().startClock()
      clockStarted.current = true
      lastActivity.current = performance.now()
      setBeat((b) => (b === 'intro' ? 'asking' : b))
    },
    [sayAll],
  )

  // A new task's state is set in the render that shows it ("state from the previous render"), so
  // the task is drawn once, not drawn and then reset by an effect. Refs, timers, speech and the
  // intro stay in the effect below (safe under StrictMode).
  // (Every presentation has its own key: a retry gets a new id, the golden egg its own prefix.)
  const presentKey = task && taskKey && module && (round.status === 'asking' || round.status === 'golden') ? taskKey : null
  const [presented, setPresented] = useState<string | null>(null)
  if (presentKey !== null && presentKey !== presented) {
    setPresented(presentKey)
    if (task && module) {
      // A new key shows support that leaves the answer to the child; the full strategy, which may
      // show it, stays behind the lightbulb and makes the answer an assisted one (review r1 P2-5).
      // A view that draws its own question (countTap, the number line …) has no card to show a
      // picture on, so it gets neither the support nor a lightbulb that would show nothing.
      const card = !module.ownsPrompt?.(task)
      const full = card && !golden ? scaffoldFor(task, skills) : null
      const support = full && task.scaffold ? supportFor(task, skills, full) : null
      setBeat('intro')
      setGiven(null)
      setDraft(null)
      setHint(null)
      setScaffold(support)
      // the lightbulb adds the full strategy only where it shows more than the support already does
      setHelp(full && support !== full && addsToPrompt(full, task) ? full : null)
      setBulbPulse(false)
      setSpeakingOption(null)
      setDemoKind(null)
      setMood('idle')
      setEgg(golden ? 'arrive' : null)
      setCompact(false)
      setBubble([{ clip: golden ? 's.round.golden.appear' : instructionClip(shownKind(task), 'short') }])
    }
  }

  useEffect(() => {
    if (!task || !taskKey || !module) return
    if (round.status !== 'asking' && round.status !== 'golden') return
    clearTimers()
    const tok = newToken()
    bulbSounded.current = false
    clockStarted.current = false
    lastActivity.current = performance.now()

    if (golden) {
      playSfx('guld')
      later(950, () => setEgg('wait'))
      // the voice starts once the egg is on screen
      afterPaint(() => {
        if (!tok.alive) return
        void sayAll([{ parts: [{ clip: 's.round.golden.appear' }], option: null }, { parts: task.speech, option: null }], tok).then(() => {
          if (!tok.alive) return
          useRound.getState().startClock()
          clockStarted.current = true
          setBeat((b) => (b === 'intro' ? 'asking' : b))
        })
      })
      return () => {
        tok.alive = false
      }
    }

    let intro = intros.current.get(taskKey)
    if (!intro) {
      intro = taskIntro({ ...task, kind: shownKind(task) }, prevKind.current, seen(), { hasDemo: true })
      intros.current.set(taskKey, intro)
      prevKind.current = shownKind(task)
    }
    const kind = shownKind(task)
    const shown = intro
    // the reading (or the demo) starts, and the profile counts the intro, once the task is on screen
    afterPaint(() => {
      recordIntro(taskKey, kind, shown)
      if (!tok.alive) return
      if (shown.demo) {
        setBeat('demo')
        setDemoKind(kind)
        const ins = shown.instruction ?? 'long'
        setBubble([{ clip: instructionClip(kind, ins) }])
        void sayAll([{ parts: [{ clip: instructionClip(kind, ins) }], option: null, instruction: true }], tok)
      } else {
        void readTask(task, shown, tok)
      }
    })
    return () => {
      tok.alive = false
    }
    // a task is presented once per key; everything else is read through refs
  }, [taskKey, round.status === 'asking' || round.status === 'golden'])

  const demoDone = useCallback(() => {
    setDemoKind(null)
    if (!task || !taskKey) return
    if (beatRef.current === 'demo') {
      setBeat('intro')
      const intro = intros.current.get(taskKey) ?? { demo: false, instruction: null }
      void readTask(task, { ...intro, demo: true }, newToken())
    } else if (clockStarted.current) {
      // "Vis mig" during the task: the film is not thinking time
      useRound.getState().startClock()
      lastActivity.current = performance.now()
    }
  }, [task, taskKey, readTask, newToken])

  // ─── The round is over ──────────────────────────────────────────────────

  useEffect(() => {
    if (round.status !== 'finished' || beatRef.current === 'end') return
    clearTimers()
    const tok = newToken()
    setBeat('end')
    setEgg(null)
    setMood('cheer')
    setBubble([{ clip: 's.round.done' }])
    playSfx('fanfare')
    void sayAll([{ parts: [{ clip: 's.round.done' }], option: null }], tok)
    later(END_MS, () => exitRef.current('finished'))
  }, [round.status, clearTimers, newToken, sayAll, later])

  // ─── Answers ────────────────────────────────────────────────────────────

  const onActivity = useCallback(() => {
    lastActivity.current = performance.now()
    setBulbPulse(false)
  }, [])

  const onDraft = useCallback((d: Draft | null) => {
    setDraft((prev) => (prev?.text === d?.text && prev?.unit === d?.unit ? prev : d))
  }, [])

  const answerPoint = (value: AnswerValue): { x: number; y: number } | null => {
    const host = answerRef.current
    if (!host) return null
    const el =
      host.querySelector(`[data-option="${CSS.escape(String(value))}"]`) ?? host.querySelector('[data-check]') ?? host.querySelector('[data-socket]') ?? host
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  const onSubmit = useCallback(
    (value: AnswerValue) => {
      if (beatRef.current !== 'intro' && beatRef.current !== 'asking') return
      const s = useRound.getState()
      if (s.status !== 'asking' && s.status !== 'golden') return
      const t = s.status === 'golden' ? s.goldenTask : s.current
      if (!t) return
      const wasGolden = s.status === 'golden'
      const tok = newToken()
      setReading(false)
      setSpeakingOption(null)
      const res = s.submit(value)
      setGiven(value)
      const at = answerPoint(value)

      if (wasGolden) {
        if (res.correct) {
          setBeat('correct')
          setEgg('caught')
          setMood('cheer')
          playSfx('guld')
          setBubble([{ clip: 's.round.golden.caught' }])
          afterPaint(() => {
            if (!tok.alive) return
            if (at) burst(at.x, at.y, { big: true })
            void sayAll([{ parts: [{ clip: 's.round.golden.caught' }], option: null }], tok)
          })
          pending.current = () => useRound.getState().next()
          later(1900, () => {
            pending.current = null
            useRound.getState().next()
          })
        } else {
          setBeat('wrong')
          setEgg('gone')
          setMood('oops')
          playSfx('whoosh')
          setBubble([{ clip: 's.round.golden.flew' }])
          afterPaint(() => {
            if (tok.alive) void sayAll([{ parts: [{ clip: 's.round.golden.flew' }], option: null }], tok)
          })
          pending.current = () => useRound.getState().next()
          later(2000, () => {
            pending.current = null
            useRound.getState().next()
          })
        }
        return
      }

      if (res.correct) {
        const streak = useRound.getState().streak
        setBeat('correct')
        setMood(streak >= 5 ? 'cheer' : 'happy')
        // the sound at once; the stars and the voice once the green card is on screen
        playSfx('rigtigt', { streak })
        let say = pickRotating(PRAISE_CLIPS, praiseAt.current++)
        let wait = CORRECT_MS
        if (streak === 5) {
          say = 's.round.combo.five'
          setDancing(true)
          later(2200, () => setDancing(false))
          wait = 1900
        }
        if (streak === 10) {
          say = 's.round.perfect'
          setPerfect(true)
          playSfx('fanfare')
          later(2600, () => setPerfect(false))
          wait = 2600
        }
        setBubble([{ clip: say }])
        afterPaint(() => {
          if (!tok.alive) return
          if (at) burst(at.x, at.y, { big: streak >= 3 })
          if (streak === 10) confetti()
          void sayAll([{ parts: [{ clip: say }], option: null }], tok)
        })
        pending.current = () => useRound.getState().next()
        later(wait, () => {
          pending.current = null
          useRound.getState().next()
        })
        return
      }

      // a mistake: the answer stays, struck through; then the strategy and the big confirm button
      setBeat('wrong')
      setMood('oops')
      playSfx('hmm')
      const teach = () => {
        const h = hintFor(t, value, skills)
        setHint(h)
        setBeat('teaching')
        setMood('think')
        const oops = pickRotating(OOPS_CLIPS, praiseAt.current++)
        setBubble([{ clip: oops }])
        const tk = newToken()
        afterPaint(() => {
          if (!tk.alive) return
          void sayAll(
            [
              { parts: [{ clip: oops }], option: null },
              { parts: h.speech, option: null },
              { parts: confirmSpeech(t), option: null },
            ],
            tk,
          )
        })
      }
      pending.current = teach
      later(WRONG_MS, () => {
        pending.current = null
        teach()
      })
    },
    // answerPoint reads the DOM at call time
    [newToken, sayAll, later, skills],
  )

  const onConfirm = useCallback(() => {
    if (beatRef.current !== 'teaching') return
    stopSpeech()
    playSfx('pop')
    useRound.getState().confirm()
  }, [stopSpeech])

  const skipEgg = useCallback(() => {
    if (useRound.getState().status !== 'golden' || (beatRef.current !== 'intro' && beatRef.current !== 'asking')) return
    newToken()
    setBeat('correct')
    setEgg('gone')
    playSfx('whoosh')
    later(700, () => useRound.getState().skipGolden())
  }, [newToken, later])

  // ─── Hør igen, Vis mig, the lightbulb ───────────────────────────────────

  const replay = useCallback(() => {
    if (!task) return
    const b = beatRef.current
    if (b === 'teaching' && hint) {
      void sayAll([{ parts: hint.speech, option: null }, { parts: confirmSpeech(task), option: null }], newToken())
      return
    }
    if (b !== 'intro' && b !== 'asking') return
    onActivity()
    setReplayCount((c) => c + 1)
    const tok = newToken()
    const steps = readout(task, { demo: false, instruction: null })
    void sayAll(steps, tok, (st, i) => {
      setReading(i === 0)
      setSpeakingOption(st.option)
    }).then((ms) => {
      if (!tok.alive) return
      setReading(false)
      setSpeakingOption(null)
      if (clockStarted.current) useRound.getState().replay(ms)
    })
  }, [task, hint, sayAll, newToken, onActivity])

  const showMe = useCallback(() => {
    if (!task || (beatRef.current !== 'intro' && beatRef.current !== 'asking')) return
    newToken()
    setReading(false)
    setSpeakingOption(null)
    setDemoKind(shownKind(task))
    void sayAll([{ parts: [{ clip: instructionClip(shownKind(task), 'long') }], option: null }], token.current)
  }, [task, newToken, sayAll])

  const helpAllowed = !!task && !golden && !NO_HELP.has(mode) && help !== null
  const openHelp = useCallback(() => {
    if (!task || !helpAllowed || !help) return
    // the answer after the lightbulb is assisted: perler and warmth, but the box stays (SPEC §3.5)
    useRound.getState().help()
    onActivity()
    playSfx('lyspaere')
    setScaffold(help)
    setHelp(null)
    void sayAll([{ parts: [{ clip: 's.round.help' }], option: null }], newToken())
  }, [task, helpAllowed, help, onActivity, sayAll, newToken])

  useEffect(() => {
    if (!helpAllowed) return
    const id = window.setInterval(() => {
      if (paused || away || demoKind) return
      if ((beatRef.current === 'asking' || beatRef.current === 'intro') && clockStarted.current && performance.now() - lastActivity.current >= IDLE_BULB_MS) {
        setBulbPulse(true)
        if (!bulbSounded.current) {
          bulbSounded.current = true
          playSfx('lyspaere')
        }
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [helpAllowed, paused, away, demoKind])

  // ─── Pause, leaving, coming back ────────────────────────────────────────

  const freeze = useCallback(() => {
    clearTimers()
    stopSpeech()
    setReading(false)
    setSpeakingOption(null)
  }, [clearTimers, stopSpeech])

  const thaw = useCallback(() => {
    const next = pending.current
    pending.current = null
    if (next) {
      next()
      return
    }
    const b = beatRef.current
    if (!task) return
    if (b === 'teaching' && hint) {
      void sayAll([{ parts: hint.speech, option: null }, { parts: confirmSpeech(task), option: null }], newToken())
      return
    }
    if (b === 'intro' || b === 'asking' || b === 'demo') {
      setDemoKind(null)
      setBeat('intro')
      void readTask(task, { demo: false, instruction: null }, newToken())
    }
  }, [task, hint, sayAll, newToken, readTask])

  const onClose = useCallback(() => {
    if (beatRef.current === 'end') return
    freeze()
    setPaused(true)
  }, [freeze])
  const onResume = useCallback(() => {
    setPaused(false)
    thaw()
  }, [thaw])
  const onLeave = useCallback(() => {
    freeze()
    setPaused(false)
    const r = useRound.getState().pause()
    exitRef.current(r === 'finished' ? 'finished' : 'paused')
  }, [freeze])

  useEffect(() => {
    let wasHidden = false
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHidden = true
        return
      }
      if (!wasHidden) return
      wasHidden = false
      const st = useRound.getState().status
      if (st === 'idle' || st === 'finished') return
      freeze()
      setAway(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    const off = onResumeNeeded((needed) => {
      const st = useRound.getState().status
      if (needed && st !== 'idle' && st !== 'finished') {
        freeze()
        setAway(true)
      }
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      off()
    }
  }, [freeze])
  const onContinue = useCallback(() => {
    setAway(false)
    if (!paused) thaw()
  }, [paused, thaw])

  // ─── Fitting: a task too tall for a short screen drops the companion strip ─

  useEffect(() => {
    if (compact || (beat !== 'intro' && beat !== 'asking' && beat !== 'teaching')) return
    const stage = stageRef.current
    const ask = askRef.current
    const answer = answerRef.current
    if (!stage || !ask || !answer) return
    // measured once the entrance animations have settled; only the boxes count, not what they
    // draw outside themselves (the buddy's ears, a button's lip, the egg's wings)
    let timer = 0
    const check = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (spill(ask) > 8 || spill(answer) > 8 || spill(stage) > 8) setCompact(true)
      }, 650)
    }
    check()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    ro?.observe(stage)
    return () => {
      window.clearTimeout(timer)
      ro?.disconnect()
    }
  }, [compact, taskKey, beat])

  // ─── Render ─────────────────────────────────────────────────────────────

  const viewMode: ViewMode =
    paused || away || demoKind || beat === 'end' ? 'idle' : beat === 'correct' ? 'correct' : beat === 'wrong' ? 'wrong' : beat === 'demo' ? 'idle' : 'input'

  const { entry, entries, slot } = useMemo(() => {
    let entry: ReactNode = undefined
    let entries: ReactNode[] | undefined
    let slot: BlankSlot = 'empty'
    if (task && (beat === 'correct' || beat === 'wrong' || beat === 'teaching') && given !== null) {
      const struck = (face: ReactNode, key?: number) => (beat === 'correct' ? face : <span key={key} className="tv-struck">{face}</span>)
      const parts = blankFaces(task, given)
      if (parts) entries = parts.map((face, i) => struck(face, i))
      else entry = struck(blankFace(task, given))
      slot = beat === 'correct' ? 'good' : 'oops'
    } else if (draft) {
      entry = (
        <>
          {draft.text}
          {draft.unit && <UnitSuffix unit={draft.unit} />}
        </>
      )
      slot = 'active'
    }
    return { entry, entries, slot }
  }, [task, beat, given, draft])

  const ownsPrompt = !!(task && module?.ownsPrompt?.(task))
  const trial = mode === 'trial' || mode === 'finale'
  const View = module ? memoView(module.View) : undefined
  const Demo = demoKind && task ? moduleFor({ ...task, kind: demoKind }).Demo : null
  const bubbleText = bubble ? displayText(bubble, speech.text) : ''
  const stones = (
    <ProgressStonesMemo
      total={Math.max(1, round.total || plan?.tasks.length || snapshot?.total || 1)}
      done={trial ? round.planks : round.cleared}
      glow={round.streak > 0}
      variant={trial ? 'planks' : 'stones'}
      label={speech.text('s.ui.stones')}
    />
  )

  const canShowMe = !!task && (beat === 'intro' || beat === 'asking') && !golden
  const showBulb = helpAllowed && (beat === 'intro' || beat === 'asking')
  const bulb = showBulb && (
    <IconButton icon="bulb" clip="s.ui.hint" variant="glass" pulse={bulbPulse} onClick={openHelp} className={cx('tv-round__bulb', bulbPulse && 'is-on')} data-bulb="" />
  )
  return (
    <div className={cx('tv-round', `is-${beat}`, golden && 'is-golden', compact && 'is-compact')} data-beat={beat} data-status={round.status}>
      <TopBar
        leading="close"
        onLeading={onClose}
        center={stones}
        onReplay={replay}
        extra={
          <>
            {compact && bulb}
            {compact && golden && (beat === 'intro' || beat === 'asking') && (
              <Button clip="s.ui.skip" variant="secondary" size="md" onClick={skipEgg} className="tv-round__skipword" data-skip-egg="" />
            )}
            <IconButton icon="hand" clip="s.ui.showMe" variant="glass" onClick={showMe} disabled={!canShowMe} data-showme="" />
          </>
        }
      />
      <div
        ref={stageRef}
        className={cx('tv-round__stage', ownsPrompt && 'is-owned')}
        data-kind={task?.kind}
        onPointerDown={onActivity}
      >
        <div ref={askRef} className="tv-round__ask">
          {task && !ownsPrompt && (
            <div ref={cardRef} key={taskKey} className={cx('tv-round__card', scaffold && 'has-scaffold')} data-prompt={task.prompt.scene}>
              {egg && <GoldenEgg state={egg} className="tv-round__egg" />}
              <PromptSceneMemo
                prompt={task.prompt}
                task={task}
                entry={entry}
                entries={entries}
                given={slot === 'good' || slot === 'oops' ? given : null}
                slot={slot}
                replay={replayCount}
                speaking={reading}
                onHear={replay}
                className="tv-round__scene"
              />
              {scaffold && (
                <div className="tv-round__scaffold" data-scaffold="">
                  <HintVisual visual={scaffold} size="sm" />
                </div>
              )}
            </div>
          )}
          <div className="tv-round__companion">
            <Buddy animal={animal} mood={mood} dancing={dancing} className="tv-round__buddy" />
            {bubbleText && (
              <div className="tv-round__bubble" key={bubbleText}>
                <SpokenText parts={bubble ?? []} text={bubbleText} className="tv-round__bubbletext" />
              </div>
            )}
            {!compact && bulb}
            {!compact && golden && (beat === 'intro' || beat === 'asking') && (
              <Button clip="s.ui.skip" variant="secondary" size="md" onClick={skipEgg} className="tv-round__skip" data-skip-egg="" />
            )}
          </div>
        </div>
        <div ref={answerRef} key={taskKey ?? 'none'} className="tv-round__answer">
          {egg && ownsPrompt && <GoldenEgg state={egg} className="tv-round__egg" />}
          {task && module && View && beat !== 'teaching' && (
            <View task={task} mode={viewMode} given={given} onSubmit={onSubmit} onActivity={onActivity} onDraft={onDraft} speaking={speakingOption} />
          )}
          {task && module && beat === 'teaching' && hint && given !== null && (
            <TeachingMemo task={task} module={module} given={given} hint={hint} onConfirm={onConfirm} />
          )}
        </div>
      </div>
      {Demo && <Demo onDone={demoDone} task={task} />}
      {perfect && <PerfectBanner />}
      {paused && <PauseOverlay onResume={onResume} onLeave={onLeave} />}
      {away && !paused && <ContinueOverlay onContinue={onContinue} />}
    </div>
  )
})

/** How far the in-flow children of `el` reach below its content box, in px. */
function spill(el: HTMLElement): number {
  const box = el.getBoundingClientRect()
  const limit = box.bottom - (parseFloat(getComputedStyle(el).paddingBottom) || 0)
  let bottom = limit
  for (const child of Array.from(el.children)) {
    const cs = getComputedStyle(child)
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') continue
    bottom = Math.max(bottom, child.getBoundingClientRect().bottom + (parseFloat(cs.marginBottom) || 0))
  }
  return bottom - limit
}

export default RoundScreen
