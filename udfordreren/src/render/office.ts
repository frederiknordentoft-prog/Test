// Pixelkontoret: ét requestAnimationFrame-loop, der læser useGame.getState() (ingen React-rerender pr. frame).
// Statiske lag (kulisse, borde, lys) forudtegnes og genbygges kun, når kontor/akt/pynt/besætning ændrer sig.
import { clock, useGame } from '../store/gameStore';
import { useUi, type PanelId } from '../store/uiStore';
import { opgaverFor } from '../sim/selectors';
import { PHASES, type GameState, type MarketId, type Phase, type Signal } from '../sim/types';
import { ROLES } from '../data/roles';
import { MARKETS } from '../data/markets';
import { aktFor, AKT_CHROME, type AktChrome } from './actChrome';
import { BORD_W, CANVAS_H, CANVAS_W, PERSON_DX, SKAERM, layoutFor, type Felt, type Layout } from './layout';
import { materialerFor, tegnBaggrund, tegnBord, tegnGloedLag, tegnLysOverlay, tegnStol, tegnTvRamme, tegnUrSkive, tegnVaegpynt, tvSkaerm, lavPaereGloed, type Pynt } from './decor';
import { BORD_Y, IKON, POSE, RAMME_H, RAMME_W, haenderPaaBord, lavPersonAtlas, udseendeFor } from './sprites';
import { FASE_FARVE, T, hashTekst, rgba } from './palette';
import { afkort, tegnTekst, tekstBredde, tekstSprite } from './font';
import { Bobler } from './bubbles';
import { reduceretBevaegelse } from './particles';

const MAX_PLADSER = 32;

// status pr. bord
const INGEN = 0;
const LEDIG = 1;
const PROJEKT = 2;
const KONTRAKT = 3;
const SOVER = 4;

const LINJER = [5, 3, 4, 2, 5, 4, 3, 5, 2, 4];
const TESTBARER = [3, 5, 2, 4, 6, 3, 5, 4];
const FARVEBJAELKER = ['#e8e8e8', '#e8d84a', '#4ad8d8', '#4ad84a', '#d84ad8', '#d84a4a', '#4a4ad8'];
const SKAERM_GLOED = rgba(T.cyan, 0.18);
const UR_DX = [0, 1, 1, 1, 0, -1, -1, -1];
const UR_DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const FASE_NAVN: Record<Phase, string> = { koncept: 'KONCEPT', design: 'DESIGN', teknik: 'TEKNIK', test: 'TEST' };

type Hotspot = { x: number; y: number; w: number; h: number; plads: number; linje1: string; linje2: string; panel: PanelId | null };

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
  private paereGloed: HTMLCanvasElement | null = null;
  private statiskNoegle = '';

  // afledt tilstand (opdateres, når game-snapshottet skifter)
  private sidsteGame: GameState | null = null;
  private layout: Layout = layoutFor('garage');
  private akt: AktChrome = AKT_CHROME.garage;
  private pynt: Pynt = { pokaler: 0, kuponer: 0, hof: 0, licens: 'ingen', firmaNavn: '' };
  private bedste: { placering: number; marked: MarketId; navn: string; tekst: string } | null = null;
  private hotspots: Hotspot[] = [];

  // pr. bord (faste arrays)
  private dStatus = new Uint8Array(MAX_PLADSER);
  private dFase = new Uint8Array(MAX_PLADSER);
  private dSeed = new Uint32Array(MAX_PLADSER);
  private dPuls = new Float64Array(MAX_PLADSER);
  private dPose = new Uint8Array(MAX_PLADSER);
  private dDy = new Int8Array(MAX_PLADSER);
  private dAtlas: (HTMLCanvasElement | null)[] = new Array(MAX_PLADSER).fill(null);
  private dHud: string[] = new Array(MAX_PLADSER).fill('#000');
  private dStaffId: string[] = new Array(MAX_PLADSER).fill('');
  private atlasCache = new Map<string, { noegle: string; atlas: HTMLCanvasElement; hud: string }>();
  private ankerX = new Float32Array(MAX_PLADSER);
  private ankerY = new Float32Array(MAX_PLADSER);
  private bobler = new Bobler(this.ankerX, this.ankerY);

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

  // ---------- Størrelse: 16:9, heltalsskalering når muligt, skarpt på HiDPI ----------
  private tilpas(): void {
    const r = this.boks.getBoundingClientRect();
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
    const nyLayout = L !== this.layout;
    this.layout = L;
    this.akt = AKT_CHROME[aktFor(g.uge)];
    const opg = opgaverFor(g);
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
    // vægpynt
    const spiller = g.produkter.filter((p) => p.ejer === 'spiller');
    const dk = g.markeder.dk?.licens;
    this.pynt = {
      pokaler: g.galla.reduce((a, x) => a + x.vundet.length, 0),
      kuponer: spiller.filter((p) => p.guldkupon).length,
      hof: spiller.filter((p) => p.hallOfFame).length,
      licens: dk === 'aktiv' ? 'aktiv' : dk === 'ansoegt' ? 'ansoegt' : dk === 'ingen' ? 'ingen' : 'andet',
      firmaNavn: g.firmaNavn,
    };
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

    const noegle = `${L.tier}|${this.akt.id}|${this.pynt.pokaler}|${this.pynt.kuponer}|${this.pynt.hof}|${this.pynt.licens}|${g.firmaNavn}|${besat}`;
    if (noegle !== this.statiskNoegle) {
      this.statiskNoegle = noegle;
      this.bygStatisk(besat);
    }
    if (nyLayout) this.opdaterAnkre();
    this.bygHotspots(g, n);
    this.canvas.setAttribute(
      'aria-label',
      `Pixelkontoret (${L.tier === 'kaelder' ? 'kælder' : L.tier}): ${g.staff.length} af ${L.pladser.length} pladser besat. ` +
        `Pokaler: ${this.pynt.pokaler}. Guldkuponer: ${this.pynt.kuponer}. Hall of Fame: ${this.pynt.hof}.`,
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
  }

  private bygStatisk(besat: string): void {
    const L = this.layout;
    const akt = this.akt;
    for (const c of [this.bg, this.fg, this.lys, this.gloed]) {
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
    tegnGloedLag(ctx2d(this.gloed), L, akt);
    if (L.paere && !this.paereGloed) this.paereGloed = lavPaereGloed(30, '#ffd88a');
  }

  private bygHotspots(g: GameState, n: number): void {
    const L = this.layout;
    const h: Hotspot[] = [];
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
    const f = (felt: Felt, linje1: string, linje2: string, panel: PanelId | null, ekstraOp = 0) =>
      h.push({ x: felt.x, y: felt.y - ekstraOp, w: felt.w, h: felt.h + ekstraOp, plads: -1, linje1, linje2, panel });
    const pk = this.pynt;
    f(L.hylde, `GALLAPRISER: ${pk.pokaler}`, pk.pokaler ? 'FRA BRANCHEGALLAEN' : 'HYLDEN VENTER', 'firma', 9);
    f(L.kuponer, `GULDKUPONER: ${pk.kuponer}`, 'TOTAL 32+ AF 40', 'produkter');
    if (pk.hof > 0) f(L.plaketter, `HALL OF FAME: ${pk.hof}`, 'TOTAL 36+ AF 40', 'produkter');
    if (pk.licens === 'aktiv' || pk.licens === 'ansoegt') f(L.cert, pk.licens === 'aktiv' ? 'DANSK LICENS' : 'LICENS ANSØGT', pk.licens === 'aktiv' ? 'GODKENDT' : 'BEHANDLES', 'marked');
    const b = this.bedste;
    f(L.tv, b ? `TOP 10: NR. ${b.placering}` : 'TOP 10', b ? `${b.navn.toUpperCase()} · ${MARKETS[b.marked]?.kort ?? b.marked}` : 'IKKE PÅ LISTEN ENDNU', 'hitliste');
    this.hotspots = h;
  }

  // ---------- Signaler → bobler og fest ----------
  private signaler(sig: Signal[], g: GameState | null): void {
    if (!g) return;
    const nu = performance.now();
    if (g !== this.sidsteGame) this.sync(g);
    const fs = Math.max(this.layout.zoom, this.fontSkala);
    let fest = 0;
    let personIdx = 0;
    for (const s of sig) {
      switch (s.k) {
        case 'point': {
          const plads = this.pladsFor(s.staffId, g);
          if (plads < 0) break;
          const forskyd = ((this.dSeed[plads] % 97) / 97) * 0.8 + (personIdx++ % 3) * 0.1;
          this.bobler.planlaegPoint(nu, plads, s.params, s.fejl, s.fjernet, clock.ugeMs, fs, forskyd);
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
    this.bobler.opdater(nu, this.onPop);

    ctx.setTransform(z, 0, 0, z, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bg, 0, 0);
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
    ctx.drawImage(this.lys, 0, 0);
    // selvlysende: skærme, tv, neon, pære, statusikoner
    for (let k = 0; k < n; k++) this.tegnSkaerm(k, nu, red, aktivt);
    this.tegnTv(nu, red);
    if (this.akt.neon) ctx.drawImage(this.gloed, 0, 0);
    if (L.paere) this.tegnPaere(nu, red);
    for (let k = 0; k < n; k++) this.tegnStatusIkon(k, nu, red);

    // overlag i fuld opløsning: bobler og etiketter
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.max(z, this.fontSkala);
    this.bobler.loft = fs >= 2 ? 40 : 110;
    this.bobler.tegn(ctx, nu, red, CANVAS_W, 20 * fs);
    if (this.hover >= 0) this.tegnEtiket(this.fontSkala);
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
        const ph = ((nu + (seed % 400)) % 560) / 560;
        dy = -Math.round(Math.sin(ph * Math.PI) * 3);
        if (ph > 0.9) pose = POSE.landing;
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
        pose = ph >= 0.5 && ph < 0.62 ? POSE.landing : POSE.idle;
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

  private tegnSkaerm(k: number, nu: number, red: boolean, aktivt: boolean): void {
    const p = this.layout.pladser[k];
    if (!p) return;
    const ctx = this.ctx;
    const a = this.akt.skaerm;
    const sx = p.x + SKAERM.x;
    const sy = p.y + SKAERM.y;
    const status = this.dStatus[k];
    const seed = this.dSeed[k];
    const anim = aktivt && !red;
    if (this.akt.gloed && status !== INGEN) {
      ctx.fillStyle = SKAERM_GLOED;
      ctx.fillRect(sx - 2, sy - 2, SKAERM.w + 4, SKAERM.h + 4);
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
        s2: h.linje2 ? tekstSprite(afkort(h.linje2, maxW - 6 * fs, fs), h.plads >= 0 ? T.muted : T.gold, fs, { baggrund: T.bg2, kant: T.line, pad: 2 }) : null,
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
    if (h.panel) useUi.getState().setPanel(h.panel);
  };
}
