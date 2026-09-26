// Broen mellem sim-kernen og React: holder GameState-snapshottet, tempo, pauser, dialogkø og toasts.
// UI sender Actions via dispatch(); tidsloopet kalder stepUge().
import { create } from 'zustand';
import type { Action, GameState, NewGameOptions, Signal } from '../sim/types';
import { nytSpil as lavNytSpil } from '../sim/newgameplus';
import { applyAction, step, stepMut } from '../sim/step';
import { DIALOG_SIGNALER, aabnerDialog, pauserFor, pauseTekst, reaktionSomDialog } from '../sim/signals';
import { AI_AKT_UGE, aarFor, datoTekst, ugeIAar } from '../sim/time';
import { MARKETS } from '../data/markets';
import { eventChoice } from '../sim/events';
import { EVENT_BY_ID } from '../data/events';
import { spillerKunderTotal } from '../sim/customers';
import { gem, gemSetting, hentSetting } from './persistence';
import { samlSignaler } from '../ui/lib/dialogSamling';

export type Speed = 1 | 2 | 4;
export type ToastKind = 'info' | 'godt' | 'skidt';
/**
 * antal: samme tekst kom flere gange (vises som ×N i stedet for en stak ens toasts).
 * handling: svar på noget, spilleren lige gjorde (vises også oven på en signal-dialog); ugens nyheder venter, til dialogerne er lukket.
 */
export type Toast = { id: number; tekst: string; kind: ToastKind; antal?: number; handling?: boolean; uge?: number };
/** gruppe: flere signaler af samme slags i samme uge, samlet i én dialog (fx nr. 1 i seks markeder) */
export type SignalDialog = { id: number; signal: Signal; gruppe?: Signal[] };

let naesteId = 1;

/** Højst så mange toasts gemmes ad gangen */
const MAX_TOASTS = 6;
/** Toasts, der er ældre end så mange spiluger, er forældede (fx "klar til lancering" for et produkt, der er lanceret) */
const TOAST_MAX_ALDER = 2;

/** Tilføj en toast — er den samme tekst allerede fremme, tælles den op og flyttes frem i stedet */
function medToast(liste: Toast[], t: { tekst: string; kind: ToastKind }, handling = false, uge?: number): Toast[] {
  const i = liste.findIndex((x) => x.tekst === t.tekst && x.kind === t.kind);
  if (i < 0) return [...liste, { id: naesteId++, ...t, handling, uge }];
  const antal = (liste[i].antal ?? 1) + 1;
  return [...liste.slice(0, i), ...liste.slice(i + 1), { id: naesteId++, ...t, antal, handling, uge }];
}

/** Smid forældede toasts væk (de kan have ventet bag en række dialoger) */
function friskeToasts(liste: Toast[], uge: number): Toast[] {
  return liste.filter((t) => t.uge === undefined || uge - t.uge <= TOAST_MAX_ALDER);
}

/** Pausegrund, når hele holdet har gået ledigt i flere uger (ingen projektfase og ingen opgave) */
export const GRUND_LEDIGT_HOLD = 'Holdet har intet at lave';
/** Efter så mange uger, hvor ingen har arbejdet, pauses spillet … */
export const LEDIG_PAUSE_UGER = 3;
/** … og igen efter så mange uger, hvis holdet stadig ikke laver noget */
const LEDIG_PAUSE_IGEN = 12;
/** Nyt spil: tiden står stille, til spilleren er klar (løses af det første projekt eller Fortsæt) */
export const GRUND_START = 'Tiden går i gang, når I starter et produkt';

/** Autosave kort efter spillerens handlinger (lancering, ansættelse, flytning, svar på events …), samlet i ét skriv */
const AUTOSAVE_FORSINKELSE_MS = 800;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
function planlaegAutosave(hent: () => GameState | null): void {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    const g = hent();
    if (g && !g.slut) void gem('auto', g);
  }, AUTOSAVE_FORSINKELSE_MS);
}

export type Settings = {
  lyd: boolean;
  musik: boolean;
  /** Lydstyrke 0-1 for effekter og musik (mangler i ældre gemte indstillinger — se kanalVolumen i src/audio/volumen.ts) */
  lydVolumen?: number;
  musikVolumen?: number;
  reduceretBevaegelse: boolean;
  tekstStoerrelse: 'normal' | 'stor' | 'ekstra';
  arkiv: boolean;
  /** Slå enkelte auto-pauser fra (nøgle = signal-kind) */
  autoPauseFra: string[];
  /** Version af auto-pause-standarderne (til migrering af gemte indstillinger) */
  autoPauseV?: number;
};

/** v2: "Licens godkendt" er en toast, ikke en pause (kan slås til igen under Indstillinger) */
const AUTO_PAUSE_V = 2;

export const DEFAULT_SETTINGS: Settings = {
  lyd: true,
  musik: true,
  lydVolumen: 1,
  musikVolumen: 0.5,
  reduceretBevaegelse: typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  tekstStoerrelse: 'normal',
  arkiv: true,
  autoPauseFra: ['licens'],
  autoPauseV: AUTO_PAUSE_V,
};

/** Signaler, der åbner en dialog (spillet står stille, indtil den lukkes) */
export { DIALOG_SIGNALER };

/** Dialoger med en afsløring (scoren tælles op, kuverterne åbnes): HUD'en fryses, til de er lukket */
const AFSLOERING: Signal['k'][] = ['anmeldelse', 'galla'];

/** HUD-tal, der fryses under en afsløring, så de ikke røber resultatet */
export type HudTal = { kapital: number; indsigt: number; hype: number; kunder: number };
function hudTal(g: GameState): HudTal {
  return { kapital: g.kapital, indsigt: g.indsigt, hype: g.hype, kunder: spillerKunderTotal(g) };
}

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
  /** HUD-tal fra før en anmeldelse/galla (null = vis de levende tal) */
  hudFrys: HudTal | null;
  /** Ugen, hvor spilleren selv frigjorde holdet (lancering eller færdigtestet projekt) — så kommer der ingen "ledige"-pause */
  frigjortUge: number | null;
  /** Uger i træk, hvor ingen medarbejder har arbejdet (projekt eller opgave) */
  ledigeUger: number;
  /** Ugen for seneste pause om et ledigt hold (så den ikke kommer igen hver uge) */
  ledigPauseUge: number | null;

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
  /** Genåbn slutskærmen efter "Se firmaet" */
  visSlut(): void;
  /** Debug: erstat state direkte (kun ?debug=1) */
  debugSaet(fn: (s: GameState) => void): void;
  /** Debug: hop frem til et år (auto-vælger events) */
  debugHopTilAar(aar: number): void;
};


const TOAST_KLAR = 'Et produkt er klar til lancering';

function toastFor(sig: Signal): { tekst: string; kind: ToastKind } | null {
  switch (sig.k) {
    case 'fejl': return { tekst: sig.tekst, kind: 'skidt' };
    case 'advarsel': return { tekst: sig.tekst, kind: 'skidt' };
    case 'niveauOp': return { tekst: `Niveau ${sig.niveau}!`, kind: 'godt' };
    case 'kontraktFaerdig': return { tekst: `Opgave leveret: +${Math.round(sig.betaling * 1000)} t. kr., +${sig.indsigt} indsigt`, kind: 'godt' };
    case 'forskning': return { tekst: 'Forskning færdig', kind: 'godt' };
    case 'licens': return { tekst: 'Licens godkendt!', kind: 'godt' };
    case 'klar': return { tekst: TOAST_KLAR, kind: 'info' };
    case 'trend': return { tekst: sig.titel, kind: 'info' };
    case 'afgift': {
      const pct = (x: number) => `${Math.round(x * 1000) / 10} %`.replace('.', ',');
      const tekst = sig.varsel
        ? `${MARKETS[sig.marked].navn}: afgiften går fra ${pct(sig.fra)} til ${pct(sig.til)} i ${datoTekst(sig.uge)}`
        : `${MARKETS[sig.marked].navn}: afgiften er nu ${pct(sig.til)}`;
      return { tekst, kind: sig.til > sig.fra ? 'skidt' : 'godt' };
    }
    case 'reaktion': return reaktionSomDialog(sig.regel) ? null : { tekst: sig.tekst, kind: sig.regel === 'R9' || sig.regel === 'R10' ? 'skidt' : 'info' };
    case 'sponsorResultat': return { tekst: sig.spillerVandt ? `I vandt sponsoratet af ${sig.navn}!` : `${sig.vinder} vandt sponsoratet af ${sig.navn}.`, kind: sig.spillerVandt ? 'godt' : 'info' };
    case 'platform': return sig.faerdig ? { tekst: 'Platformmigreringen er færdig!', kind: 'godt' } : null;
    case 'opkoeb': return { tekst: 'Opkøbet er gennemført!', kind: 'godt' };
    case 'konkurrentNyhed': return { tekst: sig.tekst, kind: 'info' };
    case 'agent': return sig.handling === 'ny' ? { tekst: 'En ny AI-agent er i drift.', kind: 'godt' } : null;
    case 'byhistorie': return { tekst: sig.tekst, kind: sig.profil === 'problem' || sig.profil === 'risiko' ? 'skidt' : 'info' };
    case 'aiScenarie': return { tekst: `${sig.titel} tager fart.`, kind: 'info' };
    case 'transformation': return { tekst: `${sig.erstattet} stillinger er overtaget af agenter.`, kind: 'info' };
    default: return null;
  }
}

/**
 * Debug-hoppets automatiske eventvalg: som sim-kernens autoloesEvents, men uden valg, der skruer op for marketing
 * (investorpres kommer næsten hvert kvartal, og +30 % pr. gang får marketingen til at vokse eksponentielt over mange år).
 */
function roligeEventValg(g: GameState): void {
  while (g.ventendeEvents.length > 0) {
    const e = g.ventendeEvents[0];
    const valg = EVENT_BY_ID[e.eventId]?.valg ?? [];
    const i = Math.max(0, valg.findIndex((v) => !((v.effekt.marketingPct ?? 0) > 0)));
    if (!eventChoice(g, e.eventId, i)) g.ventendeEvents.shift();
  }
}

export const useGame = create<GameStore>((set, get) => {
  /** Fælles efterbehandling af signaler efter step/handling */
  function behandl(ny: GameState, fraTick: boolean): void {
    const st = get();
    const sig = ny.signaler;
    const dialoger = [...st.dialoger];
    let toasts = [...st.toasts];
    const grunde = new Set(st.pauseGrunde);
    let pause = st.paused;
    let frigjortUge = st.frigjortUge;
    // Holdet blev ledigt, fordi spilleren selv lancerede, eller fordi testen blev færdig
    if (sig.some((s) => s.k === 'lanceret' || s.k === 'klar')) frigjortUge = ny.uge;
    // Ledigt hold: sim-kernens 'ledig'-signal kommer kun i ugen, hvor folk går fra travl til ledig (og springes over lige
    // efter en lancering). Tæl derfor selv uger, hvor ingen har arbejdet, og pause efter et par uger.
    let ledigeUger = st.ledigeUger;
    let ledigPauseUge = st.ledigPauseUge;
    if (fraTick) {
      const ingenArbejder = ny.staff.length > 0 && ny.travleSidst.length === 0 && !ny.slut;
      ledigeUger = ingenArbejder ? ledigeUger + 1 : 0;
      if (!ingenArbejder) ledigPauseUge = null;
    }
    let hudFrys = st.hudFrys;
    if (!hudFrys && st.game && sig.some((s) => AFSLOERING.includes(s.k))) hudFrys = hudTal(st.game);
    // Mange markeder: saml ugens fejringer, påbud, sanktioner og regler, så de ikke kommer som én dialog pr. land
    const samling = samlSignaler(st.game, ny, sig);
    for (const d of samling.dialoger) dialoger.push({ id: naesteId++, ...d });
    for (const t of samling.toasts) toasts = medToast(toasts, t, !fraTick, ny.uge);
    for (const s of sig) {
      // Foldet ind i en samlet dialog eller toast: ingen egen toast og ingen egen pause
      if (samling.stille.has(s)) continue;
      const t = toastFor(s);
      if (t) toasts = medToast(toasts, t, !fraTick, ny.uge);
      if (fraTick && pauserFor(s) && !st.settings.autoPauseFra.includes(s.k)) {
        // Ledige lige efter egen lancering/færdig test: spilleren ved det godt — ingen pause, bare et nik
        if (s.k === 'ledig' && frigjortUge !== null && ny.uge - frigjortUge <= 2) {
          toasts = medToast(toasts, { tekst: 'Holdet er ledigt — start næste produkt eller tag en opgave.', kind: 'info' }, false, ny.uge);
          continue;
        }
        pause = true;
        const g = pauseTekst(s);
        if (g) grunde.add(g);
        if (s.k === 'ledig' && ledigeUger > 0) ledigPauseUge = ny.uge;
      }
    }
    const ledigtHold =
      fraTick &&
      ledigeUger >= LEDIG_PAUSE_UGER &&
      (ledigPauseUge === null || ny.uge - ledigPauseUge >= LEDIG_PAUSE_IGEN) &&
      !st.settings.autoPauseFra.includes('ledig');
    if (ledigtHold) {
      ledigPauseUge = ny.uge;
      pause = true;
      grunde.add(GRUND_LEDIGT_HOLD);
      toasts = medToast(toasts, { tekst: `Holdet har ikke lavet noget i ${ledigeUger} uger. Start et produkt, eller tag en opgave.`, kind: 'info' }, false, ny.uge);
    }
    if (dialoger.length > 0) pause = true;
    // "Klar til lancering" er forældet, så snart intet projekt længere venter på lanceringen
    if (!ny.projekter.some((p) => p.klar)) toasts = toasts.filter((t) => t.tekst !== TOAST_KLAR);
    set({
      game: ny,
      sidsteSignaler: sig,
      dialoger,
      toasts: friskeToasts(toasts, ny.uge).slice(-MAX_TOASTS),
      paused: pause,
      pauseGrunde: [...grunde],
      tick: fraTick ? st.tick + 1 : st.tick,
      hudFrys,
      frigjortUge,
      ledigeUger,
      ledigPauseUge,
    });
    if (fraTick) {
      clock.tick += 1;
      clock.sidsteTickMs = performance.now();
      clock.ugeMs = ugeVarighedMs(ny.uge, st.speed);
      // Autosave hvert kvartal — og straks, når en dialog (fx et event) venter, så et reload ikke mister den
      const dialogVenter = sig.some((s) => aabnerDialog(s));
      if (!ny.slut && (dialogVenter || ugeIAar(ny.uge) % 13 === 0)) void gem('auto', ny);
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
    hudFrys: null,
    frigjortUge: null,
    ledigeUger: 0,
    ledigPauseUge: null,

    nytSpil(opts) {
      // New Game+ (spec 6.17): arv og startmode (2018 i USA / AI-native 2026 spoler verden frem uden spilleren)
      const g = lavNytSpil(opts);
      // Tiden starter først, når spilleren er klar (første projekt eller Fortsæt): så går licensugerne og
      // messernes bookingvinduer ikke tabt, mens man læser Knud og kigger sig omkring
      set({ game: g, paused: true, pauseGrunde: [GRUND_START], dialoger: [], toasts: [], sidsteSignaler: [], tick: 0, handlingslog: [], speed: 1, hudFrys: null, frigjortUge: null, ledigeUger: 0, ledigPauseUge: null });
      clock.sidsteTickMs = performance.now();
      clock.ugeMs = ugeVarighedMs(g.uge, 1);
      // Straks i autosave: et reload før første kvartal må ikke miste firmaet
      void gem('auto', g);
    },
    indlaes(state) {
      set({ game: { ...state, signaler: [] }, paused: true, pauseGrunde: ['Spil indlæst'], dialoger: [], toasts: [], sidsteSignaler: [], tick: 0, handlingslog: [], hudFrys: null, frigjortUge: null, ledigeUger: 0, ledigPauseUge: null });
      // Genopret ventende events som dialoger (reload midt i et event)
      const d: SignalDialog[] = state.ventendeEvents.map((e) => ({ id: naesteId++, signal: { k: 'event', eventId: e.eventId } }));
      if (d.length) set({ dialoger: d });
    },
    lukSpil() {
      set({ game: null, paused: true, dialoger: [], toasts: [], pauseGrunde: [], hudFrys: null, frigjortUge: null });
    },
    dispatch(a) {
      const g = get().game;
      if (!g) return false;
      const ny = applyAction(g, a);
      const ok = !ny.signaler.some((x) => x.k === 'fejl');
      set({ handlingslog: [...get().handlingslog.slice(-499), { uge: g.uge, a }] });
      behandl(ny, false);
      if (ok) planlaegAutosave(() => get().game);
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
      const frys = rest.some((d) => AFSLOERING.includes(d.signal.k));
      // Svar på noget i den lukkede dialog (fx "Bud afgivet") skal ikke ligge oven på den næste dialog i køen:
      // de venter, til alle dialoger er lukket
      const toasts = rest.length > 0 ? get().toasts.map((t) => (t.handling ? { ...t, handling: false } : t)) : get().toasts;
      set({ dialoger: rest, hudFrys: frys ? get().hudFrys : null, toasts });
      // Køen er tom: gem, så et reload ikke viser de besvarede dialoger igen
      if (rest.length === 0) planlaegAutosave(() => get().game);
    },
    toast(tekst, kind = 'info') {
      set({ toasts: medToast(get().toasts, { tekst, kind }, true, get().game?.uge).slice(-MAX_TOASTS) });
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
      if (!s) return;
      const settings: Settings = { ...DEFAULT_SETTINGS, ...s };
      if (!Array.isArray(settings.autoPauseFra)) settings.autoPauseFra = [...DEFAULT_SETTINGS.autoPauseFra];
      // Ældre gemte indstillinger: indfør de nye standarder for auto-pause én gang
      if ((s.autoPauseV ?? 1) < AUTO_PAUSE_V) {
        settings.autoPauseFra = [...new Set([...settings.autoPauseFra, 'licens'])];
        settings.autoPauseV = AUTO_PAUSE_V;
        void gemSetting('settings', settings);
      }
      set({ settings });
    },
    visSlut() {
      const slut = get().game?.slut;
      if (!slut || get().dialoger.some((d) => d.signal.k === 'slut')) return;
      set({ dialoger: [...get().dialoger, { id: naesteId++, signal: { k: 'slut', id: slut.id } }] });
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
      // Simulér stille frem til ugen før målet; den sidste uge tages "live" (som i spillet), så fx akt-skiftet i 2026
      // kommer som signal og dialog ("Verdensbilledet 2026")
      while (g.uge < maal - 1 && !g.slut) {
        // Debug-hoppet skal nå frem: hold firmaet i live (ellers går et passivt spil konkurs undervejs)
        if (g.kapital < 1) g.kapital = 1;
        g.negativUger = 0;
        roligeEventValg(g);
        stepMut(g, []);
      }
      roligeEventValg(g);
      g.signaler = [];
      if (!g.slut && g.uge < maal) {
        if (g.kapital < 1) g.kapital = 1;
        g.negativUger = 0;
        set({ game: g, dialoger: [], pauseGrunde: [], toasts: [], hudFrys: null, frigjortUge: null, ledigeUger: 0, ledigPauseUge: null });
        get().stepUge();
        const efter = get();
        set({ paused: true, pauseGrunde: [...new Set([...efter.pauseGrunde, efter.game?.slut ? `Spillet endte i ${aarFor(efter.game.uge)}` : `Hoppet til ${aar}`])] });
        return;
      }
      const slut = g.slut;
      set({
        game: g,
        dialoger: slut ? [{ id: naesteId++, signal: { k: 'slut', id: slut.id } }] : [],
        paused: true,
        pauseGrunde: [slut ? `Spillet endte i ${aarFor(g.uge)}` : `Hoppet til ${aar}`],
        hudFrys: null,
        frigjortUge: null,
        ledigeUger: 0,
        ledigPauseUge: null,
        toasts: [],
      });
    },
  };
});
