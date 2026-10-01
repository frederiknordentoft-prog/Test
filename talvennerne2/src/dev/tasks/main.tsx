// Task harness (dev server only: /tasks.html). Never part of the production build.
//
//   ?view=kind&ex=<example id>   play one kind: the chosen example first, then the kind's others
//   ?view=round                  a whole round with the engine's fixture skills: planRound + useRound
//                                + useProfile on a test profile in IndexedDB (resumes a stored round)
//   ?view=hints | ?view=scenes   galleries of every strategy picture and prompt scene
//
// Flags: shot=1 hides the dev bar · safe=se|x|ipad emulates iOS safe areas · calm=1 · demo=1 plays
// the demo films (counters reset), demo=0 marks them seen · golden=1 lets the golden egg come after
// three right · caption=1 shows what is spoken · e2e=1&voice=fast: silent, fast speech (tests).
// window.__drive answers the task on screen (src/dev/tasks/drive.ts).
import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../styles/index.css'
import './harness.css'
import type { AnswerValue, ProfileDoc, SpeechPart, Task } from '../../engine/types'
import type { NodeDef } from '../../content/curriculum'
import { FIXTURE_SKILLS } from '../../engine/testing/fixtureSkills'
import { makeRegistry } from '../../engine/registry'
import { goldenFor, planRound } from '../../engine/plan'
import { learningDay } from '../../engine/learningDay'
import { emptyKey } from '../../engine/mastery'
import { createProfile, listProfiles } from '../../data/repo/profiles'
import { useProfile, roundHooks } from '../../state/useProfile'
import { useRound } from '../../state/useRound'
import type { AnswerRecord, RoundHooks, RoundPlan, RoundResult } from '../../state/useRound'
import { speak as realSpeak } from '../../audio/voice'
import { clipText, hasClip } from '../../speech/catalog'
import { SpeechProvider } from '../../ui/design/speech'
import { setCalm } from '../../ui/design/motion'
import { AppShell } from '../../ui/shell/AppShell'
import { RoundScreen } from '../../ui/screens/child/RoundScreen'
import { StrategyHint } from '../../ui/hint/StrategyHint'
import { hintFor } from '../../ui/hint/hintFor'
import type { ResolvedHint } from '../../ui/hint/hintFor'
import { PromptScene } from '../../ui/scenes/PromptScene'
import '../../ui/task/task.css'
import '../../ui/scenes/scenes.css'
import '../../ui/hint/hint.css'
import '../../ui/screens/child/round/round.css'
import { DEV_TEXTS, EXAMPLE_KINDS, EXAMPLES, exampleById } from './examples'
import { drive } from './drive'

const params = new URLSearchParams(location.search)
const SHOT = params.has('shot')
const VIEW = params.get('view') ?? 'kind'
const FIXTURES = makeRegistry(FIXTURE_SKILLS)

declare global {
  interface Window {
    __drive?: typeof drive
    __harness?: { log: string[]; exits: string[]; answers: { given: AnswerValue; correct: boolean; mode: string }[]; errors: string[] }
  }
}
window.__drive = drive
const H: NonNullable<Window['__harness']> = { log: [], exits: [], answers: [], errors: [] }
window.__harness = H
window.addEventListener('error', (e) => H.errors.push(String(e.message)))

// ─── Safe areas and calm mode ───────────────────────────────────────────────

const SAFE: Record<string, { p: [number, number, number, number]; l: [number, number, number, number] }> = {
  se: { p: [20, 0, 0, 0], l: [0, 0, 0, 0] },
  x: { p: [59, 0, 34, 0], l: [0, 59, 21, 59] },
  ipad: { p: [24, 0, 20, 0], l: [24, 0, 20, 0] },
}
const safe = params.get('safe')
if (safe && SAFE[safe]) {
  const [t, r, b, l] = innerWidth > innerHeight ? SAFE[safe].l : SAFE[safe].p
  const s = document.documentElement.style
  s.setProperty('--safe-t', `${t}px`)
  s.setProperty('--safe-r', `${r}px`)
  s.setProperty('--safe-b', `${b}px`)
  s.setProperty('--safe-l', `${l}px`)
}
if (params.get('calm') === '1') setCalm(true)

// ─── Speech: texts for clips no catalogue owns yet ──────────────────────────

const devText = (id: string) => (hasClip(id) ? clipText(id) : (DEV_TEXTS[id] ?? id))
const devParts = (parts: SpeechPart[]): SpeechPart[] =>
  parts.map((p) => ('clip' in p && !hasClip(p.clip) && DEV_TEXTS[p.clip] ? { free: DEV_TEXTS[p.clip] } : p))

function describe(parts: SpeechPart[]): string {
  return parts.map((p) => ('clip' in p ? devText(p.clip) : 'num' in p ? String(p.num) : 'free' in p ? p.free : '…')).join(' ')
}

function HarnessSpeech({ children }: { children: ReactNode }) {
  const [said, setSaid] = useState('')
  const env = useMemo(
    () => ({
      text: devText,
      speak(parts: SpeechPart[], opts?: { interrupt?: boolean }) {
        const text = describe(parts)
        H.log.push(text)
        if (params.get('caption') === '1') setSaid(text)
        return realSpeak(devParts(parts), opts)
      },
    }),
    [],
  )
  return (
    <SpeechProvider env={env}>
      {children}
      {said && params.get('caption') === '1' && <div className="dv-caption">{said}</div>}
    </SpeechProvider>
  )
}

// ─── A test profile in IndexedDB ─────────────────────────────────────────────

/** The harness's own test child, found by name (no extra storage keys). */
async function testProfile(name: string, grade: 0 | 1 | 2 | 3): Promise<ProfileDoc> {
  const existing = (await listProfiles()).find((p) => p.name === name)
  const doc = existing ?? (await createProfile({ name, grade }))
  await useProfile.getState().loadProfile(doc.id)
  return useProfile.getState().profile ?? doc
}

/** demo=1 plays the films again; demo=0 marks every kind as seen and heard. */
function applyDemoFlag(): void {
  const flag = params.get('demo')
  if (flag === null) return
  useProfile.getState().update((doc) => {
    const all = Object.fromEntries(EXAMPLE_KINDS.map((k) => [k, flag === '1' ? 0 : 5]))
    return { ...doc, demosSeen: all, instructionsHeard: flag === '1' ? {} : all }
  })
}

// ─── Hooks that only keep things in memory (the kind view) ──────────────────

function memoryHooks(goldenFrom: Task | null): RoundHooks & { lastSnapshot: () => unknown } {
  let snap: unknown = null
  let goldenN = 0
  return {
    answer(rec: AnswerRecord) {
      H.answers.push({ given: rec.given, correct: rec.correct, mode: rec.mode })
    },
    snapshot(s) {
      snap = s
    },
    finish(r: RoundResult) {
      H.log.push(`finish:${r.cleared}/${r.total}`)
    },
    now: () => Date.now(),
    ...(goldenFrom ? { golden: () => ({ ...goldenFrom, id: `${goldenFrom.factId}#golden${goldenN++}`, scaffold: false }) } : {}),
    lastSnapshot: () => snap,
  }
}

// ─── Views ───────────────────────────────────────────────────────────────────

function KindView() {
  const exId = params.get('ex') ?? EXAMPLES.choice[0].id
  const ex = exampleById(exId) ?? EXAMPLES.choice[0]
  const [run, setRun] = useState(0)
  const [ready, setReady] = useState(false)
  const [exit, setExit] = useState<string | null>(null)
  useEffect(() => {
    void testProfile('Opgaver', 1).then(() => {
      applyDemoFlag()
      setReady(true)
    })
  }, [])
  const plan = useMemo<RoundPlan>(() => {
    const others = EXAMPLES[ex.task.kind].filter((e) => e.id !== ex.id).map((e) => e.task)
    const tasks = [ex.task, ...others].map((t, i) => ({ ...t, id: `${t.factId}#${run}.${i}` }))
    return { roundId: `dev:${ex.id}:${run}`, sessionId: 'dev', mode: 'practice', nodeId: 'practice', seed: 1, tasks }
  }, [ex, run])
  const hooks = useMemo(() => memoryHooks(params.get('golden') === '1' ? EXAMPLES.choice[0].task : null), [])
  const onExit = useCallback((outcome: 'paused' | 'finished') => {
    H.exits.push(outcome)
    setExit(outcome)
  }, [])
  if (!ready) return null
  return (
    <>
      <AppShell screenKey={`k${run}`} direction="none">
        {exit ? (
          <DevDone outcome={exit} onAgain={() => { setExit(null); setRun((r) => r + 1) }} />
        ) : (
          <RoundScreen key={run} plan={plan} hooks={hooks} skills={FIXTURES} onExit={onExit} />
        )}
      </AppShell>
      {!SHOT && <DevBar current={ex.id} />}
    </>
  )
}

/** The node the fixture round is played on: Plusengen's first node with all four fixture skills. */
const FIXTURE_NODE: NodeDef = {
  id: 'w0-plus10-l1', world: 'eng', region: 'w0-plus10', slot: 'l1',
  skills: [{ skill: 'addTo10' }, { skill: 'add100Carry' }, { skill: 'weightCompare' }, { skill: 'hear20' }],
  production: 'normal', houseKind: null, size: 10, review: 0,
}

/** Keys at mixed boxes, so the plan mixes cards, keypad, number line and multiSelect. */
function seedKeys(doc: ProfileDoc): ProfileDoc {
  if (Object.keys(doc.keys).length > 0) return doc
  const day = learningDay(Date.now())
  const k = (box: number) => ({ ...emptyKey(), box: box as 0, seen: 3, correct: 2, lastRound: 0, lastDay: day, boxDay: day })
  const keys: ProfileDoc['keys'] = {}
  ;[['add:3+4', 1], ['add:5+2', 2], ['add:6+3', 3], ['add:4+4', 0], ['add:7+2', 1], ['add:2+6', 3], ['add:8+1', 2]].forEach(([id, b]) => (keys[id as string] = k(b as number)))
  keys['add100Carry/toNextTen'] = k(3)
  keys['add100Carry/TOplusTOcarry'] = k(1)
  keys['wgt:0'] = k(3)
  keys['wgt:7'] = k(1)
  keys['hear:13'] = k(3)
  keys['hear:15'] = k(2)
  return { ...doc, keys, roundIndex: Math.max(doc.roundIndex, 3) }
}

function RoundView() {
  const [state, setState] = useState<{ plan: RoundPlan | null; snapshot: ProfileDoc['round']; key: number } | null>(null)
  const [exit, setExit] = useState<string | null>(null)
  const start = useCallback(async (resume: boolean) => {
    const doc0 = await testProfile('Tur', 0)
    useProfile.getState().update(seedKeys)
    applyDemoFlag()
    const doc = useProfile.getState().profile ?? doc0
    if (resume && doc.round) {
      setState((s) => ({ plan: null, snapshot: doc.round, key: (s?.key ?? 0) + 1 }))
      return
    }
    const ctx = { skills: FIXTURES, day: learningDay(Date.now()), sessionId: 'dev', audioVerified: true }
    const planned = planRound(FIXTURE_NODE, doc, ctx)
    setState((s) => ({ plan: planned, snapshot: null, key: (s?.key ?? 0) + 1 }))
  }, [])
  useEffect(() => {
    void start(params.get('resume') !== '0')
  }, [start])
  const hooks = useMemo(() => {
    if (!state) return null
    const plan = state.plan
    return roundHooks({
      golden: () => {
        const doc = useProfile.getState().profile
        const p = { roundId: plan?.roundId ?? state.snapshot?.roundId ?? 'r', nodeId: 'w0-plus10-l1' as const, tasks: plan?.tasks ?? [] }
        return doc ? goldenFor(p, doc, { skills: FIXTURES, audioVerified: true }) : null
      },
    })
  }, [state])
  const onExit = useCallback((outcome: 'paused' | 'finished') => {
    H.exits.push(outcome)
    setExit(outcome)
  }, [])
  if (!state || !hooks) return null
  return (
    <>
      <AppShell screenKey={`r${state.key}${exit ?? ''}`} direction="none">
        {exit ? (
          <DevDone
            outcome={exit}
            onAgain={() => { setExit(null); void start(false) }}
            onResume={exit === 'paused' ? () => { setExit(null); void start(true) } : undefined}
          />
        ) : (
          <RoundScreen key={state.key} plan={state.plan} snapshot={state.snapshot} hooks={hooks} skills={FIXTURES} onExit={onExit} />
        )}
      </AppShell>
      {!SHOT && <DevBar current="round" />}
    </>
  )
}

function DevDone({ outcome, onAgain, onResume }: { outcome: string; onAgain(): void; onResume?: () => void }) {
  const s = useRound.getState()
  return (
    <div className="dv-done" data-exit={outcome}>
      <h1>{outcome === 'finished' ? 'Turen er slut' : 'Pause — turen er gemt'}</h1>
      <p>
        {H.answers.filter((a) => a.correct).length} rigtige af {H.answers.length} svar · status {s.status}
      </p>
      <div className="dv-done__actions">
        {onResume && (
          <button type="button" onClick={onResume} data-dev-resume="">
            Genoptag
          </button>
        )}
        <button type="button" onClick={onAgain} data-dev-again="">
          Ny tur
        </button>
      </div>
    </div>
  )
}

function DevBar({ current }: { current: string }) {
  const go = (q: Record<string, string>) => {
    const p = new URLSearchParams(location.search)
    for (const [k, v] of Object.entries(q)) p.set(k, v)
    location.search = p.toString()
  }
  return (
    <div className="dv-bar">
      <select value={current} onChange={(e) => (e.target.value === 'round' ? go({ view: 'round' }) : go({ view: 'kind', ex: e.target.value }))}>
        {EXAMPLE_KINDS.map((k) => (
          <optgroup key={k} label={k}>
            {EXAMPLES[k].map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="round">Hel tur (fixture-skills)</option>
      </select>
      <button type="button" onClick={() => go({ demo: '1' })}>
        Demo
      </button>
      <button type="button" onClick={() => go({ view: 'hints' })}>
        Hints
      </button>
      <button type="button" onClick={() => go({ view: 'scenes' })}>
        Scener
      </button>
    </div>
  )
}

function HintsView() {
  const items: { title: string; hint: ResolvedHint }[] = []
  for (const kind of EXAMPLE_KINDS) {
    for (const ex of EXAMPLES[kind]) items.push({ title: `${ex.title} → ${String(ex.wrong)}`, hint: hintFor(ex.task, ex.wrong, FIXTURES) })
  }
  return (
    <div className="dv-gallery">
      {items.map((it, i) => (
        <section key={i} className="dv-tile">
          <h3>{it.title}</h3>
          <StrategyHint hint={it.hint} />
        </section>
      ))}
    </div>
  )
}

function ScenesView() {
  const seen = new Set<string>()
  const tasks = EXAMPLE_KINDS.flatMap((k) => EXAMPLES[k].map((e) => e.task)).filter((t) => {
    const key = t.prompt.scene + JSON.stringify(t.prompt).length
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return (
    <div className="dv-gallery">
      {tasks.map((t) => (
        <section key={t.id} className="dv-tile">
          <h3>{t.prompt.scene}</h3>
          <div className="dv-card">
            <PromptScene prompt={t.prompt} task={{ ...t, kind: 'choice' }} />
          </div>
        </section>
      ))}
    </div>
  )
}

function Harness() {
  if (VIEW === 'round') return <RoundView />
  if (VIEW === 'hints') return <HintsView />
  if (VIEW === 'scenes') return <ScenesView />
  return <KindView />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HarnessSpeech>
      <Harness />
    </HarnessSpeech>
  </StrictMode>,
)
