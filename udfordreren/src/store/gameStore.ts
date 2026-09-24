// Broen mellem sim-kernen og React: holder GameState-snapshottet, tempo, pauser, dialogkø og toasts.
// UI sender Actions via dispatch(); tidsloopet kalder stepUge().
import { create } from 'zustand';
import type { Action, GameState, NewGameOptions, Signal } from '../sim/types';
import { newGame } from '../sim/init';
import { applyAction, step, stepMut } from '../sim/step';
import { pauserFor, pauseTekst } from '../sim/signals';
import { AI_AKT_UGE, ugeIAar } from '../sim/time';
import { autoloesEvents } from '../sim/events';
import { gem, gemSetting, hentSetting } from './persistence';

export type Speed = 1 | 2 | 4;
export type ToastKind = 'info' | 'godt' | 'skidt';
export type Toast = { id: number; tekst: string; kind: ToastKind };
export type SignalDialog = { id: number; signal: Signal };

export type Settings = {
  lyd: boolean;
  musik: boolean;
  reduceretBevaegelse: boolean;
  tekstStoerrelse: 'normal' | 'stor' | 'ekstra';
  arkiv: boolean;
  /** Slå enkelte auto-pauser fra (nøgle = signal-kind) */
  autoPauseFra: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  lyd: true,
  musik: true,
  reduceretBevaegelse: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  tekstStoerrelse: 'normal',
  arkiv: true,
  autoPauseFra: [],
};

/** Signaler, der åbner en dialog (spillet står stille, indtil den lukkes) */
export const DIALOG_SIGNALER: Signal['k'][] = ['anmeldelse', 'galla', 'kvartal', 'event', 'messeVarsel', 'messe', 'nr1', 'top10', 'slut'];

/** Tidsur til render-interpolation (læses af canvas-loopet uden React-rerender) */
export const clock = { sidsteTickMs: 0, ugeMs: 3000, tick: 0 };

export function ugeVarighedMs(uge: number, speed: Speed): number {
  return (uge >= AI_AKT_UGE ? 6000 : 3000) / speed;
}

type GameStore = {
  game: GameState | null;
  speed: Speed;
  paused: boolean;
  /** Hvorfor spillet er pauset (vises i pause-banneret). Tom = manuel pause. */
  pauseGrunde: string[];
  dialoger: SignalDialog[];
  /** Signaler fra seneste step/handling — til point-bobler og juice */
  sidsteSignaler: Signal[];
  tick: number;
  toasts: Toast[];
  settings: Settings;
  /** Handlingslog (uge + handling) — til debug og replays */
  handlingslog: { uge: number; a: Action }[];

  nytSpil(opts: NewGameOptions): void;
  indlaes(state: GameState): void;
  lukSpil(): void;
  dispatch(a: Action): boolean;
  stepUge(): void;
  setSpeed(s: Speed): void;
  pause(grund?: string): void;
  fortsaet(): void;
  togglePause(): void;
  lukDialog(id: number): void;
  toast(tekst: string, kind?: ToastKind): void;
  fjernToast(id: number): void;
  opdaterSettings(p: Partial<Settings>): void;
  indlaesSettings(): Promise<void>;
  /** Debug: erstat state direkte (kun ?debug=1) */
  debugSaet(fn: (s: GameState) => void): void;
  /** Debug: hop frem til et år (auto-vælger events) */
  debugHopTilAar(aar: number): void;
};

let naesteId = 1;

function toastFor(sig: Signal): { tekst: string; kind: ToastKind } | null {
  switch (sig.k) {
    case 'fejl': return { tekst: sig.tekst, kind: 'skidt' };
    case 'advarsel': return { tekst: sig.tekst, kind: 'skidt' };
    case 'niveauOp': return { tekst: `Niveau ${sig.niveau}!`, kind: 'godt' };
    case 'kontraktFaerdig': return { tekst: `Opgave leveret: +${Math.round(sig.betaling * 1000)} t. kr., +${sig.indsigt} indsigt`, kind: 'godt' };
    case 'forskning': return { tekst: 'Forskning færdig', kind: 'godt' };
    case 'kontor': return { tekst: 'Nyt kontor!', kind: 'godt' };
    case 'runde': return { tekst: `Runde lukket: +${sig.kapital} mio. kr.`, kind: 'godt' };
    case 'licens': return { tekst: 'Licens godkendt!', kind: 'godt' };
    case 'klar': return { tekst: 'Et produkt er klar til lancering', kind: 'info' };
    default: return null;
  }
}

export const useGame = create<GameStore>((set, get) => {
  /** Fælles efterbehandling af signaler efter step/handling */
  function behandl(ny: GameState, fraTick: boolean): void {
    const st = get();
    const sig = ny.signaler;
    const dialoger = [...st.dialoger];
    const toasts = [...st.toasts];
    const grunde = new Set(st.pauseGrunde);
    let pause = st.paused;
    for (const s of sig) {
      if (DIALOG_SIGNALER.includes(s.k)) {
        if (s.k === 'messe' && s.stoerrelse === 0) continue;
        dialoger.push({ id: naesteId++, signal: s });
      }
      const t = toastFor(s);
      if (t) toasts.push({ id: naesteId++, ...t });
      if (fraTick && pauserFor(s) && !st.settings.autoPauseFra.includes(s.k)) {
        pause = true;
        const g = pauseTekst(s);
        if (g) grunde.add(g);
      }
    }
    if (dialoger.length > 0) pause = true;
    set({
      game: ny,
      sidsteSignaler: sig,
      dialoger,
      toasts: toasts.slice(-6),
      paused: pause,
      pauseGrunde: [...grunde],
      tick: fraTick ? st.tick + 1 : st.tick,
    });
    if (fraTick) {
      clock.tick += 1;
      clock.sidsteTickMs = performance.now();
      clock.ugeMs = ugeVarighedMs(ny.uge, st.speed);
      // Autosave hvert kvartal
      if (ugeIAar(ny.uge) % 13 === 0) void gem('auto', ny);
    }
  }

  return {
    game: null,
    speed: 1,
    paused: true,
    pauseGrunde: [],
    dialoger: [],
    sidsteSignaler: [],
    tick: 0,
    toasts: [],
    settings: DEFAULT_SETTINGS,
    handlingslog: [],

    nytSpil(opts) {
      const g = newGame(opts);
      set({ game: g, paused: false, pauseGrunde: [], dialoger: [], toasts: [], sidsteSignaler: [], tick: 0, handlingslog: [], speed: 1 });
      clock.sidsteTickMs = performance.now();
      clock.ugeMs = ugeVarighedMs(0, 1);
    },
    indlaes(state) {
      set({ game: { ...state, signaler: [] }, paused: true, pauseGrunde: ['Spil indlæst'], dialoger: [], toasts: [], sidsteSignaler: [], tick: 0, handlingslog: [] });
      // Genopret ventende events som dialoger (reload midt i et event)
      const d: SignalDialog[] = state.ventendeEvents.map((e) => ({ id: naesteId++, signal: { k: 'event', eventId: e.eventId } }));
      if (d.length) set({ dialoger: d });
    },
    lukSpil() {
      set({ game: null, paused: true, dialoger: [], toasts: [], pauseGrunde: [] });
    },
    dispatch(a) {
      const g = get().game;
      if (!g) return false;
      const ny = applyAction(g, a);
      const ok = !ny.signaler.some((x) => x.k === 'fejl');
      set({ handlingslog: [...get().handlingslog.slice(-499), { uge: g.uge, a }] });
      behandl(ny, false);
      return ok;
    },
    stepUge() {
      const st = get();
      const g = st.game;
      if (!g || g.slut) return;
      if (st.dialoger.length > 0) return;
      const ny = step(g, []);
      behandl(ny, true);
    },
    setSpeed(speed) {
      set({ speed });
      const g = get().game;
      if (g) clock.ugeMs = ugeVarighedMs(g.uge, speed);
    },
    pause(grund) {
      set({ paused: true, pauseGrunde: grund ? [...new Set([...get().pauseGrunde, grund])] : get().pauseGrunde });
    },
    fortsaet() {
      if (get().dialoger.length > 0) return;
      if (get().game?.slut) return;
      clock.sidsteTickMs = performance.now();
      set({ paused: false, pauseGrunde: [] });
    },
    togglePause() {
      if (get().paused) get().fortsaet();
      else get().pause();
    },
    lukDialog(id) {
      const rest = get().dialoger.filter((d) => d.id !== id);
      set({ dialoger: rest });
    },
    toast(tekst, kind = 'info') {
      set({ toasts: [...get().toasts, { id: naesteId++, tekst, kind }].slice(-6) });
    },
    fjernToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
    opdaterSettings(p) {
      const settings = { ...get().settings, ...p };
      set({ settings });
      void gemSetting('settings', settings);
    },
    async indlaesSettings() {
      const s = await hentSetting<Partial<Settings>>('settings');
      if (s) set({ settings: { ...DEFAULT_SETTINGS, ...s } });
    },
    debugSaet(fn) {
      const g = get().game;
      if (!g) return;
      const ny = structuredClone(g);
      fn(ny);
      set({ game: ny });
    },
    debugHopTilAar(aar) {
      let g = get().game;
      if (!g) return;
      const maal = (aar - 2012) * 52;
      g = structuredClone(g);
      while (g.uge < maal && !g.slut) {
        autoloesEvents(g);
        stepMut(g, []);
      }
      autoloesEvents(g);
      g.signaler = [];
      set({ game: g, dialoger: [], paused: true, pauseGrunde: [`Hoppet til ${aar}`] });
    },
  };
});
