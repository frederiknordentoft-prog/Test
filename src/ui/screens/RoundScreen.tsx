import { useEffect, useMemo, useRef, useState } from 'react'
import { ISLANDS, LEVEL_BY_ID } from '../../content/islands'
import { useRound } from '../../state/useRound'
import { useProfile } from '../../state/useProfile'
import { Backdrop } from '../components/Backdrop'
import { ProgressDots } from '../components/ProgressDots'
import { SpeakButton } from '../components/SpeakButton'
import { PromptDisplay } from '../task/PromptDisplay'
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

export function RoundScreen({ onQuit }: { onQuit: () => void }) {
  const round = useRound()
  const settings = useProfile((s) => s.save.settings)
  const [pop, setPop] = useState<{ id: number; x: number; y: number; text: string } | null>(null)
  const [goldenLeft, setGoldenLeft] = useState(GOLDEN_SECONDS)
  const timers = useRef<number[]>([])

  const entry = LEVEL_BY_ID.get(round.levelId)
  const island = entry?.island ?? ISLANDS[0]
  const task = round.status === 'golden' ? round.goldenTask : round.current
  const isGolden = round.status === 'golden'

  const companion = useMemo(
    () => lookFor(island.species[0].id, 0, hueOf(island.palette.glow)),
    [island],
  )

  // read the question aloud on arrival
  useEffect(() => {
    if (!task || !settings.autoSpeak) return
    const t = window.setTimeout(() => speak(task.speech), 260)
    return () => window.clearTimeout(t)
  }, [task?.id, task?.speech, settings.autoSpeak, task])

  // the golden egg gets away on its own; missing it costs nothing
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

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout)
    stopSpeech()
  }, [])

  if (!task) return null
  const Input = INPUTS[task.kind]
  const accentHue = hueOf(island.palette.accent)
  const selfPrompting = task.kind === 'pair'

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
    } else {
      sfx.wrong()
      haptics.wrong()
      fx.gentle(at.x, at.y)
    }

    // a mistake lingers so the right answer is actually seen before moving on
    timers.current.push(window.setTimeout(() => round.next(), result.correct ? 780 : 1700))
  }

  const mood = round.lastResult ? (round.lastResult.correct ? 'cheer' : 'sad') : 'think'

  return (
    <div className={`app-height relative flex flex-col overflow-hidden ${settings.motion ? '' : 'calm'}`}>
      <Backdrop palette={island.palette} seed={island.id} dim={isGolden} />

      <header className="safe-top safe-x relative z-10 flex items-center gap-3 px-4 pt-3">
        <button type="button" onClick={onQuit} aria-label="Tilbage til kortet"
          className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-black/25 text-xl ring-1 ring-white/20">
          ✕
        </button>
        <div className="flex-1">
          <ProgressDots done={round.answered} total={round.total} accent={island.palette.accent} />
        </div>
        {round.streak >= 2 && (
          <div className="punch flex items-center gap-1 rounded-full bg-black/30 px-3 py-1.5 text-sm font-black ring-1 ring-white/20"
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
              <Egg hue={45} size={74} className="egg-wobble" />
              <div className="text-left">
                <p className="text-xl font-black text-amber-200">Guldægget!</p>
                <p className="text-sm opacity-80">Fang det med ét svar</p>
              </div>
            </div>
            <div className="mt-1 h-2 w-44 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-amber-300 transition-[width] duration-1000 ease-linear"
                style={{ width: `${(goldenLeft / GOLDEN_SECONDS) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="round-stage">
          {/* The pair task draws the sum as its own bubbles, so there is no separate
              prompt to show — and no empty half-screen where one would have been. */}
          <div className={selfPrompting ? 'shrink-0' : 'min-h-0 flex-1 gap-4 overflow-hidden'}>
            <div className="flex items-center gap-3">
              {!selfPrompting && <PromptDisplay task={task} accent={island.palette.accent} />}
              <SpeakButton text={task.speech} />
            </div>
          </div>

          <div className={selfPrompting ? 'min-h-0 flex-1 gap-4' : 'shrink-0 gap-4'}>
            <Input task={task} onAnswer={handleAnswer} locked={round.lastResult !== null}
              result={round.lastResult} accent={island.palette.accent} />

            {isGolden && !round.lastResult && (
              <button type="button" onClick={() => round.skipGolden()}
                className="mt-2 text-sm font-bold uppercase tracking-widest opacity-60">
                Spring over
              </button>
            )}
          </div>
        </div>
      </main>

      {/* the companion reacts to every answer */}
      <div className="safe-bottom pointer-events-none relative z-10 flex justify-center pb-1">
        <Creature look={companion} mood={mood} size={window.innerWidth >= 820 ? 124 : 92}
          key={`${mood}-${round.answered}-${round.mistakes}`} />
      </div>

      {pop && (
        <span key={pop.id} className="rise pointer-events-none fixed z-40 text-3xl font-black text-amber-200 drop-shadow"
          style={{ left: pop.x, top: pop.y, transform: 'translate(-50%, -50%)' }}
          onAnimationEnd={() => setPop(null)}>
          {pop.text}
        </span>
      )}
    </div>
  )
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
