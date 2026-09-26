// Pixelkontoret: ét requestAnimationFrame-loop, der læser useGame.getState() (ingen React-rerender pr. frame).
// Statiske lag (kulisse, borde, lys, neon, scanlines) forudtegnes og genbygges kun, når kontor/akt/pynt/besætning ændrer sig.
// AI-akten (2026+): rummet mørklægges, neon tændes, serverskabe (ét pr. to agenter) og cyan hologram-agenter står i
// kontoret. Ved akt-skiftet ses forvandlingen over nogle sekunder, når "Verdensbilledet 2026" er lukket.
import { clock, useGame } from '../store/gameStore';
import { useUi, type PanelId } from '../store/uiStore';
import { opgaverFor } from '../sim/selectors';
import { PHASES, type AgentFunktion, type GameState, type MarketId, type Phase, type Signal } from '../sim/types';
import { ROLES } from '../data/roles';
import { MARKETS } from '../data/markets';
import { AGENTER } from '../data/ai';
import { AKT_CHROME, aktFor, daempning, easeOutBack, easeOutCubic, forvandlingsVarighed, holoInd, neonTaend, skabInd, type AktChrome } from './actChrome';
import { AGENTER_PR_SKAB, BORD_W, CANVAS_H, CANVAS_W, LICENS_H, LICENS_W, PERSON_DX, SKAB_W, SKAERM, antalSkabe, layoutFor, type Felt, type Layout } from './layout';
import {
  materialerFor, tegnBaggrund, tegnBord, tegnGloedLag, tegnLysOverlay, tegnScanlines, tegnStol, tegnTvRamme, tegnUrSkive, tegnVaegpynt, tvSkaerm, lavPaereGloed,
  type LicensPynt, type Pynt,
} from './decor';
import {
  BORD_Y, HOLO_FOD_X, HOLO_FOD_Y, HOLO_H, HOLO_W, IKON, POSE, RAMME_H, RAMME_W, SKAB_FASER, SKAERMLYS_H, SKAERMLYS_W,
  haenderPaaBord, holoSprite, lavPersonAtlas, skabSprite, skaermLysSprite, udseendeFor,
} from './sprites';
import { FASE_FARVE, T, hashTekst } from './palette';
import { afkort, tegnTekst, tekstBredde, tekstSprite } from './font';
import { Bobler } from './bubbles';
import { reduceretBevaegelse } from './particles';

const MAX_PLADSER = 32;
/** + AI-akten: agenterne (hologrammer, og ud over dem: serverskabene) har egne ankre efter bordene */
const MAX_AGENTER = 24;
const MAX_ANKRE = MAX_PLADSER + MAX_AGENTER;

// status pr. bord
const INGEN = 0;
const LEDIG = 1;
const PROJEKT = 2;
const KONTRAKT = 3;
const SOVER = 4;

const LINJER = [5, 3, 4, 2, 5, 4, 3, 5, 2, 4];
const TESTBARER = [3, 5, 2, 4, 6, 3, 5, 4];
const FARVEBJAELKER = ['#e8e8e8', '#e8d84a', '#4ad8d8', '#4ad84a', '#d84ad8', '#d84a4a', '#4a4ad8'];
const UR_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const UR_DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const FASE_NAVN: Record<Phase, string> = { koncept: 'KONCEPT', design: 'DESIGN', teknik: 'TEKNIK', test: 'TEST' };
/** Agentens funktion som lille brystmærke på hologrammet (farven gentages i etiketten med navn) */
const FUNKTION_FARVE: Record<AgentFunktion, string> = {
  trading: T.gold,
  indhold: T.pink,
  kundeservice: T.sky,
  crm: T.violet,
  risiko: T.warn,
  compliance: T.good,
  udvikling: '#ffffff',
};
const SCAN_BAAND = 'rgba(78,230,216,0.06)';

type Hotspot = { x: number; y: number; w: number; h: number; plads: number; linje1: string; linje2: string; panel: PanelId | null; trofae?: boolean };

export type KontorOpts = {
  /** Klik på trofæhylden, kuponerne, plaketterne eller licenserne (ellers: firmapanelet) */
  onTrofaeer?: () => void;
};

type Overgang = { start: number; varighed: number; gammelBg: HTMLCanvasElement | null; gammelLys: HTMLCanvasElement | null };

function lavCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('Canvas 2D understøttes ikke');
  x.imageSmoothingEnabled = false;
  return x;
}

function kopi(c: HTMLCanvasElement): HTMLCanvasElement {
  const k = lavCanvas(c.width, c.height);
  ctx2d(k).drawImage(c, 0, 0);
  return k;
}

export class KontorRenderer {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private koerer = false;
  private unsub: (() => void) | null = null;
  private ro: ResizeObserver | null = null;

  // lag
  private bg = lavCanvas(CANVAS_W, CANVAS_H);
  private fg = lavCanvas(CANVAS_W, CANVAS_H);
  private lys = lavCanvas(CANVAS_W, CANVAS_H);
  private gloed = lavCanvas(CANVAS_W, CANVAS_H);
  private scan = lavCanvas(CANVAS_W, CANVAS_H);
  private paereGloed: HTMLCanvasElement | null = null;
  private skaermLys: HTMLCanvasElement | null = null;
  private skabArk: HTMLCanvasElement | null = null;
  private statiskNoegle = '';

  // afledt tilstand (opdateres, når game-snapshottet skifter)
  private sidsteGame: GameState | null = null;
  private layout: Layout = layoutFor('garage');
  private akt: AktChrome = AKT_CHROME.garage;
  private pynt: Pynt = { priser: [], kuponer: 0, hof: 0, licenser: [], firmaNavn: '' };
  private bedste: { placering: number; marked: MarketId; navn: string; tekst: string } | null = null;
  private hotspots: Hotspot[] = [];
  private harTegnet = false;
  private overgang: Overgang | null = null;

  // pr. bord (faste arrays)
  private dStatus = new Uint8Array(MAX_PLADSER);
  private dFase = new Uint8Array(MAX_PLADSER);
  private dSeed = new Uint32Array(MAX_PLADSER);
  private dPuls = new Float64Array(MAX_ANKRE);
  private dPose = new Uint8Array(MAX_PLADSER);
  private dDy = new Int8Array(MAX_PLADSER);
  private dAtlas: (HTMLCanvasElement | null)[] = new Array(MAX_PLADSER).fill(null);
  private dHud: string[] = new Array(MAX_PLADSER).fill('#000');
  private dStaffId: string[] = new Array(MAX_PLADSER).fill('');
  private atlasCache = new Map<string, { noegle: string; atlas: HTMLCanvasElement; hud: string }>();
  private ankerX = new Float32Array(MAX_ANKRE);
  private ankerY = new Float32Array(MAX_ANKRE);
  private bobler = new Bobler(this.ankerX, this.ankerY);

  // AI-akten
  private agentIds: string[] = [];
  private nAgenter = 0;
  private nSkabe = 0;
  private nHolo = 0;
  private holoArbejd = new Uint8Array(MAX_AGENTER);
  private holoFarve: string[] = new Array(MAX_AGENTER).fill(T.cyan);

  // visning
  private cssPrPx = 2;
  private fontSkala = 1;
  private hover = -1;
  private etiket: { s1: HTMLCanvasElement; s2: HTMLCanvasElement | null; fs: number; i: number; hs: Hotspot | null } | null = null;
  private fejringTil = 0;
  private readonly onPop = (plads: number) => {
    this.dPuls[plads] = performance.now();
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private boks: HTMLElement,
    private opts: KontorOpts = {},
  ) {
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.ctx = ctx2d(canvas);
    this.opdaterAnkre();
  }

  start(): void {
    if (this.koerer) return;
    this.koerer = true;
    this.unsub = useGame.subscribe((s, prev) => {
      if (s.sidsteSignaler !== prev.sidsteSignaler && s.sidsteSignaler.length > 0) this.signaler(s.sidsteSignaler, s.game);
    });
    this.ro = new ResizeObserver(() => this.tilpas());
    this.ro.observe(this.boks);
    this.tilpas();
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('click', this.onClick);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.koerer = false;
    cancelAnimationFrame(this.raf);
    this.unsub?.();
    this.unsub = null;
    this.ro?.disconnect();
    this.ro = null;
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.bobler.ryd();
  }

  /** Er forvandlingen til AI-akten i gang (eller venter den på, at en dialog lukkes)? — til test og fejlfinding */
  forvandlerSig(): boolean {
    return this.overgang !== null;
  }

  // ---------- Størrelse: 16:9, heltalsskalering når muligt, skarpt på HiDPI ----------
  private tilpas(): void {
    // Layoutstørrelsen (ikke getBoundingClientRect): i en dialog, der popper ind med scale(0.85), ville det skalerede
    // rektangel give et for lille lærred, der sidder i venstre side, når animationen er færdig (ResizeObserver ser ikke transforms)
    const r = { width: this.boks.clientWidth, height: this.boks.clientHeight };
    if (r.width < 10 || r.height < 10) return;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min((r.width * dpr) / CANVAS_W, (r.height * dpr) / CANVAS_H);
    const hel = Math.floor(s);
    const skala = hel >= 2 && hel / s >= 0.9 ? hel : s;
    const devW = Math.round(CANVAS_W * skala);
    const devH = Math.round(CANVAS_H * skala);
    const cssW = devW / dpr;
    const cssH = devH / dpr;
    const st = this.canvas.style;
    st.width = `${cssW}px`;
    st.height = `${cssH}px`;
    st.left = `${Math.round(((r.width - cssW) / 2) * dpr) / dpr}px`;
    st.top = `${Math.round(((r.height - cssH) / 2) * dpr) / dpr}px`;
    this.cssPrPx = cssW / CANVAS_W;
    const ny = this.cssPrPx < 1.7 ? 2 : 1;
    if (ny !== this.fontSkala) {
      this.fontSkala = ny;
      this.opdaterAnkre();
    }
  }

  // ---------- Afledt tilstand ----------
  private sync(g: GameState): void {
    this.sidsteGame = g;
    const L = layoutFor(g.kontor);
    const forrigeLayout = this.layout;
    const nyLayout = L !== forrigeLayout;
    const nyAkt = AKT_CHROME[aktFor(g.uge)];
    // Akt-skiftet til AI-akten, mens man kigger: gem den gamle kulisse, så forvandlingen kan tone den ud
    if (nyAkt.id === 'ai' && this.akt.id !== 'ai' && this.harTegnet && !reduceretBevaegelse()) {
      const samme = !nyLayout;
      this.overgang = { start: 0, varighed: 0, gammelBg: samme ? kopi(this.bg) : null, gammelLys: samme ? kopi(this.lys) : null };
    } else if (nyAkt.id !== 'ai') this.overgang = null;
    else if (nyLayout && this.overgang) {
      // nyt kontor midt i forvandlingen: den gamle kulisse passer ikke længere
      this.overgang.gammelBg = null;
      this.overgang.gammelLys = null;
    }
    this.layout = L;
    this.akt = nyAkt;
    const opg = opgaverFor(g);

    // AI-akten: agenter, skabe og hologrammer
    const ai = nyAkt.forvandlet;
    this.nAgenter = ai ? Math.min(g.agenter.length, MAX_AGENTER) : 0;
    this.agentIds = g.agenter.slice(0, this.nAgenter).map((a) => a.id);
    this.nSkabe = ai ? antalSkabe(L, this.nAgenter) : 0;
    this.nHolo = ai ? Math.min(this.nAgenter, L.ai.holo.length) : 0;
    for (let i = 0; i < this.nAgenter; i++) {
      const a = g.agenter[i];
      this.holoArbejd[i] = opg[a.id]?.type === 'projekt' ? 1 : 0;
      this.holoFarve[i] = FUNKTION_FARVE[a.funktion] ?? T.cyan;
    }
    if (this.overgang && this.overgang.start === 0) this.overgang.varighed = forvandlingsVarighed(this.nSkabe, this.nHolo);

    const n = Math.min(L.pladser.length, MAX_PLADSER);
    let besat = '';
    for (let i = 0; i < n; i++) {
      const m = g.staff[i];
      if (!m) {
        this.dStatus[i] = INGEN;
        this.dAtlas[i] = null;
        this.dStaffId[i] = '';
        besat += '0';
        continue;
      }
      besat += '1';
      this.dStaffId[i] = m.id;
      this.dSeed[i] = hashTekst(m.id) % 100000;
      const o = opg[m.id];
      if (m.energi < 25) this.dStatus[i] = SOVER;
      else if (o?.type === 'projekt') {
        this.dStatus[i] = PROJEKT;
        const p = g.projekter.find((x) => x.id === o.projectId);
        this.dFase[i] = p ? PHASES.indexOf(p.fase) : 0;
      } else if (o?.type === 'kontrakt') this.dStatus[i] = KONTRAKT;
      else this.dStatus[i] = LEDIG;
      const noegle = `${m.navn}|${m.udseende}|${m.rolle}`;
      let a = this.atlasCache.get(m.id);
      if (!a || a.noegle !== noegle) {
        const u = udseendeFor(m);
        a = { noegle, atlas: lavPersonAtlas(u), hud: u.hud };
        this.atlasCache.set(m.id, a);
      }
      this.dAtlas[i] = a.atlas;
      this.dHud[i] = a.hud;
    }
    for (let i = n; i < MAX_PLADSER; i++) {
      this.dStatus[i] = INGEN;
      this.dAtlas[i] = null;
      this.dStaffId[i] = '';
    }
    // oprydning i atlas-cachen (fyrede medarbejdere)
    if (this.atlasCache.size > g.staff.length + 8) {
      const ids = new Set(g.staff.map((m) => m.id));
      for (const k of [...this.atlasCache.keys()]) if (!ids.has(k)) this.atlasCache.delete(k);
    }
    // vægpynt: gallapriser, Guldkuponer, Hall of Fame og licensbeviser
    let kuponer = 0;
    let hof = 0;
    for (const p of g.produkter) {
      if (p.ejer !== 'spiller') continue;
      if (p.guldkupon) kuponer++;
      if (p.hallOfFame) hof++;
    }
    const priser: string[] = [];
    for (const r of g.galla) for (const id of r.vundet) priser.push(id);
    const licenser: LicensPynt[] = [];
    let licensNoegle = '';
    for (const m of Object.keys(g.markeder) as MarketId[]) {
      const l = g.markeder[m].licens;
      const status = l === 'aktiv' ? 'aktiv' : l === 'ansoegt' ? 'ansoegt' : l === 'suspenderet' ? 'suspenderet' : null;
      if (!status) continue;
      licenser.push({ farver: MARKETS[m]?.farver ?? [T.gold, T.ink, T.gold], status });
      licensNoegle += `${m}${status[0]}`;
    }
    this.pynt = { priser, kuponer, hof, licenser, firmaNavn: g.firmaNavn };
    // bedste placering på en Top 10
    let bedste: typeof this.bedste = null;
    for (const m of Object.keys(g.markeder) as MarketId[]) {
      for (const e of g.markeder[m].top10) {
        if (bedste && e.placering > bedste.placering) continue;
        if (bedste && e.placering === bedste.placering && m !== 'dk') continue;
        const p = g.produkter.find((x) => x.id === e.productId);
        if (p?.ejer === 'spiller') bedste = { placering: e.placering, marked: m, navn: p.navn, tekst: '' };
      }
    }
    if (bedste) {
      const s = tvSkaerm(L);
      bedste.tekst = tekstBredde(`#${bedste.placering}`, 1, true) > s.w - 2 ? `${bedste.placering}` : `#${bedste.placering}`;
    }
    this.bedste = bedste;

    const noegle = `${L.tier}|${this.akt.id}|${priser.join(',')}|${kuponer}|${hof}|${licensNoegle}|${g.firmaNavn}|${besat}`;
    if (noegle !== this.statiskNoegle) {
      this.statiskNoegle = noegle;
      this.bygStatisk(besat);
    }
    if (nyLayout || ai) this.opdaterAnkre();
    this.bygHotspots(g, n);
    this.canvas.setAttribute(
      'aria-label',
      `Pixelkontoret (${L.tier === 'kaelder' ? 'kælder' : L.tier}): ${g.staff.length} af ${L.pladser.length} pladser besat. ` +
        `Gallapriser: ${priser.length}. Guldkuponer: ${kuponer}. Hall of Fame: ${hof}. Licenser: ${licenser.filter((x) => x.status === 'aktiv').length}.` +
        (ai ? ` AI-agenter: ${g.agenter.length} i ${this.nSkabe} serverskab${this.nSkabe === 1 ? '' : 'e'}.` : ''),
    );
    this.boks.style.background = this.akt.ramme;
  }

  private opdaterAnkre(): void {
    const L = this.layout;
    const z = L.zoom;
    for (let i = 0; i < MAX_PLADSER; i++) {
      const p = L.pladser[i];
      if (!p) continue;
      this.ankerX[i] = (p.x + PERSON_DX + 6) * z;
      this.ankerY[i] = (p.y - BORD_Y + 1) * z;
    }
    // agenter: hologrammets hoved — eller (ud over hologrammerne) toppen af deres serverskab
    for (let i = 0; i < MAX_AGENTER; i++) {
      const h = L.ai.holo[i];
      if (i < this.nHolo && h) {
        this.ankerX[MAX_PLADSER + i] = h.x * z;
        this.ankerY[MAX_PLADSER + i] = (h.y - HOLO_FOD_Y + 1) * z;
      } else {
        const s = L.ai.skabe[Math.min(L.ai.skabe.length - 1, Math.floor(i / AGENTER_PR_SKAB))];
        this.ankerX[MAX_PLADSER + i] = (s.x + SKAB_W / 2) * z;
        this.ankerY[MAX_PLADSER + i] = (s.y - L.ai.skabH) * z;
      }
    }
  }

  private bygStatisk(besat: string): void {
    const L = this.layout;
    const akt = this.akt;
    for (const c of [this.bg, this.fg, this.lys, this.gloed, this.scan]) {
      if (c.width !== L.w || c.height !== L.h) {
        c.width = L.w;
        c.height = L.h;
      }
    }
    const bg = ctx2d(this.bg);
    const fg = ctx2d(this.fg);
    const mat = materialerFor(L.tier, akt);
    const seed = hashTekst(L.tier + akt.id);
    tegnBaggrund(bg, L, akt, seed);
    tegnVaegpynt(bg, L, this.pynt);
    tegnTvRamme(bg, L);
    tegnUrSkive(bg, L);
    fg.clearRect(0, 0, L.w, L.h);
    let s = seed;
    const rnd = () => {
      s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
      return (s % 10000) / 10000;
    };
    for (const p of L.pladser) {
      tegnStol(bg, p.x, p.y, mat, besat[p.i] !== '1');
      tegnBord(fg, p.x, p.y, mat, L.tier, rnd, akt);
    }
    tegnLysOverlay(ctx2d(this.lys), L, akt);
    tegnGloedLag(ctx2d(this.gloed), L, akt, this.pynt.firmaNavn);
    if (akt.scanlines) tegnScanlines(ctx2d(this.scan), L);
    if (L.paere && !this.paereGloed) this.paereGloed = lavPaereGloed(30, '#ffd88a');
    this.skaermLys = akt.gloed ? skaermLysSprite(akt.skaermLys, 1) : null;
    this.skabArk = akt.forvandlet ? skabSprite(L.ai.skabH) : null;
  }

  private bygHotspots(g: GameState, n: number): void {
    const L = this.layout;
    const h: Hotspot[] = [];
    // AI-akten: skabe og hologrammer først (bordene foran vinder ved overlap)
    for (let j = 0; j < this.nSkabe; j++) {
      const sk = L.ai.skabe[j];
      const paa = Math.max(0, Math.min(AGENTER_PR_SKAB, this.nAgenter - j * AGENTER_PR_SKAB));
      h.push({
        x: sk.x,
        y: sk.y - L.ai.skabH,
        w: SKAB_W,
        h: L.ai.skabH,
        plads: -1,
        linje1: 'SERVERSKAB',
        linje2: paa === 0 ? 'KLAR TIL FØRSTE AGENT' : `${paa} ${paa === 1 ? 'AGENT' : 'AGENTER'} I DRIFT`,
        panel: 'ailab',
      });
    }
    for (let i = 0; i < this.nHolo; i++) {
      const a = g.agenter[i];
      const p = L.ai.holo[i];
      h.push({
        x: p.x - 4,
        y: p.y - HOLO_FOD_Y + 1,
        w: 9,
        h: HOLO_FOD_Y,
        plads: -1,
        linje1: (a.navn ?? 'AGENT').toUpperCase(),
        linje2: `AI · ${AGENTER[a.funktion].navn.toUpperCase()}${this.holoArbejd[i] ? ' · I PROJEKT' : ''}`,
        panel: 'ailab',
      });
    }
    if (this.akt.forvandlet) {
      const tomme = Math.min(L.ai.holo.length, this.nHolo + 2);
      for (let i = this.nHolo; i < tomme; i++) {
        const p = L.ai.holo[i];
        h.push({ x: p.x - 5, y: p.y - 4, w: 11, h: 5, plads: -1, linje1: 'LEDIG PROJEKTORPUDE', linje2: 'SÆT EN AGENT I DRIFT', panel: 'ailab' });
      }
    }
    for (let i = 0; i < n; i++) {
      const p = L.pladser[i];
      const m = g.staff[i];
      let linje2 = 'LEDIG PLADS';
      if (m) {
        const rolle = (m.specialisering === 'crm' ? 'CRM' : ROLES[m.rolle]?.navn ?? m.rolle).toUpperCase();
        const st = this.dStatus[i];
        const hvad =
          st === SOVER ? `TRÆT (${Math.round(m.energi)})` : st === PROJEKT ? FASE_NAVN[PHASES[this.dFase[i]]] : st === KONTRAKT ? 'OPGAVE' : 'LEDIG';
        linje2 = `${rolle} · ${hvad}`;
      }
      h.push({ x: p.x, y: p.y - 19, w: BORD_W, h: 28, plads: i, linje1: m ? m.navn.toUpperCase() : 'TOM PLADS', linje2: m ? linje2 : 'KLIK FOR AT ANSÆTTE', panel: m ? null : 'personale' });
    }
    const f = (felt: Felt, linje1: string, linje2: string, panel: PanelId | null, ekstraOp = 0, trofae = false) =>
      h.push({ x: felt.x, y: felt.y - ekstraOp, w: felt.w, h: felt.h + ekstraOp, plads: -1, linje1, linje2, panel, trofae });
    const pk = this.pynt;
    const trofaeTekst = 'KLIK: SE TROFÆHYLDEN';
    f(L.hylde, `GALLAPRISER: ${pk.priser.length}`, pk.priser.length ? trofaeTekst : 'HYLDEN VENTER', 'firma', L.vitrine ? 14 : 10, true);
    f(L.kuponer, `GULDKUPONER: ${pk.kuponer}`, pk.kuponer ? trofaeTekst : 'TOTAL 32+ AF 40', 'firma', 0, true);
    if (pk.hof > 0) f(L.plaketter, `HALL OF FAME: ${pk.hof}`, trofaeTekst, 'firma', 0, true);
    const aktive = pk.licenser.filter((x) => x.status === 'aktiv').length;
    const synlige = Math.min(pk.licenser.length, L.licenser.length);
    if (synlige > 0) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < synlige; i++) {
        const q = L.licenser[i];
        x0 = Math.min(x0, q.x);
        y0 = Math.min(y0, q.y);
        x1 = Math.max(x1, q.x + LICENS_W);
        y1 = Math.max(y1, q.y + LICENS_H);
      }
      const suspenderet = pk.licenser.some((x) => x.status === 'suspenderet');
      f({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, `LICENSER: ${aktive}`, suspenderet ? 'EN ER SUSPENDERET' : trofaeTekst, 'marked', 0, true);
    }
    const b = this.bedste;
    f(L.tv, b ? `TOP 10: NR. ${b.placering}` : 'TOP 10', b ? `${b.navn.toUpperCase()} · ${MARKETS[b.marked]?.kort ?? b.marked}` : 'IKKE PÅ LISTEN ENDNU', 'hitliste');
    this.hotspots = h;
  }

  // ---------- Signaler → bobler og fest ----------
  private signaler(sig: Signal[], g: GameState | null): void {
    if (!g) return;
    const nu = performance.now();
    if (g !== this.sidsteGame) this.sync(g);
    // Boblerne tegnes mindst i dobbelt størrelse — også i de store kontorer (zoom 1), hvor figurerne er små. Ellers
    // forsvinder "boblerne stiger"-følelsen, netop når firmaet vokser.
    const fs = Math.max(2, this.layout.zoom, this.fontSkala);
    let fest = 0;
    let personIdx = 0;
    for (const s of sig) {
      switch (s.k) {
        case 'point': {
          let plads = this.pladsFor(s.staffId, g);
          let agent = false;
          if (plads < 0) {
            // AI-akten: agenternes point popper cyan-glødende op over hologrammet (eller serverskabet)
            const t = this.agentIds.indexOf(s.staffId);
            if (t < 0) break;
            plads = MAX_PLADSER + t;
            agent = true;
          }
          const seed = agent ? plads * 37 : this.dSeed[plads];
          const forskyd = ((seed % 97) / 97) * 0.8 + (personIdx++ % 3) * 0.1;
          this.bobler.planlaegPoint(nu, plads, s.params, s.fejl, s.fjernet, clock.ugeMs, fs, forskyd, agent);
          break;
        }
        case 'niveauOp': {
          const plads = this.pladsFor(s.staffId, g);
          if (plads >= 0) this.bobler.planlaegEn(nu + 150, plads, `NIV. ${s.niveau}!`, T.gold, 'stjerne', fs);
          break;
        }
        // Konfetti affyres af dialogerne selv (anmeldelse, Top 10/nr. 1, galla), timet med afsløringen.
        // Kontoret nøjes med at juble.
        case 'guldkupon':
        case 'hallOfFame':
        case 'nr1':
        case 'top10':
          fest = Math.max(fest, 3200);
          break;
        case 'galla':
          if (s.vundet.length > 0) fest = Math.max(fest, 3200);
          break;
        case 'lanceret':
        case 'kontor':
          fest = Math.max(fest, 1800);
          break;
      }
    }
    if (fest) this.fejringTil = Math.max(this.fejringTil, nu + fest);
  }

  private pladsFor(staffId: string, g: GameState): number {
    const n = Math.min(this.layout.pladser.length, g.staff.length, MAX_PLADSER);
    for (let i = 0; i < n; i++) if (g.staff[i].id === staffId) return i;
    return -1;
  }

  // ---------- Frame ----------
  private frame = (nu: number): void => {
    if (!this.koerer) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) return;
    const st = useGame.getState();
    const g = st.game;
    if (!g) return;
    if (g !== this.sidsteGame) this.sync(g);
    const red = reduceretBevaegelse();
    const aktivt = !st.paused && st.dialoger.length === 0;
    const L = this.layout;
    const z = L.zoom;
    const ctx = this.ctx;
    const akt = this.akt;
    this.bobler.opdater(nu, this.onPop);

    // Forvandlingen: e = ms siden start (-1 = venter på, at dialogerne lukkes; Infinity = ingen forvandling)
    let e = Infinity;
    const ov = this.overgang;
    if (ov) {
      if (red) this.overgang = null;
      else {
        if (ov.start === 0 && st.dialoger.length === 0 && !useUi.getState().dialog) ov.start = nu;
        e = ov.start === 0 ? -1 : nu - ov.start;
        if (e >= ov.varighed) {
          this.overgang = null;
          e = Infinity;
        }
      }
    }
    const iOvergang = e !== Infinity;
    const daemp = iOvergang ? daempning(e) : 1;

    ctx.setTransform(z, 0, 0, z, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bg, 0, 0);
    if (iOvergang && ov?.gammelBg && daemp < 1) {
      ctx.globalAlpha = 1 - daemp;
      ctx.drawImage(ov.gammelBg, 0, 0);
      ctx.globalAlpha = 1;
    }
    if (L.ur) this.tegnUrViser(L.ur.x, L.ur.y, nu, aktivt);
    // rækker oppefra: personer → bordlag (bånd) → hænder
    const n = Math.min(L.pladser.length, MAX_PLADSER);
    let d = 0;
    for (let r = 0; r < L.raekker.length; r++) {
      const start = d;
      while (d < n && L.pladser[d].raekke === r) {
        this.tegnPerson(d, nu, red, aktivt);
        d++;
      }
      const by = L.raekker[r] - 11;
      ctx.drawImage(this.fg, 0, by, L.w, 21, 0, by, L.w, 21);
      for (let k = start; k < d; k++) this.tegnHaender(k, nu, red, aktivt);
    }
    if (iOvergang) {
      if (ov?.gammelLys && daemp < 1) {
        ctx.globalAlpha = 1 - daemp;
        ctx.drawImage(ov.gammelLys, 0, 0);
      }
      if (daemp > 0) {
        ctx.globalAlpha = daemp;
        ctx.drawImage(this.lys, 0, 0);
      }
      ctx.globalAlpha = 1;
    } else ctx.drawImage(this.lys, 0, 0);
    // selvlysende: skærme, serverskabe, hologrammer, tv, neon, pære, statusikoner
    for (let k = 0; k < n; k++) this.tegnSkaerm(k, nu, red, aktivt, daemp);
    if (akt.forvandlet) {
      this.tegnSkabe(nu, red, e);
      this.tegnHologrammer(nu, red, aktivt, e);
    }
    this.tegnTv(nu, red);
    if (akt.neon) {
      let a = iOvergang ? neonTaend(e) : 1;
      // lysstofrørene blafrer en sjælden gang
      if (!red && !iOvergang && (((nu / 90) | 0) % 173 === 0 || ((nu / 70) | 0) % 311 === 0)) a = 0.55;
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.drawImage(this.gloed, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    if (L.paere) this.tegnPaere(nu, red);
    for (let k = 0; k < n; k++) this.tegnStatusIkon(k, nu, red);
    if (akt.scanlines) {
      // Lille lærred (telefon): scanlines på under 2 skærmpixel pr. scenepixel giver moiré og "dobbelte" figurer — halv styrke
      const a = (iOvergang ? neonTaend(e) : 1) * (this.cssPrPx < 1.7 ? 0.5 : 1);
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.drawImage(this.scan, 0, 0);
        if (!red) {
          // et langsomt lysbånd glider ned over rummet
          const y = ((nu / 45) % (L.h + 60)) - 30;
          ctx.fillStyle = SCAN_BAAND;
          ctx.fillRect(0, y | 0, L.w, 3);
        }
        ctx.globalAlpha = 1;
      }
    }

    // overlag i fuld opløsning: bobler og etiketter
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(2, z, this.fontSkala);
    this.bobler.loft = fs >= 2 ? 40 : 110;
    this.bobler.tegn(ctx, nu, red, CANVAS_W, 20 * fs);
    if (this.hover >= 0) this.tegnEtiket(this.fontSkala);
    this.harTegnet = true;
  };

  private tegnPerson(k: number, nu: number, red: boolean, aktivt: boolean): void {
    const status = this.dStatus[k];
    const atlas = this.dAtlas[k];
    if (status === INGEN || !atlas) return;
    const p = this.layout.pladser[k];
    const seed = this.dSeed[k];
    let pose: number = POSE.idle;
    let dy = 0;
    if (nu < this.fejringTil && status !== SOVER) {
      pose = POSE.jubel;
      if (!red) {
        // hop med squash ved afsæt og landing
        const ph = ((nu + (seed % 400)) % 560) / 560;
        dy = -Math.round(Math.sin(ph * Math.PI) * 3);
        if (ph > 0.9 || ph < 0.05) pose = POSE.landing;
      }
    } else if (status === SOVER) {
      pose = POSE.sover;
    } else if (status === PROJEKT || status === KONTRAKT) {
      pose = POSE.arbejd;
      if (!red && aktivt) {
        const pl = nu - this.dPuls[k];
        if (pl >= 0 && pl < 90) pose = POSE.squash;
        else if (pl >= 90 && pl < 170) pose = POSE.stretch;
        else {
          const c = (nu + seed) % 1700;
          if (c < 70) pose = POSE.squash;
          else if (c < 140) pose = POSE.stretch;
        }
      }
    } else if (!red) {
      const c = (nu + seed * 13) % 10000;
      if (c < 4200) pose = c % 2600 < 120 ? POSE.blink : POSE.idle;
      else if (c < 6600) pose = POSE.kaffe;
      else if (c < 7500) pose = POSE.armeOp;
      else if (c < 8200 && (seed & 1) === 0) {
        const ph = (c - 7500) / 700;
        const hop = ph < 0.5 ? ph * 2 : 0;
        dy = -Math.round(Math.sin(hop * Math.PI) * 3);
        pose = ph < 0.06 || (ph >= 0.5 && ph < 0.62) ? POSE.landing : POSE.idle;
      } else pose = c % 1900 < 110 ? POSE.blink : POSE.idle;
    }
    this.dPose[k] = pose;
    this.dDy[k] = dy;
    this.ctx.drawImage(atlas, pose * RAMME_W, 0, RAMME_W, RAMME_H, p.x + PERSON_DX, p.y - BORD_Y + dy, RAMME_W, RAMME_H);
  }

  private tegnHaender(k: number, nu: number, red: boolean, aktivt: boolean): void {
    const status = this.dStatus[k];
    if (status === INGEN) return;
    const pose = this.dPose[k];
    const h = haenderPaaBord(pose);
    if (h === 0) return;
    const p = this.layout.pladser[k];
    const ctx = this.ctx;
    ctx.fillStyle = this.dHud[k];
    const dy = this.dDy[k];
    let lOp = 0;
    let hOp = 0;
    if ((status === PROJEKT || status === KONTRAKT) && aktivt && !red && pose !== POSE.idle) {
      const ph = (((nu + this.dSeed[k]) / 115) | 0) & 3;
      lOp = ph === 0 ? 1 : 0;
      hOp = ph === 2 ? 1 : 0;
    }
    const y = p.y + dy;
    ctx.fillRect(p.x + PERSON_DX + 1, y - lOp, 2, 2);
    if (h === 2) ctx.fillRect(p.x + PERSON_DX + 9, y - hOp, 2, 2);
  }

  private tegnSkaerm(k: number, nu: number, red: boolean, aktivt: boolean, daemp: number): void {
    const p = this.layout.pladser[k];
    if (!p) return;
    const ctx = this.ctx;
    const a = this.akt.skaerm;
    const sx = p.x + SKAERM.x;
    const sy = p.y + SKAERM.y;
    const status = this.dStatus[k];
    const seed = this.dSeed[k];
    const anim = aktivt && !red;
    if (this.skaermLys && status !== INGEN && daemp > 0) {
      // skærmens lys falder på ansigtet og bordet (varmt hvidt — agenterne er cyan)
      if (daemp < 1) ctx.globalAlpha = daemp;
      ctx.drawImage(this.skaermLys, sx + (SKAERM.w >> 1) - (SKAERMLYS_W >> 1) + 3, sy + (SKAERM.h >> 1) - (SKAERMLYS_H >> 1) + 2);
      if (daemp < 1) ctx.globalAlpha = 1;
    }
    if (status === INGEN) {
      ctx.fillStyle = a.slukket;
      ctx.fillRect(sx, sy, SKAERM.w, SKAERM.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx + 1, sy + 1, 1, 2);
      return;
    }
    if (status === PROJEKT) {
      ctx.fillStyle = a.projektBg;
      ctx.fillRect(sx, sy, SKAERM.w, SKAERM.h);
      const off = anim ? ((nu / 240) | 0) + seed : seed;
      ctx.fillStyle = FASE_FARVE[PHASES[this.dFase[k]]];
      for (let j = 0; j < 3; j++) ctx.fillRect(sx + 1 + (j === 1 ? 1 : 0), sy + 1 + j * 2, LINJER[(off + j) % LINJER.length] - (j === 1 ? 1 : 0), 1);
      if (!anim || ((nu / 300) | 0) & 1) {
        ctx.fillStyle = T.ink;
        ctx.fillRect(sx + SKAERM.w - 1, sy + SKAERM.h - 1, 1, 1);
      }
      return;
    }
    if (status === KONTRAKT) {
      ctx.fillStyle = a.kontraktBg;
      ctx.fillRect(sx, sy, SKAERM.w, SKAERM.h);
      const off = anim ? ((nu / 330) | 0) + seed : seed;
      ctx.fillStyle = a.kontraktLinje;
      for (let j = 0; j < 3; j++) {
        const hh = Math.min(SKAERM.h - 1, TESTBARER[(off + j) % TESTBARER.length]);
        ctx.fillRect(sx + 1 + j * 2, sy + SKAERM.h - hh, 1, hh);
      }
      return;
    }
    // ledig / sover: pauseskærm med en vandrende prik
    ctx.fillStyle = a.ledigBg;
    ctx.fillRect(sx, sy, SKAERM.w, SKAERM.h);
    const t = red ? seed : ((nu / 350) | 0) + seed;
    const px = t % (SKAERM.w * 2 - 2);
    const x = px < SKAERM.w ? px : SKAERM.w * 2 - 2 - px;
    const py = (t >> 1) % (SKAERM.h * 2 - 2);
    const y = py < SKAERM.h ? py : SKAERM.h * 2 - 2 - py;
    ctx.fillStyle = a.ledigPrik;
    ctx.fillRect(sx + Math.min(SKAERM.w - 1, x), sy + Math.min(SKAERM.h - 1, y), 1, 1);
  }

  /** AI-akten: serverskabe (ét pr. to agenter) — LED'erne blinker, og under forvandlingen rulles de ind fra højre */
  private tegnSkabe(nu: number, red: boolean, e: number): void {
    const ark = this.skabArk;
    if (!ark) return;
    const L = this.layout;
    const h = L.ai.skabH;
    const fh = h + 3;
    const ctx = this.ctx;
    const fase = red ? 0 : (nu / 380) | 0;
    for (let j = 0; j < this.nSkabe; j++) {
      const sk = L.ai.skabe[j];
      let dx = 0;
      if (e !== Infinity) {
        const t = e < 0 ? 0 : skabInd(e, j);
        if (t <= 0) continue;
        dx = Math.round((1 - easeOutBack(t)) * (L.w - sk.x + 4));
      }
      const niv = Math.max(0, Math.min(AGENTER_PR_SKAB, this.nAgenter - j * AGENTER_PR_SKAB));
      const frame = niv * SKAB_FASER + ((fase + j * 3) & (SKAB_FASER - 1));
      ctx.drawImage(ark, frame * SKAB_W, 0, SKAB_W, fh, sk.x + dx, sk.y - h, SKAB_W, fh);
    }
  }

  /** AI-akten: agenterne som små cyan hologrammer — svæver, flimrer og blusser op, når de sender point */
  private tegnHologrammer(nu: number, red: boolean, aktivt: boolean, e: number): void {
    const atlas = holoSprite();
    const L = this.layout;
    const ctx = this.ctx;
    // Ledige projektorpuder (op til to) viser, hvor de næste agenter kommer til at stå
    const tomme = Math.min(L.ai.holo.length, this.nHolo + 2);
    for (let i = this.nHolo; i < tomme; i++) {
      const p = L.ai.holo[i];
      const t = e === Infinity ? 1 : e < 0 ? 0 : holoInd(e, i);
      if (t <= 0) continue;
      ctx.globalAlpha = (red ? 0.4 : 0.3 + 0.12 * Math.sin(nu / 700 + i)) * t;
      ctx.drawImage(atlas, 0, HOLO_H - 3, HOLO_W, 3, p.x - HOLO_FOD_X, p.y - HOLO_FOD_Y + HOLO_H - 3, HOLO_W, 3);
    }
    ctx.globalAlpha = 1;
    if (this.nHolo === 0) return;
    const scanFase = red ? 0 : ((nu / 170) | 0) & 1;
    for (let i = 0; i < this.nHolo; i++) {
      const p = L.ai.holo[i];
      let vis = HOLO_H;
      let alpha = 0.86;
      if (e !== Infinity) {
        const t = e < 0 ? 0 : holoInd(e, i);
        if (t <= 0) continue;
        vis = Math.max(1, Math.round(easeOutCubic(t) * HOLO_H));
        alpha = 0.4 + 0.46 * t;
      }
      let dy = 0;
      let dx = 0;
      if (!red) {
        dy = Math.round(Math.sin(nu / 520 + i * 1.3) * 0.9);
        // en sjælden glitch: hologrammet springer en pixel og blegner
        if ((((nu / 60) | 0) + i * 29) % 157 === 0) {
          alpha = 0.35;
          dx = 1;
        }
      }
      const pl = nu - this.dPuls[MAX_PLADSER + i];
      if (pl >= 0 && pl < 220) {
        alpha = 1;
        if (!red) dy -= 1;
      }
      const arbejd = this.holoArbejd[i] === 1 && (aktivt || red);
      const frame = (arbejd ? 2 : 0) + scanFase;
      const x = p.x - HOLO_FOD_X + dx;
      const y = p.y - HOLO_FOD_Y;
      ctx.globalAlpha = alpha;
      // puden står stille på gulvet; figuren svæver
      ctx.drawImage(atlas, frame * HOLO_W, HOLO_H - 3, HOLO_W, 3, x, y + HOLO_H - 3, HOLO_W, 3);
      const top = HOLO_H - vis;
      if (vis > 3) ctx.drawImage(atlas, frame * HOLO_W, top, HOLO_W, vis - 3, x, y + top + dy, HOLO_W, vis - 3);
      // funktionens farve som brystmærke
      if (vis >= HOLO_H - 7) {
        ctx.fillStyle = this.holoFarve[i];
        ctx.fillRect(x + 5, y + 9 + dy, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private tegnStatusIkon(k: number, nu: number, red: boolean): void {
    const status = this.dStatus[k];
    if (status !== KONTRAKT && status !== SOVER) return;
    const p = this.layout.pladser[k];
    const ctx = this.ctx;
    const hovedX = p.x + PERSON_DX;
    const top = p.y - BORD_Y + 3;
    if (status === KONTRAKT) {
      const kuf = IKON.kuffert();
      const bob = red ? 0 : ((nu + this.dSeed[k]) / 450) & 1;
      ctx.drawImage(kuf, hovedX + 12 - kuf.width + 3, top - kuf.height - 1 - bob);
      return;
    }
    // zzz
    if (red) {
      tegnTekst(ctx, 'Z', hovedX + 9, top + 2, T.sky);
      tegnTekst(ctx, 'Z', hovedX + 12, top - 4, T.sky);
      return;
    }
    for (let j = 0; j < 3; j++) {
      const t = ((nu / 1400 + j / 3 + (this.dSeed[k] % 100) / 100) % 1 + 1) % 1;
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      tegnTekst(ctx, 'Z', hovedX + 8 + Math.round(t * 5), top + 6 - Math.round(t * 12), T.sky);
    }
    ctx.globalAlpha = 1;
  }

  private tegnTv(nu: number, red: boolean): void {
    const L = this.layout;
    const s = tvSkaerm(L);
    const ctx = this.ctx;
    const b = this.bedste;
    if (!b) {
      // farvebjælker: tv'et er ikke stillet ind endnu
      const bw = s.w / FARVEBJAELKER.length;
      for (let i = 0; i < FARVEBJAELKER.length; i++) {
        ctx.fillStyle = FARVEBJAELKER[i];
        ctx.fillRect(s.x + Math.floor(i * bw), s.y, Math.ceil(bw), s.h - 3);
      }
      ctx.fillStyle = '#20243a';
      ctx.fillRect(s.x, s.y + s.h - 3, s.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
    } else {
      ctx.fillStyle = b.placering === 1 ? '#2a2410' : '#10233a';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      let top = s.y + 1;
      if (s.h >= 15) {
        const tw = tekstBredde('TOP 10');
        tegnTekst(ctx, 'TOP 10', s.x + Math.floor((s.w - tw) / 2), top, T.muted);
        top += 7;
      } else top = s.y + Math.floor((s.h - 7) / 2);
      const t = b.tekst;
      const tw = tekstBredde(t, 1, true);
      const blink = b.placering === 1 && !red && ((nu / 500) | 0) & 1;
      tegnTekst(ctx, t, s.x + Math.floor((s.w - tw) / 2), top, blink ? '#fff3b0' : b.placering === 1 ? T.gold : T.ink, 1, true);
    }
    if (!red) {
      const sl = ((nu / 60) | 0) % (s.h + 8);
      if (sl < s.h) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(s.x, s.y + sl, s.w, 1);
      }
    }
  }

  /** Vægurets viser går én omgang pr. uge (interpoleret med clock fra gameStore) */
  private tegnUrViser(x: number, y: number, nu: number, aktivt: boolean): void {
    const t = aktivt && clock.ugeMs > 0 ? Math.min(0.999, Math.max(0, (nu - clock.sidsteTickMs) / clock.ugeMs)) : 0;
    const i = Math.round(t * 8) & 7;
    const dx = UR_DX[i];
    const dy = UR_DY[i];
    const ctx = this.ctx;
    ctx.fillStyle = T.line;
    ctx.fillRect(x + 3, y + 3, 1, 1);
    ctx.fillStyle = T.bad;
    ctx.fillRect(x + 3 + dx, y + 3 + dy, 1, 1);
    ctx.fillRect(x + 3 + dx * 2, y + 3 + dy * 2, 1, 1);
  }

  private tegnPaere(nu: number, red: boolean): void {
    const L = this.layout;
    const pa = L.paere!;
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(pa.x, 3, 1, pa.y - 3);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(pa.x - 1, pa.y, 3, 2);
    const flimmer = red ? 1 : 0.86 + 0.14 * Math.sin(nu / 97) * Math.sin(nu / 413);
    if (this.paereGloed) {
      ctx.globalAlpha = flimmer;
      const r = this.paereGloed.width / 2;
      ctx.drawImage(this.paereGloed, pa.x - r, pa.y + 3 - r);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(pa.x - 1, pa.y + 2, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pa.x, pa.y + 2, 1, 1);
  }

  private tegnEtiket(fs: number): void {
    const h = this.hotspots[this.hover];
    if (!h) return;
    const z = this.layout.zoom;
    let e = this.etiket;
    if (!e || e.i !== this.hover || e.fs !== fs || e.hs !== h) {
      // bygges kun, når etiketten skifter (ingen allokering pr. frame)
      const maxW = CANVAS_W - 4;
      e = {
        s1: tekstSprite(afkort(h.linje1, maxW - 6 * fs, fs), T.ink, fs, { baggrund: T.panel, kant: T.line, pad: 2 }),
        s2: h.linje2 ? tekstSprite(afkort(h.linje2, maxW - 6 * fs, fs), h.plads >= 0 ? T.muted : h.panel === 'ailab' ? T.cyan : T.gold, fs, { baggrund: T.bg2, kant: T.line, pad: 2 }) : null,
        fs,
        i: this.hover,
        hs: h,
      };
      this.etiket = e;
    }
    const { s1, s2 } = e;
    const w = Math.max(s1.width, s2?.width ?? 0);
    const cx = (h.x + h.w / 2) * z;
    let x = Math.round(cx - w / 2);
    x = Math.max(2, Math.min(CANVAS_W - w - 2, x));
    const totalH = s1.height + (s2 ? s2.height - fs : 0);
    let y = Math.round(h.y * z - totalH - 2);
    if (y < 2) y = Math.round((h.y + h.h) * z + 2);
    y = Math.max(2, Math.min(CANVAS_H - totalH - 2, y));
    const ctx = this.ctx;
    ctx.drawImage(s1, x + Math.round((w - s1.width) / 2), y);
    if (s2) ctx.drawImage(s2, x + Math.round((w - s2.width) / 2), y + s1.height - fs);
  }

  // ---------- Pointer: hover-etiket og klik ----------
  private hitTest(ev: MouseEvent): number {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0) return -1;
    const z = this.layout.zoom;
    const lx = ((ev.clientX - r.left) / r.width) * (CANVAS_W / z);
    const ly = ((ev.clientY - r.top) / r.height) * (CANVAS_H / z);
    // bagfra: forreste række (tegnet sidst) vinder
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i];
      if (lx >= h.x && lx < h.x + h.w && ly >= h.y && ly < h.y + h.h) return i;
    }
    return -1;
  }

  private onMove = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') return;
    const i = this.hitTest(ev);
    if (i !== this.hover) {
      this.hover = i;
      this.canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
    }
  };

  private onLeave = (): void => {
    this.hover = -1;
    this.canvas.style.cursor = 'default';
  };

  private onClick = (ev: MouseEvent): void => {
    const i = this.hitTest(ev);
    const h = this.hotspots[i];
    if (!h) return;
    if (h.plads >= 0) {
      const id = this.dStaffId[h.plads];
      if (id) {
        useUi.getState().aabn({ kind: 'medarbejder', staffId: id });
        return;
      }
    }
    if (h.trofae && this.opts.onTrofaeer) {
      this.opts.onTrofaeer();
      return;
    }
    if (h.panel) useUi.getState().setPanel(h.panel);
  };
}
