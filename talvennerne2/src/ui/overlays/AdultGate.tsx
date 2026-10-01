// The grown-ups' gate (SPEC §8 "Voksen-gate"): a sheet titled "For voksne" with a sum, 12–19 · 6–9,
// and its own keypad. The right answer closes the gate and runs what was asked for; a wrong one
// brings a new sum; ✕, the scrim and Escape close it without passing. Opening it says "Spørg en
// voksen." so a child who taps the grown-ups' button knows why a sum appeared.
//
// Usage on any screen (the profile picker, the map's grown-ups' button in the top bar):
//
//   import { useAdultGate } from '../../overlays/AdultGate'
//
//   const gate = useAdultGate()
//   <TopBar onAdult={() => gate.open(() => useNav.getState().go({ id: 'parent' }))} />
//   {gate.element}
//
// `gate.open(onPass)` is stable between renders, so it can go straight into props and effects.
// `onPass` runs once, after a right answer, as the gate closes. The sheet renders in a portal, so it
// does not matter where `gate.element` sits in the screen, only that it is rendered.
//
// Outside a component (a plain handler such as the map's map/adult.ts), one call does it all: the gate
// mounts itself above everything and removes itself again when it closes.
//
//   import { openAdultGate } from '../../../overlays/AdultGate'
//   export const openAdult = () => openAdultGate(() => useNav.getState().go({ id: 'parent' }))
//
// A screen that wants to hold the state itself renders the component directly:
//   <AdultGate open={open} onPass={() => …} onClose={() => setOpen(false)} />
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { playSfx } from '../../audio/sfx'
import { hashSeed, makeRng } from '../../engine/rng'
import type { Rng } from '../../engine/rng'
import { AnswerCard } from '../design/AnswerCard'
import { Equation } from '../design/Equation'
import { Icon } from '../design/Icon'
import { Sheet } from '../design/Sheet'
import { SpokenText } from '../design/SpokenText'
import { useSpeech } from '../design/speech'
import { cx } from '../design/cx'
import { gateKey, gateProblem, gateSolved } from './gate'
import type { GateProblem } from './gate'
import './overlays.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const

export interface AdultGateProps {
  open: boolean
  /** A right answer. The owner closes the gate (useAdultGate does both). */
  onPass: () => void
  /** ✕, the scrim or Escape. */
  onClose: () => void
  /** Fixed seed for the sums (tests, screenshots); otherwise every opening draws a fresh one. */
  seed?: number
}

export function AdultGate({ open, onPass, onClose, seed }: AdultGateProps) {
  const speech = useSpeech()
  const rng = useRef<Rng | null>(null)
  const draw = (previous: GateProblem | null): GateProblem => {
    // Not game logic: a sum a child cannot learn by heart, so the seed comes from the clock.
    rng.current ??= makeRng(seed ?? hashSeed(`gate:${Date.now()}:${performance.now()}`))
    return gateProblem(rng.current, previous)
  }
  const [problem, setProblem] = useState<GateProblem>(() => draw(null))
  const [entry, setEntry] = useState('')
  const [misses, setMisses] = useState(0)

  // A fresh sum and an empty entry every time the gate opens.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setProblem(draw(problem))
      setEntry('')
      setMisses(0)
    }
  }

  useEffect(() => {
    if (!open) return
    const said = speech.speak([{ clip: 's.gate.ask' }])
    return () => said.cancel()
  }, [open, speech])

  const press = (key: string) => {
    if (key !== 'ok') {
      const next = gateKey(entry, key)
      if (next !== entry) playSfx(key === 'del' ? 'fjern' : 'klik')
      setEntry(next)
      return
    }
    if (entry === '') return
    if (gateSolved(problem, entry)) {
      playSfx('rigtigt')
      onPass()
      return
    }
    playSfx('hmm')
    setMisses((m) => m + 1)
    setProblem(draw(problem))
    setEntry('')
  }

  // A hardware keyboard (iPad keyboards, the grown-up's laptop) types as well.
  const pressRef = useRef(press)
  useLayoutEffect(() => {
    pressRef.current = press
  })
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) pressRef.current(e.key)
      else if (e.key === 'Backspace') pressRef.current('del')
      else if (e.key === 'Enter') pressRef.current('ok')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="s.ui.adult" className="tv-gate-sheet">
      <div className="tv-gate" data-gate={`${problem.a}x${problem.b}`}>
        <div className="tv-gate__task">
          <SpokenText as="p" clip={misses > 0 ? 's.gate.again' : 's.gate.ask'} className="tv-gate__ask" />
          <div key={misses} className={cx('tv-gate__sum', misses > 0 && 'is-shaking')}>
            <Equation
              terms={[{ n: problem.a }, { op: '·' }, { n: problem.b }, { op: '=' }, { blank: true }]}
              entry={entry}
              slot="active"
              size="answer"
              nowrap
            />
          </div>
        </div>
        <div className="tv-gate__keys">
          {KEYS.map((k) =>
            k === 'del' ? (
              <AnswerCard key={k} label={speech.text('s.ui.delete')} onClick={() => press(k)} data-key={k}>
                <Icon name="backspace" size={36} />
              </AnswerCard>
            ) : k === 'ok' ? (
              <AnswerCard key={k} label={speech.text('s.ui.check')} state={entry ? 'target' : 'idle'} onClick={() => press(k)} data-key={k}>
                <Icon name="check" size={36} strokeWidth={3} />
              </AnswerCard>
            ) : (
              <AnswerCard key={k} onClick={() => press(k)} data-key={k}>
                {k}
              </AnswerCard>
            ),
          )}
        </div>
      </div>
    </Sheet>
  )
}

export interface AdultGateHandle {
  /** Ask for the sum; `onPass` runs after a right answer. Stable between renders. */
  open(onPass: () => void): void
  close(): void
  isOpen: boolean
  /** Render this somewhere in the screen (it portals itself above everything). */
  element: ReactNode
}

/** The gate as a hook: `gate.open(() => …)` and `{gate.element}`. See the top of this file. */
export function useAdultGate(opts: { seed?: number } = {}): AdultGateHandle {
  const [isOpen, setOpen] = useState(false)
  const pending = useRef<(() => void) | null>(null)
  const open = useCallback((onPass: () => void) => {
    pending.current = onPass
    setOpen(true)
  }, [])
  const close = useCallback(() => {
    pending.current = null
    setOpen(false)
  }, [])
  const pass = useCallback(() => {
    const run = pending.current
    pending.current = null
    setOpen(false)
    run?.()
  }, [])
  return { open, close, isOpen, element: <AdultGate open={isOpen} onPass={pass} onClose={close} seed={opts.seed} /> }
}

/** The gate as it slides away, before its own root is removed. */
const UNMOUNT_AFTER_MS = 450
let standalone = false

/**
 * The gate without a hook: renders itself in its own small root above the app. `onPass` runs after
 * a right answer; closing does nothing. A second call while the gate is open is ignored.
 */
export function openAdultGate(onPass: () => void): void {
  if (standalone || typeof document === 'undefined') return
  standalone = true
  const host = document.createElement('div')
  host.setAttribute('data-adult-gate', '')
  document.body.appendChild(host)
  const root = createRoot(host)
  let done = false
  const end = (passed: boolean) => {
    if (done) return
    done = true
    show(false)
    window.setTimeout(() => {
      root.unmount()
      host.remove()
      standalone = false
    }, UNMOUNT_AFTER_MS)
    if (passed) onPass()
  }
  const show = (open: boolean) => root.render(<AdultGate open={open} onPass={() => end(true)} onClose={() => end(false)} />)
  show(true)
}
