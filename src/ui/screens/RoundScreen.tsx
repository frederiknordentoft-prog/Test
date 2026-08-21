import { useEffect, useMemo, useRef, useState } from 'react'
import { ISLANDS, ISLAND_BY_ID, LEVEL_BY_ID } from '../../content/islands'
import { useRound } from '../../state/useRound'
import { buddyOf, useProfile } from '../../state/useProfile'
import { GUESSABLE_CEILING } from '../../engine/mastery'
import { Backdrop } from '../components/Backdrop'
import { ProgressDots } from '../components/ProgressDots'
import { SpeakButton } from '../components/SpeakButton'
import { PromptDisplay } from '../task/PromptDisplay'
import { StrategyHint, explainStrategy } from '../task/StrategyHint'
import { ChoiceTask } from '../task/ChoiceTask'
import { KeypadTask } from '../task/KeypadTask'
import { CountTask } from '../task/CountTask'
import { PairTask } from '../task/PairTask'
import { NumberLineTask } from '../task/NumberLineTask'
import { Creature, Egg } from '../../art/Creature'
import { lookFor } from '../../art/creatureGen'
import { fx } from '../../fx/particles'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'
import { speak, stopSpeech } from '../../audio/speech'
import type { TaskProps } from '../task/types'

const INPUTS = {
  choice: ChoiceTask,
  keypad: KeypadTask,
  count: CountTask,
  pair: PairTask,
  numberline: NumberLineTask,
} satisfies Record<string, (props: TaskProps) => React.ReactElement>

const GOLDEN_SECONDS = 12
/** how long the child sees the plain right/wrong feedback before the method appears */
const HINT_DELAY = 900

export function RoundScreen({ onQuit }: { onQuit: () => void }) {
  const round = useRound()
  const save = useProfile((s) => s.save)
  const settings = save.settings
  const [pop, setPop] = useState<{ id: number; x: number; y: number; text: string } | null>(null)
  const [goldenLeft, setGoldenLeft] = useState(GOLDEN_SECONDS)
  const [teaching, setTeaching] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const timers = useRef<number[]>([])

  const entry = LEVEL_BY_ID.get(round.levelId)
  const island = entry?.island ?? ISLANDS[0]
  const task = round.status === 'golden' ? round.goldenTask : round.current
  const isGolden = round.status === 'golden'
  const accentHue = hueOf(island.palette.accent)

  // the talven the child actually owns comes along, not a stranger
  const buddy = buddyOf(save)
  const companion = useMemo(() => {
    if (buddy) {
      const home = ISLAND_BY_ID.get(buddy.islandId)
      return lookFor(buddy.speciesId, buddy.variant, hueOf(home?.palette.glow ?? island.palette.glow))
    }
    return lookFor(island.species[0].id, 0, hueOf(island.palette.glow))
  }, [buddy, island])

  // support stays on while a fact is new to this child and comes off once it sticks
  const scaffold = task ? (save.facts[task.factId]?.box ?? 0) < GUESSABLE_CEILING : false

  useEffect(() => {
    if (!task || !settings.autoSpeak) return
    const t = window.setTimeout(() => speak(task.speech), 260)
    return () => window.clearTimeout(t)
  }, [task?.id, task?.speech, settings.autoSpeak, task])

  // the golden egg simply gets away; missing it costs nothing
  useEffect(() => {
    if (!isGolden) {
      setGoldenLeft(GOLDEN_SECONDS)
      return
    }
    sfx.golden()
    setGoldenLeft(GOLDEN_SECONDS)
    const id = window.setInterval(() => {
      setGoldenLeft((left) => {
        if (left <= 1) {
          window.clearInterval(id)
          if (!useRound.getState().lastResult) useRound.getState().skipGolden()
          return 0
        }
        return left - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [isGolden])

  useEffect(() => {
    setTeaching(false)
  }, [task?.id])

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout)
    stopSpeech()
  }, [])

  if (!task) return null
  const Input = INPUTS[task.kind]

  const handleAnswer = (value: number, at: { x: number; y: number }) => {
    if (round.lastResult) return
    const result = round.submit(value)

    if (result.correct) {
      const streak = useRound.getState().streak
      sfx.correct(result.golden ? 6 : streak)
      haptics.correct()
      if (result.golden) fx.golden(at.x, at.y)
      else fx.correct(at.x, at.y, accentHue)
      setPop({ id: Date.now(), x: at.x, y: at.y, text: result.golden ? '⭐️ +3' : '+1' })
      timers.current.push(window.setTimeout(() => round.next(), 780))
      return
    }

    sfx.wrong()
    haptics.wrong()
    fx.gentle(at.x, at.y)
    // Show the plain feedback for a beat, then teach the method. The round does
    // not move on by itself from here — the child has to tap the right number.
    timers.current.push(
      window.setTimeout(() => {
        setTeaching(true)
        if (settings.autoSpeak) speak(explainStrategy(task, island.palette.accent).line)
      }, HINT_DELAY),
    )
  }

  const mood = round.lastResult ? (round.lastResult.correct ? 'cheer' : 'sad') : 'think'
  const escaping = 1 - goldenLeft / GOLDEN_SECONDS

  return (
    <div className={`app-height relative flex flex-col overflow-hidden ${settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={island.palette} seed={island.id} dim={isGolden} />

      <header className="safe-top safe-x relative z-10 flex items-center gap-3 px-4 pt-3">
        <button type="button" onClick={() => setConfirmQuit(true)} aria-label="Hold pause"
          className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-black/30 text-xl ring-1 ring-white/25">
          ✕
        </button>
        <div className="flex-1">
          <ProgressDots done={round.answered} total={round.total} accent={island.palette.accent} />
        </div>
        {round.streak >= 2 && (
          <div className="punch flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-sm font-black ring-1 ring-white/25"
            key={round.streak}>
            <span>🔥</span>
            <span className="tabular-nums">{round.streak}</span>
          </div>
        )}
      </header>

      <main className="safe-x relative z-10 flex min-h-0 flex-1 flex-col items-center justify-between gap-3 px-4 py-3">
        {isGolden && (
          <div className="pop-in flex flex-col items-center gap-1">
            <div className="flex items-center gap-3">
              {/* it is getting away, not running out of time — no draining bar */}
              <span className="block transition-transform duration-1000 ease-linear"
                style={{ transform: `translateX(${escaping * 96}px) translateY(${-escaping * 26}px) rotate(${escaping * 22}deg)`, opacity: 1 - escaping * 0.45 }}>
                <Egg hue={45} size={74} className="egg-wobble" />
              </span>
              <div className="text-left">
                <p className="text-xl font-black text-amber-200">Guldægget!</p>
                <p className="text-sm opacity-90">Fang det med ét svar</p>
              </div>
            </div>
          </div>
        )}

        <div className="round-stage">
          {/* The pair task draws the sum as its own bubbles, so there is no separate
              prompt to show — and no empty half-screen where one would have been. */}
          <div className={selfPromptingFor(task.kind) ? 'shrink-0' : 'min-h-0 flex-1 gap-4 overflow-hidden'}>
            <div className="flex items-center gap-3">
              {!selfPromptingFor(task.kind) && (
                <PromptDisplay task={task} accent={island.palette.accent} scaffold={scaffold} />
              )}
              <SpeakButton text={task.speech} />
            </div>
          </div>

          <div className={selfPromptingFor(task.kind) ? 'min-h-0 flex-1 gap-4' : 'shrink-0 gap-4'}>
            {teaching ? (
              <StrategyHint task={task} accent={island.palette.accent} onContinue={() => round.next()} />
            ) : (
              <>
                <Input task={task} onAnswer={handleAnswer} locked={round.lastResult !== null}
                  result={round.lastResult} accent={island.palette.accent} />
                {isGolden && !round.lastResult && (
                  <button type="button" onClick={() => round.skipGolden()}
                    className="mt-2 text-sm font-bold uppercase tracking-widest opacity-80">
                    Lad det flyve
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <div className="safe-bottom pointer-events-none relative z-10 flex justify-center pb-1">
        <Creature look={companion} mood={mood} golden={buddy?.golden}
          size={92} className="companion"
          key={`${mood}-${round.answered}-${round.mistakes}`} />
      </div>

      {pop && (
        <span key={pop.id} className="rise pointer-events-none fixed z-40 text-3xl font-black text-amber-200 drop-shadow"
          style={{ left: pop.x, top: pop.y, transform: 'translate(-50%, -50%)' }}
          onAnimationEnd={() => setPop(null)}>
          {pop.text}
        </span>
      )}

      {confirmQuit && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#1b1233]/80 p-6 backdrop-blur-sm">
          <div className="pop-in flex w-full max-w-sm flex-col items-center gap-5 rounded-[2rem] bg-[#241a44] p-6 ring-1 ring-white/20">
            <p className="text-center text-2xl font-black">Vil du holde pause?</p>
            <p className="text-center text-base opacity-85">
              Turen venter på dig på kortet, så du kan spille den færdig senere.
            </p>
            <div className="flex w-full flex-col gap-2">
              <button type="button"
                onClick={() => { setConfirmQuit(false); sfx.pop() }}
                className="tap-target h-16 w-full rounded-3xl bg-white/95 text-xl font-black text-[#1b1233] shadow-[0_6px_0_rgba(0,0,0,0.3)]">
                Spil videre
              </button>
              <button type="button"
                onClick={() => { setConfirmQuit(false); onQuit() }}
                className="tap-target h-14 w-full rounded-3xl bg-white/12 text-lg font-bold ring-1 ring-white/25">
                Hold pause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** The pair task is its own prompt — showing the sum above it would say it twice. */
function selfPromptingFor(kind: string): boolean {
  return kind === 'pair'
}

/** Pull a hue out of a hex colour so particles and creatures match the island. */
export function hueOf(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 45
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}
