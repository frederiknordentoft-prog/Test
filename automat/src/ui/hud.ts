// DOM HUD: crisp text, a11y, regulatory strips, controls, overlays, sheets.
import './styles.css';
import { fmtKr, fmtSignedKr, fmt1, fmtInt, fmtPct, fmtOdds, fmtX } from '../core/format.ts';
import { TIERS } from '../game/tiers.ts';
import { CONFIG, REPORT } from '../math/config.ts';
import { SYM_NAMES } from '../math/types.ts';
import type { HistoryEntry, Settings } from '../game/store.ts';

export type Intent =
  | { t: 'unlock' } | { t: 'spin' } | { t: 'stakeUp' } | { t: 'stakeDown' }
  | { t: 'demo' } | { t: 'demoSuns' } | { t: 'demoKp'; kp: number } | { t: 'demoReset' }
  | { t: 'startStorm' } | { t: 'continue' } | { t: 'skip' } | { t: 'mute' } | { t: 'refill' }
  | { t: 'settings'; s: Partial<Settings> } | { t: 'fullFx' } | { t: 'menu'; open: boolean };

const ICON = {
  spin: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M38 17a15 15 0 0 0-26.5-3.5"/><path d="M11 7v7h7"/><path d="M10 31a15 15 0 0 0 26.5 3.5"/><path d="M37 41v-7h-7"/><path d="M24 17l1.8 4.2L30 23l-4.2 1.8L24 29l-1.8-4.2L18 23l4.2-1.8z" fill="currentColor" stroke="none"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L4 14h6.5L9 22l10-12.5h-6.6z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
};

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Hud {
  root: HTMLElement;
  canvasHost: HTMLElement;
  slotArc: HTMLElement;
  slotGrid: HTMLElement;
  private onIntent: (i: Intent) => void;
  private el: Record<string, HTMLElement> = {};
  private spinRingLen = 289;
  private bannerTimer = 0;
  private menuTab = 'rules';
  private historyRef: () => HistoryEntry[] = () => [];
  private settingsRef: () => Settings = () => ({ music: 0.7, sfx: 0.85, muted: false, haptics: true, calm: 'auto' });
  private kpRef: () => number = () => 0;
  private lastPress = 0;

  constructor(host: HTMLElement, onIntent: (i: Intent) => void) {
    this.onIntent = onIntent;
    host.innerHTML = '';
    this.root = host;
    this.canvasHost = h('div');
    this.canvasHost.id = 'stagehost';
    host.appendChild(this.canvasHost);

    const ui = h('div'); ui.id = 'ui';
    ui.innerHTML = `
      <header id="reg" role="banner">
        <div class="l"><b>NORDLYS</b><span class="num" id="clock" aria-label="Klokken">--:--</span><span class="hide-xs" id="regBal"></span></div>
        <div class="r"><span class="badge" id="modeBadge">NORDLYS</span><span class="badge demo">Demo<span class="long"> · legepenge</span></span></div>
      </header>
      <div id="hdr">
        <button class="pill" id="demoPill" aria-label="Udløs Solstorm – demo-værktøj der springer progressionen over. Findes ikke i den rigtige version.">
          <span class="tag">DEMO</span>${ICON.bolt}<span class="txt">Udløs Solstorm</span>
        </button>
        <div class="right">
          <button class="iconbtn" id="toolsBtn" aria-label="Demo-værktøjer">${ICON.dots}</button>
          <button class="iconbtn" id="muteBtn" aria-label="Lyd til/fra">${ICON.sound}</button>
          <button class="iconbtn" id="menuBtn" aria-label="Menu, regler og indstillinger">${ICON.menu}</button>
        </div>
      </div>
      <div class="side left" id="sideL"><div class="panel"><h4>Kp-stigen</h4><div class="ladder" id="ladderSide"></div></div></div>
      <div id="slot-arc"><button id="goal" aria-label="Kp-stigen: se hvad der sker ved hvert niveau"></button></div>
      <div id="slot-grid"></div>
      <div class="side right" id="sideR">
        <div class="panel"><h4>Gevinsttabel · ved indsats</h4><div id="payMini"></div></div>
        <div class="panel hist-panel"><h4>Seneste spin</h4><div class="hist" id="histSide"></div></div>
      </div>
      <div id="winstrip">
        <div class="bar"><div class="fill"></div><div class="mark"></div></div>
        <div class="text"><span id="winL">Held og lykke</span><span id="winR" class="num"></span></div>
      </div>
      <div id="deck">
        <div class="cell-l"><div class="lbl">Saldo</div><div class="val num" id="bal">–</div></div>
        <div class="stake">
          <div class="lbl">Indsats</div>
          <div class="row"><button class="step" id="stakeDn" aria-label="Sænk indsats">−</button><div class="val num" id="stake">–</div><button class="step" id="stakeUp" aria-label="Hæv indsats">+</button></div>
          <div class="lock num" id="lock"></div>
        </div>
        <div class="cell-r">
          <button class="spin idle" id="spinBtn" aria-label="Spin">
            <svg class="ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" id="ring" cx="50" cy="50" r="46"/></svg>
            <span class="ico">${ICON.spin}</span><span class="cap" id="spinCap">SPIN</span>
          </button>
        </div>
      </div>
      <footer id="foot">
        <span class="l">18+ · <a href="https://www.stopspillet.dk" target="_blank" rel="noopener">StopSpillet 70 22 28 25</a> · <a href="https://www.spillemyndigheden.dk/rofus" target="_blank" rel="noopener">ROFUS</a><span class="rg-extra"> · Spil ansvarligt</span></span>
        <span class="r num" id="session">Session 0 min · Netto ±0,00 kr</span>
      </footer>`;
    host.appendChild(ui);

    const ov = h('div'); ov.id = 'overlays';
    ov.innerHTML = `
      <div class="overlay" id="splash"><div class="center"><button class="btn" id="unlockBtn">Tænd himlen</button><div class="hint">Legepenge · 18+ · Lyd anbefales</div></div></div>
      <div class="overlay" id="stormReady"><div class="center"><button class="btn storm two" id="startStormBtn"><span>Start Solstormen</span><small class="num" id="stormInfo"></small></button></div></div>
      <div class="overlay" id="bigwin"><div class="center"><button class="btn ghost small" id="continueBtn">Fortsæt</button></div></div>
      <div class="overlay" id="summary"><div class="card" id="summaryCard"></div></div>
      <div id="banner" role="status"><div class="t" id="bannerT"></div><div class="s" id="bannerS"></div></div>
      <div id="notice"></div>
      <div id="calmChip" class="chip"><span>Rolig tilstand (systemindstilling)</span><button id="calmFx" class="linkbtn">Vis fuld effekt</button></div>
      <div class="sheet-wrap" id="menuWrap"><div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="grab"></div>
        <header><h3>NORDLYS</h3><button class="iconbtn" id="menuClose" aria-label="Luk">✕</button></header>
        <div class="tabs" role="tablist" id="tabs">
          <button role="tab" data-tab="rules">Regler & RTP</button><button role="tab" data-tab="pay">Gevinsttabel</button>
          <button role="tab" data-tab="ladder">Kp-stigen</button><button role="tab" data-tab="hist">Historik</button>
          <button role="tab" data-tab="settings">Indstillinger</button><button role="tab" data-tab="rg">Spil ansvarligt</button>
        </div>
        <div class="body" id="menuBody"></div>
      </div></div>
      <div class="sheet-wrap" id="drawerWrap"><div class="sheet" role="dialog" aria-modal="true" aria-label="Demo-værktøjer">
        <div class="grab"></div>
        <header><h3 style="color:#ffd79a">DEMO-VÆRKTØJER</h3><button class="iconbtn" id="drawerClose" aria-label="Luk">✕</button></header>
        <div class="body">
          <p class="chip warn">Kun til demonstration. Findes ikke i den rigtige version. Demo-storme krediteres ikke saldoen og tæller ikke i statistikken.</p>
          <div class="actions">
            <button class="btn storm small" id="dTrigger">⚡ Udløs Solstorm</button>
            <button class="btn ghost small" id="dSuns">Udløs via 4 sole</button>
          </div>
          <label class="setting"><span>Vis Kp (kun forhåndsvisning)</span><input type="range" min="0" max="8.9" step="0.1" id="dKp" aria-label="Vis Kp, kun forhåndsvisning"></label>
          <div class="actions"><button class="btn ghost small" id="dReset">Nulstil demo</button><button class="btn ghost small" id="dFx" style="display:none">Vis fuld effekt</button></div>
          <p class="hint">"Vis Kp" ændrer kun himlen og buen – din rigtige måler røres ikke. Genveje: Mellemrum = spin · E = demo · M = lyd · Esc = spring over. Direkte link til demo-stormen: tilføj <code>#solstorm</code> til adressen.</p>
        </div>
      </div></div>`;
    host.appendChild(ov);

    for (const id of ['toolsBtn', 'calmChip', 'calmFx', 'reg', 'clock', 'regBal', 'modeBadge', 'demoPill', 'muteBtn', 'menuBtn', 'goal', 'winstrip', 'winL', 'winR', 'bal', 'stake', 'stakeDn', 'stakeUp', 'lock', 'spinBtn', 'spinCap', 'ring', 'session',
      'splash', 'unlockBtn', 'stormReady', 'stormInfo', 'startStormBtn', 'bigwin', 'continueBtn', 'summary', 'summaryCard', 'banner', 'bannerT', 'bannerS', 'notice',
      'menuWrap', 'menuClose', 'menuBody', 'tabs', 'drawerWrap', 'drawerClose', 'dTrigger', 'dSuns', 'dKp', 'dReset', 'dFx', 'ladderSide', 'payMini', 'histSide']) {
      this.el[id] = document.getElementById(id)!;
    }
    this.slotArc = document.getElementById('slot-arc')!;
    this.slotGrid = document.getElementById('slot-grid')!;
    this.wire();
  }

  // ---------------- wiring ----------------
  private press(el: HTMLElement, fn: () => void): void {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      // Pointer clicks drop focus so a later Space still means "spin"; keyboard activation keeps it.
      if ((e as MouseEvent).detail > 0) el.blur();
      if (performance.now() - this.lastPress < 60) return;
      this.lastPress = performance.now();
      fn();
    });
  }
  private wire(): void {
    const I = this.onIntent;
    this.press(this.el.unlockBtn, () => I({ t: 'unlock' }));
    this.press(this.el.spinBtn, () => I({ t: 'spin' }));
    this.press(this.el.stakeUp, () => I({ t: 'stakeUp' }));
    this.press(this.el.stakeDn, () => I({ t: 'stakeDown' }));
    this.press(this.el.demoPill, () => I({ t: 'demo' }));
    this.press(this.el.toolsBtn, () => this.openDrawer(true));
    this.press(this.el.calmFx, () => I({ t: 'fullFx' }));
    this.press(this.el.drawerClose, () => this.openDrawer(false));
    this.press(this.el.dTrigger, () => { this.openDrawer(false); I({ t: 'demo' }); });
    this.press(this.el.dSuns, () => { this.openDrawer(false); I({ t: 'demoSuns' }); });
    this.press(this.el.dReset, () => { this.openDrawer(false); I({ t: 'demoReset' }); });
    this.press(this.el.dFx, () => { I({ t: 'fullFx' }); this.el.dFx.style.display = 'none'; });
    this.el.dKp.addEventListener('change', () => I({ t: 'demoKp', kp: +(this.el.dKp as HTMLInputElement).value }));
    this.press(this.el.startStormBtn, () => I({ t: 'startStorm' }));
    this.press(this.el.continueBtn, () => I({ t: 'continue' }));
    this.press(this.el.muteBtn, () => I({ t: 'mute' }));
    this.press(this.el.menuBtn, () => this.openMenu(true));
    this.press(this.el.menuClose, () => this.openMenu(false));
    this.press(this.el.goal, () => { this.menuTab = 'ladder'; this.openMenu(true); });
    this.el.menuWrap.addEventListener('click', (e) => { if (e.target === this.el.menuWrap) this.openMenu(false); });
    this.el.drawerWrap.addEventListener('click', (e) => { if (e.target === this.el.drawerWrap) this.openDrawer(false); });
    this.el.tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      this.menuTab = b.dataset.tab!;
      this.renderMenu();
    });
    this.el.summary.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b?.dataset.act === 'continue') I({ t: 'continue' });
    });
    this.el.menuBody.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.act === 'refill') I({ t: 'refill' });
      if (b.dataset.act === 'reset') { this.openMenu(false); I({ t: 'demoReset' }); }
    });
    this.el.menuBody.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const k = t.dataset.k as keyof Settings | undefined;
      if (!k) return;
      const v = t.type === 'checkbox' ? t.checked : t.tagName === 'SELECT' ? t.value : +t.value;
      I({ t: 'settings', s: { [k]: v } as Partial<Settings> });
    });
    // Keyboard: one dispatch path, ignore auto-repeat.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        // Never hijack a focused control or link (keyboard users must be able to open StopSpillet/ROFUS).
        const t = e.target as HTMLElement;
        if (t && t !== document.body && t.closest('a,button,input,select,textarea,[role="tab"],summary')) return;
        e.preventDefault();
        if (this.el.splash.classList.contains('show')) I({ t: 'unlock' });
        else if (this.el.stormReady.classList.contains('show')) I({ t: 'startStorm' });
        else if (this.el.summary.classList.contains('show') || this.el.bigwin.classList.contains('show')) I({ t: 'continue' });
        else I({ t: 'spin' });
      } else if (e.code === 'ArrowUp') I({ t: 'stakeUp' });
      else if (e.code === 'ArrowDown') I({ t: 'stakeDown' });
      else if (e.code === 'KeyM') I({ t: 'mute' });
      else if (e.code === 'KeyE') I({ t: 'demo' });
      else if (e.code === 'Escape') {
        if (this.el.menuWrap.classList.contains('show')) this.openMenu(false);
        else if (this.el.drawerWrap.classList.contains('show')) this.openDrawer(false);
        else I({ t: 'skip' });
      }
    });
    // Tap anywhere on the canvas area skips presentations.
    this.canvasHost.addEventListener('pointerdown', () => I({ t: 'skip' }));
  }

  bindRefs(refs: { history: () => HistoryEntry[]; settings: () => Settings; kp: () => number }): void {
    this.historyRef = refs.history;
    this.settingsRef = refs.settings;
    this.kpRef = refs.kp;
  }

  // ---------------- state setters ----------------
  setClock(d: Date): void { this.el.clock.textContent = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }); }
  setBalance(ore: number): void { this.el.bal.textContent = fmtKr(ore); this.el.regBal.textContent = 'Saldo ' + fmtKr(ore); }
  setStake(ore: number, canDn: boolean, canUp: boolean, locked = false): void {
    this.el.stake.textContent = fmtKr(ore);
    (this.el.stakeDn as HTMLButtonElement).disabled = !canDn || locked;
    (this.el.stakeUp as HTMLButtonElement).disabled = !canUp || locked;
  }
  setLock(text: string): void { this.el.lock.textContent = text; }
  setSession(minutes: number, netOre: number): void { this.el.session.textContent = `Session ${minutes} min · Netto ${fmtSignedKr(netOre)}`; }
  setMode(mode: 'base' | 'storm', label?: string): void {
    document.documentElement.dataset.mode = mode;
    this.el.modeBadge.textContent = label ?? (mode === 'storm' ? 'SOLSTORM' : 'NORDLYS');
    this.el.modeBadge.className = 'badge' + (mode === 'storm' ? ' storm' : '');
  }
  setMuted(m: boolean): void { this.el.muteBtn.innerHTML = m ? ICON.mute : ICON.sound; this.el.muteBtn.setAttribute('aria-pressed', String(m)); }
  setDemoEnabled(b: boolean, queued = false): void {
    (this.el.demoPill as HTMLButtonElement).disabled = !b;
    this.el.demoPill.classList.toggle('queued', queued);
  }
  pulseDemo(): void { this.el.demoPill.classList.remove('pulse'); void this.el.demoPill.offsetWidth; this.el.demoPill.classList.add('pulse'); }
  showFullFxOption(b: boolean): void { this.el.dFx.style.display = b ? '' : 'none'; }
  setDemoKp(kp: number): void { (this.el.dKp as HTMLInputElement).value = String(Math.min(8.9, kp)); }

  /** Goal chip: always points at the next REWARD (Ladet spin at Kp 3/5/7, Solstorm at Kp 9) with the neutral
   *  expected distance "≈ N spin" (responsible-gambling disclosure: an average, not a promise). */
  setGoal(kp: number, charge: number, K: number, avgSpinsTo: (targetKp: number) => number | null): void {
    const cur = Math.floor(kp);
    const reward = TIERS.find((t) => t.kp > cur && (t.perk || t.kp === 9));
    if (!reward) { this.el.goal.innerHTML = `<span class="in"><span class="kp">Kp 9 · G5</span><span class="sep">·</span><b>SOLSTORM</b></span>`; return; }
    const need = Math.max(0, Math.ceil(reward.frac * K - charge));
    const what = reward.kp === 9 ? 'Solstorm' : 'Ladet spin';
    const n = avgSpinsTo(reward.kp);
    this.el.goal.innerHTML = `<span class="in"><span class="kp">Kp ${fmt1(kp)}</span><span class="sep">·</span>${what} ved <b>Kp ${reward.kp}</b>${n ? `<span class="sep">·</span><span class="num">≈ ${fmtInt(n)} spin</span>` : ''}<span class="lab"><span class="sep">·</span><span class="num">${fmtInt(need)} ladning</span></span><span class="chev" aria-hidden="true">›</span></span>`;
  }

  /** Storm status in the goal chip (replaces the Kp goal while Solstorm runs). */
  setStormGoal(spin: number, total: number, maxMark: number, winOre: number, stakeOre: number, demo = false): void {
    this.el.goal.innerHTML = `<span class="in"><span class="kp">${demo ? 'DEMO · ' : ''}SOLSTORM</span><span class="sep">·</span>Stormspin <b class="num">${spin}/${total}</b><span class="sep">·</span>Højeste mærke <b class="num">×${maxMark}</b><span class="lab"><span class="sep">·</span><span class="num">${fmtKr(winOre)} (${fmtX(winOre / stakeOre)})</span></span></span>`;
  }
  setSplash(b: boolean): void { document.documentElement.classList.toggle('splash', b); }

  /** Netto-linje. fraction of 3× stake; marker at 1×. */
  setWin(totalOre: number, stakeOre: number, profile: 'win' | 'return' | 'push' | 'none' | 'live', label?: string, paidOre: number = stakeOre): void {
    const ws = this.el.winstrip;
    const fill = ws.querySelector('.fill') as HTMLElement;
    const f = Math.min(1, totalOre / (stakeOre * 3));
    fill.style.width = (f * 100).toFixed(2) + '%';
    const crossed = totalOre > stakeOre;
    ws.classList.toggle('win', crossed && profile !== 'return');
    if (label !== undefined) { this.el.winL.textContent = label; this.el.winR.textContent = ''; return; }
    if (profile === 'none') { this.el.winL.textContent = 'Ingen gevinst'; this.el.winR.textContent = ''; return; }
    if (profile === 'return') {
      this.el.winL.innerHTML = `Retur <span class="amt num">${fmtKr(totalOre)}</span>`;
      this.el.winR.textContent = `netto ${fmtSignedKr(totalOre - paidOre)}`;
      return;
    }
    if (profile === 'push') { this.el.winL.innerHTML = `Indsats retur <span class="amt num">${fmtKr(totalOre)}</span>`; this.el.winR.textContent = 'netto ±0,00 kr'; return; }
    this.el.winL.innerHTML = `Gevinst <span class="amt num">${fmtKr(totalOre)}</span>`;
    this.el.winR.textContent = paidOre === 0 ? 'gratis spin' : `netto ${fmtSignedKr(totalOre - paidOre)}`;
  }
  clearWin(text = ''): void { this.setWin(0, 1, 'none', text); }
  flashNetto(): void { const ws = this.el.winstrip; ws.classList.remove('cross'); void ws.offsetWidth; ws.classList.add('cross'); }

  setSpin(state: 'idle' | 'busy' | 'perk' | 'disabled' | 'storm', cap?: string): void {
    const b = this.el.spinBtn as HTMLButtonElement;
    b.classList.toggle('idle', state === 'idle' || state === 'perk' || state === 'storm');
    b.classList.toggle('busy', state === 'busy');
    b.classList.toggle('perk', state === 'perk');
    // 'disabled' = balance below stake: the button stays pressable and the game answers with "Fyld op".
    b.classList.toggle('low', state === 'disabled');
    this.el.spinCap.textContent = cap ?? (state === 'perk' ? 'LADET SPIN' : state === 'disabled' ? 'FYLD OP' : 'SPIN');
    b.setAttribute('aria-label', state === 'perk' ? 'Ladet spin (gratis)' : state === 'disabled' ? 'Saldoen er for lav. Fyld op med legepenge' : 'Spin');
  }
  /** 3-second floor ring: 0..1 */
  setRing(p: number): void { (this.el.ring as unknown as SVGCircleElement).style.strokeDashoffset = String(this.spinRingLen * (1 - Math.max(0, Math.min(1, p)))); }

  banner(title: string, sub = '', tone: 'aurora' | 'storm' = 'aurora', ms = 2600): void {
    this.el.bannerT.textContent = title;
    this.el.bannerS.textContent = sub;
    this.el.banner.classList.toggle('storm', tone === 'storm');
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.el.banner.classList.remove('show'), ms);
  }
  notice(html: string | null): void {
    this.el.notice.innerHTML = html ?? '';
    this.el.notice.classList.toggle('show', !!html);
  }

  show(id: 'splash' | 'stormReady' | 'bigwin' | 'summary', b: boolean): void { this.el[id].classList.toggle('show', b); }
  isShown(id: 'splash' | 'stormReady' | 'bigwin' | 'summary'): boolean { return this.el[id].classList.contains('show'); }
  setStormInfo(text: string): void { this.el.stormInfo.textContent = text; }
  showSummary(html: string, tone: 'storm' | 'base' = 'storm'): void {
    this.el.summaryCard.className = 'card' + (tone === 'base' ? ' base' : '');
    this.el.summaryCard.innerHTML = html;
    this.show('summary', true);
    setTimeout(() => (this.el.summaryCard.querySelector('button') as HTMLButtonElement | null)?.focus(), 400);
  }

  openMenu(b: boolean): void {
    if (b) this.renderMenu();
    this.el.menuWrap.classList.toggle('show', b);
    this.onIntent({ t: 'menu', open: b });
    if (b) setTimeout(() => this.el.menuClose.focus(), 50); else this.el.menuBtn.focus({ preventScroll: true });
  }
  openDrawer(b: boolean): void {
    this.el.drawerWrap.classList.toggle('show', b);
    this.onIntent({ t: 'menu', open: b });
    if (b) setTimeout(() => this.el.drawerClose.focus(), 50); else this.el.toolsBtn.focus({ preventScroll: true });
  }
  setCalmChip(b: boolean): void { this.el.calmChip.classList.toggle('show', b); }
  menuOpen(): boolean { return this.el.menuWrap.classList.contains('show') || this.el.drawerWrap.classList.contains('show'); }

  // ---------------- side panels (desktop) ----------------
  refreshSide(stakeOre: number, storm = false): void {
    this.el.ladderSide.innerHTML = this.ladderHtml();
    this.el.payMini.innerHTML = this.payMiniHtml(stakeOre, storm);
    (this.el.payMini.previousElementSibling as HTMLElement).textContent = storm ? 'Solstorm · gevinst før mærker' : 'Gevinsttabel · ved indsats';
    this.el.histSide.innerHTML = this.histHtml(8);
  }

  // ---------------- menu content ----------------
  private renderMenu(): void {
    this.el.tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.menuTab)));
    const body = this.el.menuBody;
    const st = this.settingsRef();
    switch (this.menuTab) {
      case 'rules': body.innerHTML = this.rulesHtml(); break;
      case 'pay': body.innerHTML = this.payHtml(); break;
      case 'ladder': body.innerHTML = `<p>Nordlyset viser dit fremskridt. Knuste symboler giver ladning (lav krystal 1, høj 2, WILD 3, 3 sole +${CONFIG.sunCharge}). Ladet spin ved Kp 3, 5 og 7 · Solstorm ved Kp 9. Tallene til højre er det gennemsnitlige antal spin fra Kp 0.</p><p class="hint">Dit fremskridt gemmes i 365 dage efter dit sidste spin.</p><div class="ladder">${this.ladderHtml()}</div>`; break;
      case 'hist': body.innerHTML = `<p>De seneste 100 spin. Hvert spin kan genskabes præcist ud fra sit Spil-ID og den gemte tilstand før spinnet.</p><div class="hist"><div class="h head"><span>Spil-ID</span><span>Gevinst</span><span>Netto</span></div>${this.histHtml(100)}</div>`; break;
      case 'settings': body.innerHTML = `
        <label class="setting"><span>Musik</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-k="music" id="setMusic"></label>
        <label class="setting"><span>Lydeffekter</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-k="sfx" id="setSfx"></label>
        <label class="setting"><span>Lyd slået fra</span><input type="checkbox" ${st.muted ? 'checked' : ''} data-k="muted" id="setMuted"></label>
        <label class="setting"><span>Haptik (Android)</span><input type="checkbox" ${st.haptics ? 'checked' : ''} data-k="haptics" id="setHaptics"></label>
        <label class="setting"><span>Rolig tilstand</span><select data-k="calm" id="setCalm"><option value="auto" ${st.calm === 'auto' ? 'selected' : ''}>Følg system</option><option value="on" ${st.calm === 'on' ? 'selected' : ''}>Til</option><option value="off" ${st.calm === 'off' ? 'selected' : ''}>Fra</option></select></label>
        <p class="hint">Rolig tilstand fjerner rystelser, blink, kromatiske effekter og glasskår og bruger bløde overgange i stedet.</p>
        <div class="actions"><button class="btn ghost small" data-act="refill">Fyld op (legepenge)</button><button class="btn ghost small" data-act="reset">Nulstil demo</button></div>`; break;
      case 'rg': body.innerHTML = `
        <h4>Spil med omtanke</h4>
        <p>Dette er en <b>demo med legepenge</b>. Der kan ikke indbetales, vindes eller tabes rigtige penge.</p>
        <p>Spil aldrig for mere, end du har råd til at tabe. Sæt grænser for tid og penge, og hold pauser.</p>
        <p>Rådgivning: <a href="https://www.stopspillet.dk" target="_blank" rel="noopener">StopSpillet 70 22 28 25</a> · Udelukkelse: <a href="https://www.spillemyndigheden.dk/rofus" target="_blank" rel="noopener">ROFUS</a>.</p>
        <h4>Designprincipper</h4>
        <p>Mindst 3,0 s pr. spin · ingen turbo, autoplay eller køb af bonus · resultater under indsatsen fejres ikke · ingen konstruerede "næsten"-resultater · sessionstid og netto vises altid.</p>`; break;
    }
  }

  private rulesHtml(): string {
    const R = REPORT, C = CONFIG;
    return `
      <h4>Sådan spiller du</h4>
      <p>${C.cols}×${C.rows} felter. <b>5 eller flere</b> ens symboler, der hænger sammen vandret eller lodret, giver gevinst. Nordlysbuen (WILD) erstatter alle symboler undtagen Solen og kan indgå i flere klynger.</p>
      <h4>Isskred</h4>
      <p>Vindende symboler knuses, resten falder ned, og nye falder ind ovenfra. Det fortsætter, så længe der er nye gevinster.</p>
      <h4>Frostmærker</h4>
      <p>Et felt, der indgår i en gevinst, bliver frosset. Næste gevinst på feltet giver ×2, derefter ×4, ×8 op til ×${C.baseMarkCap}. En klynges gevinst ganges med summen af mærker på ×2 eller mere i klyngen. Mærker gælder inden for ét spin. En vindende WILD hopper to mærketrin.</p>
      <h4>Ladning og Kp</h4>
      <p>Knuste symboler giver ladning (lav krystal 1, høj 2, WILD 3). Ladningen gemmes i <b>365 dage efter dit sidste spin</b> og nulstilles derefter. Ved Kp 3, 5 og 7 får du et <b>Ladet spin</b>: et gratis spin ved låst indsats med 4 felter på ×2.</p>
      <p><b>Låst indsats</b> = gennemsnittet af de indsatser, ladningen er optjent med (vægtet efter ladning). Det bruges til Ladede spin og Solstorm via Kp 9, så det ikke kan betale sig at skifte indsats.</p>
      <h4>Solen</h4>
      <p>Solen lander kun i første fald, højst én pr. kolonne. 3 sole betaler ${C.sunPayX}× indsats og giver +${C.sunCharge} ladning. 4 eller flere sole udløser Solstorm. Når 3 sole er synlige, og der er kolonner tilbage, lander de resterende kolonner langsommere (fast regel).</p>
      <h4>SOLSTORM · G5 EKSTREM</h4>
      <p>Udløses ved Kp 9 (ved låst indsats; måleren nulstilles) eller ved 4+ sole (ved spinnets indsats; måleren bevares). Begge på én gang giver én storm ved spinnets indsats.</p>
      <p>${C.stormSpins} gratis stormspin på ${C.stormCols}×${C.stormRows}. Stormen starter med ${C.stormStartMarks} felter på ×2. Plasmamærker bevares hele stormen og går op til ×${C.stormMarkCap}. Før hvert 4. stormspin fordobler en Stormbølge alle mærker på ×2 eller mere. 3+ sole giver +${C.retriggerSpins} stormspin (højst ${C.maxStormSpins}). <b>I Solstorm udbetaler klynger ${fmtPct(C.stormPayScale, 2)} af gevinsttabellen (før mærker)</b> – det er plasmamærkerne, der bærer gevinsten. Sole i stormen udbetaler ikke. Stormgaranti: mindst ${C.guaranteeX}× indsats, vist på en separat linje. Der optjenes ikke ladning under Solstorm.</p>
      <h4>Tal</h4>
      <div class="kv num">
        <span>Tilbagebetaling (RTP), samlet</span><span>${fmtPct(R.rtp)} ± ${fmtPct(R.rtpCi95, 2)}</span>
        <span>Heraf Solstorm (Kp 9 + 4 sole)</span><span>${fmtPct(R.stormARtp + R.stormBRtp)}</span>
        <span>Heraf Ladede spin</span><span>${fmtPct(R.perkRtp)}</span>
        <span>Minimum-RTP uden gemt fremskridt</span><span>${fmtPct(R.rtpMin)}</span>
        <span>Basisspil (klynger + sole)</span><span>${fmtPct(R.baseSpinRtp)}</span>
        <span>Pr. stormspin (gennemsnit)</span><span>${fmt1(R.perStormSpinRtp)}× indsats</span>
        <span>Gevinst over indsatsen</span><span>${fmtPct(R.netWinRate, 1)} af spin</span>
        <span>Gevinst (alle, inkl. retur)</span><span>${fmtPct(R.hitRate, 1)} af spin</span>
        <span>Solstorm i alt</span><span>ca. ${fmtOdds(R.stormRate)}</span>
        <span>· via Kp 9</span><span>ca. ${fmtOdds(R.routeARate)}</span>
        <span>· via 4+ sole</span><span>ca. ${fmtOdds(R.routeBRate)}</span>
        <span>Gns. spin til Kp 9</span><span>ca. ${fmtInt(R.avgSpinsToKp9)}</span>
        <span>Solstorm, gennemsnit</span><span>${fmtX(R.stormMeanX)}</span>
        <span>Solstorm, median / P90</span><span>${fmtX(R.stormP50X)} / ${fmtX(R.stormP90X)}</span>
        <span>Mindste klyngegevinst</span><span>${fmtX(R.minWinX)} indsats</span>
        <span>Maks. gevinst</span><span>${fmtInt(C.maxWinX)}× indsats</span>
        <span>Volatilitet</span><span>lav i basisspillet, høj i Solstorm</span>
        <span>Matematikmodel</span><span>v1 · ${C.modelHash.slice(0, 8)}</span>
      </div>
      <p class="hint">Alle tal kommer fra Monte Carlo-simulering (${fmtInt(R.spinsSimulated)} basisspin, ${fmtInt(R.stormsSimulated)} storme). RTP er et langsigtet gennemsnit; enkelte sessioner varierer.</p>`;
  }

  private payHtml(): string {
    const C = CONFIG;
    const heads = ['5', '6', '7', '8', '9–10', '11–12', '13–15', '16+'];
    const table = (scale: number, dec: number) => {
      let t = `<div style="overflow-x:auto"><table class="num"><tr><th>Symbol</th>${heads.map((x) => `<th>${x}</th>`).join('')}</tr>`;
      for (let s = 6; s >= 0; s--) {
        t += `<tr><td>${SYM_NAMES[s]}</td>${C.paytable[s].map((v) => `<td>${new Intl.NumberFormat('da-DK', { maximumFractionDigits: dec }).format(v * scale)}</td>`).join('')}</tr>`;
      }
      return t + '</table></div>';
    };
    return `<h4>Basisspil</h4><p>Gevinst i × indsats efter klyngestørrelse (før mærker).</p>${table(C.payScale, 1)}
      <p>Solen: 3 sole = ${C.sunPayX}× indsats. 4+ sole = Solstorm.</p>
      <h4>Solstorm</h4><p>I stormen udbetaler klynger ${fmtPct(C.stormPayScale, 2)} af tabellen ovenfor, før plasmamærker.</p>${table(C.payScale * C.stormPayScale, 2)}`;
  }
  private payMiniHtml(stakeOre: number, storm = false): string {
    const C = CONFIG;
    const k = C.payScale * (storm ? C.stormPayScale : 1);
    const rows = [6, 5, 4, 3, 0].map((s) => `<tr><td>${SYM_NAMES[s]}</td><td>${fmtKr(Math.round(C.paytable[s][0] * k * stakeOre))}</td><td>${fmtKr(Math.round(C.paytable[s][7] * k * stakeOre))}</td></tr>`).join('');
    return `<table class="num" style="width:100%;font-size:12px;border-collapse:collapse"><tr style="color:var(--muted)"><td></td><td>5</td><td>16+</td></tr>${rows}</table>`;
  }
  private ladderHtml(): string {
    const kp = this.kpRef();
    return TIERS.filter((t) => t.kp > 0).map((t) => {
      const cls = kp >= t.kp ? 'on' : Math.floor(kp) + 1 === t.kp ? 'next' : '';
      const spins = REPORT.kpMeanSpins?.[t.kp - 1];
      return `<div class="r ${cls}"><span class="k">Kp ${t.kp}</span><span><span class="c">${t.change}</span><br><span class="g">${t.gName ? t.gName + ' · ' : ''}${t.name}</span></span><span class="g num">${spins ? '≈ ' + fmtInt(Math.round(spins)) + ' spin' : ''}</span></div>`;
    }).reverse().join('');
  }
  private histHtml(n: number): string {
    const hs = this.historyRef().slice(-n).reverse();
    if (!hs.length) return '<p class="hint">Ingen spin endnu.</p>';
    const modeName: Record<string, string> = { perk: 'Ladet spin', storm: 'Solstorm', demo: 'Demo' };
    return hs.map((e) => `<div class="h"><span class="id">${e.spinId}${e.mode !== 'base' ? ' · ' + (modeName[e.mode] ?? e.mode) : ''}${e.spinId.endsWith('-G') ? ' · garanti' : ''}</span><span class="num ${e.netOre > 0 ? 'pos' : 'neg'}">${fmtKr(e.winOre)}</span><span class="num ${e.netOre > 0 ? 'pos' : 'neg'}">${fmtSignedKr(e.netOre)}</span></div>`).join('');
  }
}
