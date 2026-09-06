import { create } from 'zustand'
import type { ComponentId } from '../content/model'
import {
  beatForComponent,
  beatForState,
  nextBeat,
  prevBeat,
  resolveBeat,
  type Stage,
} from '../lib/beats'
import { INITIAL_STATE, parseHash, serializeHash, statesEqual, type ModelState } from '../lib/hash'

export type ModelActions = {
  goToBeat: (beat: number) => void
  next: () => void
  prev: () => void
  setStage: (stage: Stage) => void
  toggleStage: () => void
  open: (id: ComponentId) => void
  close: () => void
  toggleOpen: (id: ComponentId) => void
  toggleBottleneck: (id: ComponentId) => void
  /** Erstatter hele tilstanden (bruges af hash-synkroniseringen). */
  hydrate: (state: ModelState) => void
}

export type ModelStore = ModelState & ModelActions

function fromBeat(beat: number, bottleneck: ComponentId | null): ModelState {
  const r = resolveBeat(beat)
  return { stage: r.stage, openComponent: r.openComponent, beat: r.beat, bottleneck }
}

/** Starttilstand: læses synkront fra URL-hashen, så et deep-link viser præcis den tilstand fra første render. */
function initialStateFromLocation(): ModelState {
  if (typeof window === 'undefined') return { ...INITIAL_STATE }
  return parseHash(window.location.hash)
}

export const useModelStore = create<ModelStore>()((set, get) => ({
  ...initialStateFromLocation(),

  goToBeat: (beat) => set((s) => fromBeat(beat, s.bottleneck)),
  next: () => set((s) => fromBeat(nextBeat(s.beat), s.bottleneck)),
  prev: () => set((s) => fromBeat(prevBeat(s.beat), s.bottleneck)),

  setStage: (stage) => set((s) => fromBeat(beatForState(stage, null), s.bottleneck)),
  toggleStage: () => {
    const s = get()
    s.setStage(s.stage === 'assembled' ? 'exploded' : 'assembled')
  },

  open: (id) => set((s) => fromBeat(beatForComponent(id), s.bottleneck)),
  close: () =>
    set((s) => {
      if (!s.openComponent) return s
      // Luk → tilbage til den eksploderede terning (beat 1).
      return fromBeat(beatForState('exploded', null), s.bottleneck)
    }),
  toggleOpen: (id) => {
    const s = get()
    if (s.openComponent === id) s.close()
    else s.open(id)
  },

  toggleBottleneck: (id) => set((s) => ({ bottleneck: s.bottleneck === id ? null : id })),

  hydrate: (state) => set({ ...state }),
}))

/** Ren udlæsning af den serialiserbare del af storen. */
export function selectModelState(s: ModelStore): ModelState {
  return { stage: s.stage, openComponent: s.openComponent, bottleneck: s.bottleneck, beat: s.beat }
}

/**
 * To-vejs synkronisering med URL-hashen.
 * - Store → hash: history.replaceState (ingen historikstøj).
 * - Hash → store: hashchange (brugeren retter URL'en / navigerer).
 * Returnerer en oprydningsfunktion.
 */
export function startHashSync(): () => void {
  const store = useModelStore

  // Skrivninger samles til én per frame (Safari afviser >100 replaceState på 30 s), og en
  // afvist skrivning må aldrig vælte store-lytteren — så falder vi tilbage til location.replace.
  let pending: number | null = null
  const writeHash = (state: ModelState) => {
    const hash = serializeHash(state)
    if (window.location.hash === hash) return
    const url = `${window.location.pathname}${window.location.search}${hash}`
    const flush = () => {
      pending = null
      const latest = serializeHash(selectModelState(store.getState()))
      if (window.location.hash === latest) return
      const latestUrl = `${window.location.pathname}${window.location.search}${latest}`
      try {
        window.history.replaceState(null, '', latestUrl)
      } catch {
        try {
          window.location.replace(latestUrl)
        } catch {
          /* ignorér — tilstanden lever videre i storen */
        }
      }
    }
    if (pending !== null) return
    if (typeof window.requestAnimationFrame === 'function') pending = window.requestAnimationFrame(flush)
    else {
      pending = 1
      flush()
    }
    void url
  }

  const applyFromLocation = () => {
    const parsed = parseHash(window.location.hash)
    if (!statesEqual(parsed, selectModelState(store.getState()))) store.getState().hydrate(parsed)
    // Et tomt eller ugyldigt hash skrives altid om til den kanoniske form (fx #beat=0).
    writeHash(selectModelState(store.getState()))
  }

  applyFromLocation()

  const unsubscribe = store.subscribe((s) => writeHash(selectModelState(s)))

  window.addEventListener('hashchange', applyFromLocation)
  return () => {
    unsubscribe()
    window.removeEventListener('hashchange', applyFromLocation)
  }
}
