// DOM HUD: crisp text, a11y, regulatory strips, controls, overlays, sheets.
import './styles.css';
import { fmtKr, fmtSignedKr, fmt1, fmtInt, fmtPct, fmtOdds, fmtX } from '../core/format.ts';
import { TIERS } from '../game/tiers.ts';
import { CONFIG, REPORT } from '../math/config.ts';
import { SYM_NAMES } from '../math/types.ts';
import type { HistoryEntry, Settings } from '../game/store.ts';
import { kpLegendSvg, stormShardsSvg, type WelcomeCopy } from './welcome.ts';
import { PREVIEW_STEPS, type DiceView, type PreviewStep } from '../game/dice.ts';
import { MENU, DRAWER, DEMO_PILL, TIPS, GAMBLE_LOG, gambleLogRows, diceRulesHtml } from './diceCopy.ts';
import { AUTO } from './autoCopy.ts';
import { AUTO_COUNTS, autoLimits, type AutoStop } from '../game/auto.ts';
import type { GambleLogEntry } from '../game/dice.ts';
import { onDiePainterChange, paintDieIcons } from './diceIcon.ts';
import { ChamberDom, chamberMarkup } from './chamber.ts';
import { Vault, vaultMarkup } from './vault.ts';

export type Intent =
  | { t: 'unlock' } | { t: 'spin' } | { t: 'stakeUp' } | { t: 'stakeDown' }
  | { t: 'demo' } | { t: 'demoSuns' } | { t: 'demoKp'; kp: number } | { t: 'demoReset' }
  | { t: 'startStorm' } | { t: 'continue' } | { t: 'skip' } | { t: 'mute' } | { t: 'refill' }
  | { t: 'settings'; s: Partial<Settings> } | { t: 'fullFx' } | { t: 'menu'; open: boolean }
  // Terningen
  | { t: 'chamber'; open: boolean; key?: boolean } | { t: 'gateOpen' } | { t: 'gateReplay' }
  | { t: 'diceCard'; act: 'ok' | 'chamber' | 'gate' | 'later' } | { t: 'hello'; act: 'close' | 'chamber' }
  | { t: 'placard'; act: 'chamber' | 'back' | 'endDemo' | 'close' }
  | { t: 'demoDie' } | { t: 'demoFirstDie' } | { t: 'demoGate' } | { t: 'demoChamber'; n: PreviewStep }
  // Kvit eller dobbelt, autospin
  | { t: 'gamble'; act: 'keep' | 'double' | 'triple' } | { t: 'demoGamble' }
  | { t: 'autoSheet'; open: boolean } | { t: 'autoStart'; spins: number; lossLimitOre: number } | { t: 'autoStop' };

const ICON = {
  spin: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M38 17a15 15 0 0 0-26.5-3.5"/><path d="M11 7v7h7"/><path d="M10 31a15 15 0 0 0 26.5 3.5"/><path d="M37 41v-7h-7"/><path d="M24 17l1.8 4.2L30 23l-4.2 1.8L24 29l-1.8-4.2L18 23l4.2-1.8z" fill="currentColor" stroke="none"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L4 14h6.5L9 22l10-12.5h-6.6z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  stop: '<svg class="stop" viewBox="0 0 48 48" fill="currentColor"><rect x="14" y="14" width="20" height="20" rx="4.5"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5l3 3-3 3"/><path d="M4 11.5v-1a4 4 0 0 1 4-4h12"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 12.5v1a4 4 0 0 1-4 4H4"/></svg>',
};
/** A die icon canvas (painted with the user's die by paintDieIcons; the coded die only if the art cannot decode). */
const DIE = (cls = '', frozen = false) => `<canvas class="die-ico${cls ? ' ' + cls : ''}"${frozen ? ' data-state="frozen"' : ''} aria-hidden="true"></canvas>`;

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
  private settingsRef: () => Settings = () => ({ music: 0.7, sfx: 0.85, muted: false, haptics: true, calm: 'auto', musicSource: 'polar', dice: true, gambleOffers: true });
  private kpRef: () => number = () => 0;
  private diceRef: () => DiceView = () => ({ count: 0, unlock: 'none', mode: 'real' });
  private gambleLogRef: () => { log: readonly GambleLogEntry[]; open: string | null } = () => ({ log: [], open: null });
  /** Terningekammeret DOM (text + state; the gate art is the presenter's). */
  chamber!: ChamberDom;
  /** Terningenichen: the dice home (the die, its count, its idle life and the landing catch). */
  vault!: Vault;
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
        <div class="pill" id="demoPill" role="group" aria-label="Demo-værktøjer">
          <button class="pseg" id="demoStorm" aria-label="Udløs Solstorm – demo-værktøj der springer progressionen over. Findes ikke i den rigtige version." title="${TIPS.demoStorm}"><span class="tag">DEMO</span>${ICON.bolt}<span class="txt">Solstorm</span></button>
          <span class="sep" aria-hidden="true"></span>
          <button class="pseg" id="demoDieSeg" aria-label="${DEMO_PILL.dieAria}" title="${TIPS.demoDie}">${DIE('pill-die')}<span class="txt">${DEMO_PILL.die}</span></button>
        </div>
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
          <div class="spin-col">
            ${vaultMarkup()}
            <button class="spin idle" id="spinBtn" aria-label="Spin" title="Spin (mellemrum)">
              <span class="aur" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i></span>
              <svg class="ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="46"/><circle class="fg" id="ring" cx="50" cy="50" r="46"/></svg>
              <span class="face"><span class="ico">${ICON.spin}${ICON.stop}</span><span class="cap" id="spinCap">SPIN</span></span>
            </button>
          </div>
          <button class="auto-pill" id="autoBtn" aria-label="${AUTO.pillAria}" title="${AUTO.pillTitle}"><span class="ap-face"><span class="ap-ico" aria-hidden="true">${ICON.loop}${ICON.stop}</span><span class="ap-t" id="autoTxt">${AUTO.pill}</span></span></button>
        </div>
      </div>
      <footer id="foot">
        <span class="l">18+ · <a href="https://www.stopspillet.dk" target="_blank" rel="noopener">StopSpillet 70 22 28 25</a> · <a href="https://www.spillemyndigheden.dk/rofus" target="_blank" rel="noopener">ROFUS</a><span class="rg-extra"> · Spil ansvarligt</span></span>
        <span class="r num" id="session">Session 0 min · Netto ±0,00 kr</span>
      </footer>`;
    host.appendChild(ui);

    const ov = h('div'); ov.id = 'overlays';
    ov.innerHTML = `
      <div class="overlay" id="splash"><section id="welcome" aria-labelledby="wEyebrow"><div class="w-block"><div class="w-scrim" aria-hidden="true"></div><p id="wEyebrow" class="w-eb" aria-hidden="true"></p><p id="wBody" class="w-body" aria-hidden="true"></p><div id="wLegend" class="w-legend" aria-hidden="true"></div><p id="wSum" class="sr" aria-hidden="true"></p></div></section><div class="center"><button class="btn" id="unlockBtn" aria-describedby="wSum">Tænd himlen</button><div class="hint">Legepenge · 18+ · Lyd anbefales</div></div></div>
      <div class="overlay" id="stormReady"><div class="center"><button class="btn storm two" id="startStormBtn"><span>Start Solstormen</span><small class="num" id="stormInfo"></small></button></div></div>
      <div class="overlay" id="bigwin"><div class="center"><button class="btn ghost small" id="continueBtn">Fortsæt</button></div></div>
      <div class="overlay" id="summary"><div class="card" id="summaryCard"></div></div>
      <div id="banner" role="status"><div class="t" id="bannerT"></div><div class="s" id="bannerS"></div>${DIE('b-die')}</div>
      <section id="hello" role="dialog" aria-modal="false" aria-labelledby="helloTitle" hidden></section>
      ${chamberMarkup(ICON.sound)}
      <div id="notice"></div>
      <div id="calmChip" class="chip"><span>Rolig tilstand (systemindstilling)</span><button id="calmFx" class="linkbtn">Vis fuld effekt</button></div>
      <div class="sheet-wrap" id="menuWrap"><div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="grab"></div>
        <header><h3>NORDLYS</h3><button class="iconbtn" id="menuClose" aria-label="Luk">✕</button></header>
        <div class="tabs" role="tablist" id="tabs">
          <button role="tab" data-tab="rules">Regler & RTP</button><button role="tab" data-tab="pay">Gevinsttabel</button>
          <button role="tab" data-tab="ladder">Kp-stigen</button><button role="tab" data-tab="dice">${DIE('tab-die')}${MENU.tab}</button><button role="tab" data-tab="hist">Historik</button>
          <button role="tab" data-tab="settings">Indstillinger</button><button role="tab" data-tab="rg">Spil ansvarligt</button>
        </div>
        <div class="body" id="menuBody"></div>
      </div></div>
      <div class="sheet-wrap" id="drawerWrap"><div class="sheet" role="dialog" aria-modal="true" aria-label="Demo-værktøjer">
        <div class="grab"></div>
        <header><h3 style="color:#ffd79a">DEMO-VÆRKTØJER</h3><button class="iconbtn" id="drawerClose" aria-label="Luk">✕</button></header>
        <div class="body">
          <p class="chip warn">${DRAWER.warn}</p>
          <div class="actions">
            <button class="btn storm small" id="dTrigger">⚡ Udløs Solstorm</button>
            <button class="btn ghost small" id="dSuns">Udløs via 4 sole</button>
          </div>
          <label class="setting"><span>Vis Kp (kun forhåndsvisning)</span><input type="range" min="0" max="8.9" step="0.1" id="dKp" aria-label="Vis Kp, kun forhåndsvisning"></label>
          <div class="d-dice"><h4>${DRAWER.h}</h4>
            <div class="actions"><button class="btn ghost small" id="dGamble">${DRAWER.gamble}</button><button class="btn ghost small" id="dDie">${DRAWER.die}</button><button class="btn ghost small" id="dFirst">${DRAWER.first}</button><button class="btn ghost small" id="dGate">${DRAWER.gate}</button></div>
            <p class="seg-lbl" id="dSegL">${DRAWER.segLabel}</p>
            <div class="seg" id="dSeg" role="group" aria-label="${DRAWER.segAria}">${PREVIEW_STEPS.map((n) => `<button class="btn ghost small" data-n="${n}" aria-pressed="false">${DRAWER.seg(n)}</button>`).join('')}</div>
          </div>
          <div class="actions"><button class="btn ghost small" id="dReset">Nulstil demo</button><button class="btn ghost small" id="dFx" style="display:none">Vis fuld effekt</button></div>
          <p class="hint">${DRAWER.hintHtml}</p>
        </div>
      </div></div>
      <div class="sheet-wrap" id="autoWrap"><div class="sheet auto-sheet" id="autoSheet" role="dialog" aria-modal="true" aria-labelledby="autoTitle">
        <header><h3 id="autoTitle"><span class="ap-ico" aria-hidden="true">${ICON.loop}</span>${AUTO.title}</h3><button class="iconbtn" id="autoClose" aria-label="${AUTO.close}">✕</button></header>
        <div class="body">
          <p class="seg-lbl" id="autoNL">${AUTO.spinsLabel}</p>
          <div class="seg segd" id="autoN" role="group" aria-labelledby="autoNL">${AUTO_COUNTS.map((n) => `<button class="sg num" data-n="${n}" aria-pressed="false">${n}</button>`).join('')}</div>
          <p class="seg-lbl" id="autoLL">${AUTO.limitLabel}</p>
          <div class="seg segd" id="autoL" role="group" aria-labelledby="autoLL"></div>
          <p class="hint" id="autoHint"></p>
          <button class="btn auto-go" id="autoGo">${AUTO.start}</button>
        </div>
      </div></div>`;
    host.appendChild(ov);

    for (const id of ['toolsBtn', 'calmChip', 'calmFx', 'reg', 'clock', 'regBal', 'modeBadge', 'demoPill', 'muteBtn', 'menuBtn', 'goal', 'winstrip', 'winL', 'winR', 'bal', 'stake', 'stakeDn', 'stakeUp', 'lock', 'spinBtn', 'spinCap', 'ring', 'session',
      'splash', 'welcome', 'wEyebrow', 'wBody', 'wLegend', 'wSum', 'unlockBtn', 'stormReady', 'stormInfo', 'startStormBtn', 'bigwin', 'continueBtn', 'summary', 'summaryCard', 'banner', 'bannerT', 'bannerS', 'notice',
      'menuWrap', 'menuClose', 'menuBody', 'tabs', 'drawerWrap', 'drawerClose', 'dTrigger', 'dSuns', 'dKp', 'dReset', 'dFx', 'ladderSide', 'payMini', 'histSide',
      'hello', 'dDie', 'dFirst', 'dGate', 'dSeg', 'deck',
      'demoStorm', 'demoDieSeg', 'dGamble', 'autoBtn', 'autoTxt', 'autoWrap', 'autoSheet', 'autoClose', 'autoN', 'autoL', 'autoHint', 'autoGo']) {
      this.el[id] = document.getElementById(id)!;
    }
    this.vault = new Vault(ui);
    this.vault.mount();
    this.chamber = new ChamberDom(ov);
    // a closed sheet is only transparent: inert keeps its buttons out of the Tab order (openMenu/openDrawer lift it)
    this.el.menuWrap.inert = this.el.drawerWrap.inert = this.el.autoWrap.inert = true;
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
    this.press(this.el.demoStorm, () => I({ t: 'demo' }));
    this.press(this.el.demoDieSeg, () => I({ t: 'demoGamble' }));
    this.press(this.el.dGamble, () => { this.openDrawer(false); I({ t: 'demoGamble' }); });
    // autospin: the pill opens the sheet (the Game allows it from idle only) or, while a run is on, stops it
    this.press(this.el.autoBtn, () => I(this.autoOn ? { t: 'autoStop' } : { t: 'autoSheet', open: true }));
    this.press(this.el.autoClose, () => this.openAutoSheet(false));
    this.el.autoWrap.addEventListener('click', (e) => { if (e.target === this.el.autoWrap) this.openAutoSheet(false); });
    this.el.autoN.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) { this.autoPick.n = +b.dataset.n!; this.renderAutoSheet(); }
    });
    this.el.autoL.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) { this.autoPick.l = +b.dataset.l!; this.renderAutoSheet(); }
    });
    this.press(this.el.autoGo, () => {
      const { n, l } = this.autoPick;
      this.openAutoSheet(false);
      I({ t: 'autoStart', spins: n, lossLimitOre: l });
    });
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
    // Kvit eller dobbelt: a keyboard activation of Behold (Space/Enter: click.detail 0) goes the habit-key way (keep
    // only, after 1,0 s); a tap on the card itself means nothing while choosing and skips the result hold
    this.el.summary.addEventListener('click', (e) => {
      if (!this.el.summaryCard.classList.contains('gamble')) return;
      const act = (e.target as HTMLElement).closest('button')?.dataset.gamble;
      if (act === 'keep' && e.detail === 0) I({ t: 'continue' });
      else if (act === 'keep' || act === 'double' || act === 'triple') I({ t: 'gamble', act });
      else if (this.el.summaryCard.contains(e.target as Node)) I({ t: 'skip' });
    });
    this.el.summary.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      const act = b?.dataset.act;
      if (!act) return;
      const card = this.el.summaryCard.classList;
      if (card.contains('gamble')) return;
      if (card.contains('placard')) I({ t: 'placard', act: act as 'chamber' | 'back' | 'endDemo' | 'close' });
      else if (card.contains('relic')) I({ t: 'diceCard', act: act as 'ok' | 'chamber' | 'gate' | 'later' });
      else if (act === 'continue') I({ t: 'continue' });
    });
    this.el.menuBody.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      if (b.dataset.act === 'refill') I({ t: 'refill' });
      if (b.dataset.act === 'reset') { this.openMenu(false); I({ t: 'demoReset' }); }
      if (b.dataset.act === 'chamber') { this.openMenu(false); if (!this.chamber.isShown()) I({ t: 'chamber', open: true }); }
    });
    // Terningen: the niche (and its desktop link), drawer tools, hello card, chamber buttons
    const openChamber = () => I({ t: 'chamber', open: true });
    this.press(this.vault.btn, openChamber);
    this.press(this.vault.link, openChamber);
    this.press(this.el.dDie, () => { this.openDrawer(false); I({ t: 'demoDie' }); });
    this.press(this.el.dFirst, () => { this.openDrawer(false); I({ t: 'demoFirstDie' }); });
    this.press(this.el.dGate, () => { this.openDrawer(false); I({ t: 'demoGate' }); });
    this.el.dSeg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      this.el.dSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.openDrawer(false);
      I({ t: 'demoChamber', n: +b.dataset.n! as PreviewStep });
    });
    this.el.hello.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.hello;
      if (a === 'close' || a === 'chamber') I({ t: 'hello', act: a });
    });
    const ch = this.chamber.el;
    const chb = (id: string, f: () => void) => this.press(ch.querySelector('#' + id) as HTMLElement, f);
    chb('chClose', () => I({ t: 'chamber', open: false }));
    chb('chDone', () => I({ t: 'chamber', open: false }));
    chb('chOpen', () => I({ t: 'gateOpen' }));
    chb('chReplay', () => I({ t: 'gateReplay' }));
    chb('chMute', () => I({ t: 'mute' }));
    chb('chRules', () => { this.menuTab = 'dice'; this.openMenu(true); });
    // ceremony: a tap anywhere on the chamber skips (the Game allows it from 2,0 s)
    ch.addEventListener('pointerdown', () => { if (document.documentElement.classList.contains('ceremony')) I({ t: 'skip' }); });
    onDiePainterChange(() => this.paintDiceIcons());
    window.addEventListener('resize', () => { this.paintDiceIcons(); this.placeHello(); this.chamber.place(); this.fitPlacard(); this.fitGamble(); this.placeAutoSheet(); });
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
      } else if (e.code === 'ArrowUp') { if (!this.menuOpen()) I({ t: 'stakeUp' }); } // never behind a sheet (autospin limits)
      else if (e.code === 'ArrowDown') { if (!this.menuOpen()) I({ t: 'stakeDown' }); }
      else if (e.code === 'KeyM') I({ t: 'mute' });
      else if (e.code === 'KeyE') I({ t: 'demo' });
      else if (e.code === 'KeyT') { if (!this.menuOpen()) I({ t: 'chamber', open: true }); }
      else if (e.code === 'KeyA') { if (!this.menuOpen()) I({ t: 'autoSheet', open: true }); }
      else if (e.code === 'KeyD') { if (!this.menuOpen()) I({ t: 'demoGamble' }); }
      else if (e.code === 'Escape') {
        if (this.el.autoWrap.classList.contains('show')) this.openAutoSheet(false, true);
        else if (this.el.menuWrap.classList.contains('show')) this.openMenu(false, true);
        else if (this.el.drawerWrap.classList.contains('show')) this.openDrawer(false, true);
        else if (this.chamber.isShown() && !document.documentElement.classList.contains('ceremony') && !this.isShown('summary')) I({ t: 'chamber', open: false, key: true });
        else if (this.helloShown()) I({ t: 'hello', act: 'close' });
        else I({ t: 'skip' });
      }
    });
    // Tap anywhere on the canvas area skips presentations.
    this.canvasHost.addEventListener('pointerdown', () => I({ t: 'skip' }));
  }

  bindRefs(refs: { history: () => HistoryEntry[]; settings: () => Settings; kp: () => number; dice: () => DiceView; gambleLog?: () => { log: readonly GambleLogEntry[]; open: string | null } }): void {
    this.historyRef = refs.history;
    this.settingsRef = refs.settings;
    this.kpRef = refs.kp;
    this.diceRef = refs.dice;
    if (refs.gambleLog) this.gambleLogRef = refs.gambleLog;
  }

  // ---------------- state setters ----------------
  setClock(d: Date): void { this.el.clock.textContent = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }); }
  setBalance(ore: number): void { this.el.bal.textContent = fmtKr(ore); this.el.regBal.textContent = 'Saldo ' + fmtKr(ore); }
  private stakeOre = 200;
  setStake(ore: number, canDn: boolean, canUp: boolean, locked = false): void {
    this.stakeOre = ore;
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
    (this.el.demoStorm as HTMLButtonElement).disabled = !b;
    (this.el.demoDieSeg as HTMLButtonElement).disabled = !b;
    this.el.demoPill.classList.toggle('disabled', !b);
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
    this.el.goal.innerHTML = `<span class="in"><span class="kp">Kp ${fmt1(Math.floor(kp * 10) / 10)}</span><span class="sep">·</span>${what} ved <b>Kp ${reward.kp}</b>${n ? `<span class="sep">·</span><span class="num">≈ ${fmtInt(n)} spin</span>` : ''}<span class="lab"><span class="sep">·</span><span class="num">${fmtInt(need)} ladning</span></span><span class="chev" aria-hidden="true">›</span></span>`;
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

  /** SPIN: the word lives in the button under the icon. 'auto' shows STOP (the pill under it carries "STOP · n");
   *  the aurora inside flows at its state's pace (busy: dim and slow, auto: faster; a rate change never jumps). */
  setSpin(state: 'idle' | 'busy' | 'perk' | 'disabled' | 'storm' | 'auto', cap?: string): void {
    const b = this.el.spinBtn as HTMLButtonElement;
    b.classList.toggle('idle', state === 'idle' || state === 'perk' || state === 'storm');
    b.classList.toggle('busy', state === 'busy');
    b.classList.toggle('perk', state === 'perk');
    // 'auto': a run is on; the button stays pressable in every phase and means STOP
    b.classList.toggle('auto', state === 'auto');
    // 'disabled' = balance below stake: the button stays pressable and the game answers with "Fyld op".
    b.classList.toggle('low', state === 'disabled');
    const word = state === 'auto' ? AUTO.stopWord : cap ?? (state === 'perk' ? 'LADET SPIN' : state === 'disabled' ? 'FYLD OP' : 'SPIN');
    this.el.spinCap.textContent = word;
    b.classList.toggle('long', word.length > 7);
    b.setAttribute('aria-label', state === 'auto' ? AUTO.stopAria(this.autoLeft) : state === 'perk' ? 'Ladet spin (gratis)' : state === 'disabled' ? 'Saldoen er for lav. Fyld op med legepenge' : 'Spin');
    this.spinState = state;
    this.refreshAutoPill();
    const rate = state === 'auto' ? 2.4 : state === 'busy' ? 0.45 : 1;
    try { for (const a of b.getAnimations({ subtree: true })) if (a instanceof CSSAnimation && a.playbackRate !== rate) a.updatePlaybackRate(rate); } catch { /* no WAAPI */ }
  }
  private spinState: 'idle' | 'busy' | 'perk' | 'disabled' | 'storm' | 'auto' = 'idle';
  /** The AUTO pill: "AUTO" (idle), "STOP · n" (a run is on), dimmed and aria-disabled where the sheet cannot open. */
  private refreshAutoPill(): void {
    const on = this.autoOn, off = !on && this.spinState !== 'idle' && this.spinState !== 'disabled';
    const p = this.el.autoBtn;
    p.classList.toggle('on', on);
    p.classList.toggle('off', off);
    p.setAttribute('aria-disabled', String(off));
  }

  // ---------------- autospin: the AUTO pill under SPIN and its sheet above the deck ----------------
  private autoOn = false;
  private autoLeft = 0;
  private autoPick = { n: AUTO_COUNTS[0] as number, l: 0 };
  private autoStake = 0;
  /** A run is on (state) or has ended (null, with the reason and summary for the banner). */
  setAuto(state: { left: number; total: number } | null, reason?: AutoStop, summary?: string): void {
    this.autoOn = !!state;
    this.autoLeft = state?.left ?? 0;
    document.documentElement.classList.toggle('auto', !!state);
    this.el.autoTxt.textContent = state ? AUTO.stopCap(state.left) : AUTO.pill;
    this.el.autoBtn.setAttribute('aria-label', state ? AUTO.stopAria(state.left) : AUTO.pillAria);
    this.refreshAutoPill();
    if (!state && reason) this.banner(AUTO.stop(reason), summary ?? '', 'aurora', reason === 'die' ? 3200 : 2600, reason === 'die');
  }
  /** The sheet: count (10/25/50/100) and a loss limit (kr) from autoLimits at this stake; the first limit is preset. */
  openAutoSheet(b: boolean, restoreFocus = false, stakeOre = this.autoStake): void {
    if (b) {
      this.autoStake = stakeOre;
      this.renderAutoSheet();
    }
    if (b) this.placeAutoSheet(true);
    this.el.autoWrap.classList.toggle('show', b);
    this.el.autoWrap.inert = !b;
    this.onIntent({ t: 'menu', open: b });
    if (b) setTimeout(() => (this.el.autoGo as HTMLElement).focus(), 50);
    else if (restoreFocus) this.el.autoBtn.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }
  private renderAutoSheet(): void {
    const ls = autoLimits(this.autoStake, this.autoPick.n);
    if (!ls.includes(this.autoPick.l)) this.autoPick.l = ls[0] ?? 0; // the smallest limit is the default
    this.el.autoN.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.n! === this.autoPick.n)));
    this.el.autoL.innerHTML = ls.map((l) => `<button class="sg num" data-l="${l}" aria-pressed="${l === this.autoPick.l}">${fmtKr(l)}</button>`).join('');
    this.el.autoL.style.setProperty('--n', String(ls.length));
    this.el.autoHint.textContent = AUTO.limitHint(this.autoPick.l);
  }
  /** Anchored above the deck, right-aligned with SPIN's column (never over #reg: a short landscape screen lets it come
   *  down over the deck instead; it is a modal sheet with its own scrim). */
  private placeAutoSheet(force = false): void {
    if (!force && !this.el.autoWrap.classList.contains('show')) return;
    const sh = this.el.autoSheet, host = this.root.getBoundingClientRect();
    const deck = this.el.deck.getBoundingClientRect(), reg = this.el.reg.getBoundingClientRect(), foot = document.getElementById('foot')!.getBoundingClientRect();
    const gut = host.width < 380 ? 8 : 12;
    const w = Math.min(380, host.width - 2 * gut);
    sh.style.width = w + 'px';
    sh.style.right = Math.max(gut, Math.min(host.right - deck.right + gut, host.width - w - gut)) + 'px';
    let bottom = host.bottom - deck.top + 8;
    if (host.height - bottom - sh.offsetHeight < reg.bottom - host.top + 8) bottom = host.bottom - foot.top + 8;
    sh.style.bottom = bottom + 'px';
    sh.style.maxHeight = Math.max(160, host.height - bottom - (reg.bottom - host.top) - 8) + 'px';
  }

  // ---------------- the dice home's idle life (pre-wired; the niche pass schedules its rattle on it) ----------------
  private vaultOn = false;
  /** True only when idle and quiet (no autospin, no card, menu or chamber): the only time the niche may rattle. */
  setVaultActive(active: boolean): void {
    if (active === this.vaultOn) return;
    this.vaultOn = active;
    document.documentElement.classList.toggle('vault-active', active);
    this.vault.setActive(active);
  }
  vaultActive(): boolean { return this.vaultOn; }
  /** 3-second floor ring: 0..1 */
  setRing(p: number): void { (this.el.ring as unknown as SVGCircleElement).style.strokeDashoffset = String(this.spinRingLen * (1 - Math.max(0, Math.min(1, p)))); }

  /** `die`: the user's die beside the text (the autospin stop at a die). */
  banner(title: string, sub = '', tone: 'aurora' | 'storm' = 'aurora', ms = 2600, die = false): void {
    this.el.bannerT.textContent = title;
    this.el.bannerS.textContent = sub;
    this.el.banner.classList.toggle('storm', tone === 'storm');
    this.el.banner.classList.toggle('die', die);
    if (die) paintDieIcons(this.el.banner);
    this.el.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.el.banner.classList.remove('show'), ms);
  }
  notice(html: string | null): void {
    this.el.notice.innerHTML = html ?? '';
    this.el.notice.classList.toggle('show', !!html);
  }

  show(id: 'splash' | 'stormReady' | 'bigwin' | 'summary', b: boolean): void {
    const el = this.el[id];
    if (id === 'splash') {
      clearTimeout(this.splashTimer);
      // Leaving the splash: the welcome and the button exhale for 240 ms (instantly in calm mode) instead of blinking out.
      if (!b && el.classList.contains('show') && !document.documentElement.classList.contains('calm')) {
        el.classList.add('leaving');
        this.splashTimer = window.setTimeout(() => el.classList.remove('show', 'leaving'), 240);
        return;
      }
      el.classList.remove('leaving');
    }
    el.classList.toggle('show', b);
  }
  private splashTimer = 0;

  // ---------------- splash welcome ----------------
  /** Fill the welcome inside the machine window. `reveal` plays the slow entrance (never in calm mode:
   *  the base CSS is the final, fully visible state, so a skipped or failed animation still shows the text). */
  showWelcome(c: WelcomeCopy, reveal: boolean): void {
    const w = this.el.welcome;
    w.dataset.state = c.state;
    w.classList.remove('reveal');
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    this.el.wEyebrow.innerHTML = `${esc(c.eyebrow.lead)} <span class="dot">·</span> <b>${esc(c.eyebrow.suffix)}</b>`;
    // one block span per line; lines of one sentence share a .pair wrapper so no fit rule can split them
    let html = '', open = 0, n = 0;
    for (const l of c.lines) {
      if (open && l.pair !== open) { html += '</span>'; open = 0; }
      if (l.pair && l.pair !== open) { html += '<span class="pair">'; open = l.pair; }
      html += `<span class="l ${l.tone}" style="--n:${n++}">${l.parts.map((p) => (p.b ? `<b>${esc(p.t)}</b>` : esc(p.t))).join('')}</span>`;
    }
    if (open) html += '</span>';
    this.el.wBody.innerHTML = html;
    this.el.wLegend.innerHTML = c.legend === 'storm' && c.storm ? stormShardsSvg(c.storm.played, c.storm.total) : kpLegendSvg();
    this.el.wSum.textContent = c.summary;
    if (c.buttonLabel) this.el.unlockBtn.setAttribute('aria-label', c.buttonLabel); else this.el.unlockBtn.removeAttribute('aria-label');
    this.welcomeAt = performance.now();
    if (reveal) { void w.offsetWidth; w.classList.add('reveal'); }
  }
  private welcomeAt = 0;
  /** Is this welcome state on screen and readable (not squeezed out, and past its line entrance)? */
  welcomeShowing(state: WelcomeCopy['state']): boolean {
    const w = this.el.welcome;
    if (w.dataset.state !== state || w.dataset.fit === '4') return false;
    return !w.classList.contains('reveal') || performance.now() - this.welcomeAt >= 2300;
  }

  /** Fit the welcome between the logo (canvas, stage px) and the button: anchored just under the logo,
   *  never overlapping the button, the "Legepenge · 18+" hint or the footer. Shrinks in steps (never cuts a line). */
  placeWelcome(logoBottom: number): void {
    const w = this.el.welcome, sp = this.el.splash;
    if (!sp.classList.contains('show')) return;
    const box = sp.getBoundingClientRect();
    const stage = this.canvasHost.getBoundingClientRect();
    const center = sp.querySelector('.center')!.getBoundingClientRect();
    const top = Math.round(stage.top - box.top + logoBottom + 16);
    const bottom = Math.round(box.bottom - center.top + 20);
    w.style.top = top + 'px';
    w.style.bottom = bottom + 'px';
    const band = box.height - top - bottom;
    const block = w.firstElementChild as HTMLElement;
    block.style.marginTop = '0px';
    let fit = 0;
    w.dataset.fit = '0';
    while (fit < 4 && block.offsetHeight > band) w.dataset.fit = String(++fit);
    const h = block.offsetHeight;
    const desk = box.width >= 900;
    // hang under the logo: centred in short bands, anchored at 14–16 % of taller ones
    block.style.marginTop = Math.max(0, Math.min((band - h) / 2, band * (desk ? 0.16 : 0.14))) + 'px';
  }
  isShown(id: 'splash' | 'stormReady' | 'bigwin' | 'summary'): boolean { return this.el[id].classList.contains('show'); }
  setStormInfo(text: string): void { this.el.stormInfo.textContent = text; }
  /** 'relic' = a Terningen card (.card.base.relic), 'placard' = the gate placard (.card.base.relic.placard),
   *  'gamble' = the Kvit eller dobbelt card (.card.base.gamble: its buttons carry data-gamble).
   *  Focus goes to [data-primary] first (else [data-focus], else the first button). */
  showSummary(html: string, tone: 'storm' | 'base' | 'relic' | 'placard' | 'gamble' = 'storm'): void {
    const card = this.el.summaryCard;
    const wasGamble = card.classList.contains('gamble') && this.isShown('summary');
    card.className = 'card' + (tone === 'storm' ? '' : ' base') + (tone === 'relic' || tone === 'placard' ? ' relic' : '') + (tone === 'placard' ? ' placard' : '') + (tone === 'gamble' ? ' gamble' : '');
    card.innerHTML = html;
    // Kvit eller dobbelt: the offer (the full card), then the throw and the result as compact text only (the tablets
    // and the die are drawn on the stage); one card that changes in place, never a re-entry
    delete card.dataset.g;
    if (tone === 'gamble') {
      card.dataset.g = card.querySelector('[data-gamble]') ? 'offer' : card.querySelector('.g-pip') ? 'result' : 'throw';
      card.classList.toggle('stay', wasGamble);
    }
    // the storm summary's dice row carries the die
    for (const row of Array.from(card.querySelectorAll('.dice-row > span:first-child'))) row.insertAdjacentHTML('afterbegin', DIE('row-die'));
    this.show('summary', true);
    this.fitPlacard();
    this.fitGamble();
    paintDieIcons(card);
    setTimeout(() => (card.querySelector<HTMLElement>('[data-primary]') ?? card.querySelector<HTMLElement>('[data-focus]') ?? card.querySelector('button'))?.focus({ preventScroll: true }), 400);
  }
  summaryEl(): HTMLElement { return this.el.summaryCard; }
  /** Top edge (in #app px = stage px) of the open gamble card, so the staged die can sit centred above it. The layout
   *  box (offsetTop: the card's 8 px entry slide is left out), never the moving one. No gamble card open: where the
   *  offer card will start (phones: ~42 % of the height above the footer; desktop: a ~300 px card above the footer). */
  gambleCardTop(): number {
    const host = this.root.getBoundingClientRect();
    const card = this.el.summaryCard;
    if (card.classList.contains('gamble') && this.isShown('summary') && card.offsetHeight > 0) {
      const sum = this.el.summary.getBoundingClientRect();
      return sum.top - host.top + card.offsetTop;
    }
    const foot = document.getElementById('foot')!.getBoundingClientRect();
    const desk = matchMedia('(min-width: 1000px) and (min-aspect-ratio: 5/4)').matches;
    return foot.top - host.top - (desk ? 16 + 300 : 12 + host.height * 0.42);
  }
  /** Phones: the offer is a bottom sheet of at most ~42 % of the height, so the staged die stays visible above it. The
   *  type and spacing tighten in steps (data-fit 1–3: 3 puts the two bets side by side); the facts line and the demo
   *  note are never dropped. Desktop: a centred card under the die (no steps needed). */
  private fitGamble(): void {
    const card = this.el.summaryCard;
    if (!card.classList.contains('gamble')) return; // (the placard keeps its own fit steps: Hud.fitPlacard)
    delete card.dataset.fit;
    if (!this.isShown('summary') || card.dataset.g !== 'offer') return;
    const host = this.root.getBoundingClientRect();
    const cap = host.height * (host.height < 560 ? 0.6 : 0.42);
    for (let f = 1; f <= 3 && card.offsetHeight > cap; f++) card.dataset.fit = String(f);
  }
  /** Phones (bottom-anchored placard): the claim (.pl-claim: p1 + the sanctioned sentence with its guard) never shrinks
   *  or scrolls. Portrait keeps the card within 52 % of the screen where the claim allows it (the gate's name stays
   *  clear): the type tightens first (data-fit 1–2; 3 only when the band between #reg and #foot is short), then p3/p4
   *  (.pl-body) get the room left, in whole paragraphs (p3 always), and the rest scrolls under a fade.
   *  Landscape: the card stands beside the gate, as wide as that room allows, and may use the whole band. The band ends
   *  under a demo/replay ribbon the card would cover; a card still taller than it takes the last step (data-tight). */
  private fitPlacard(): void {
    const card = this.el.summaryCard, body = card.querySelector<HTMLElement>('.pl-body');
    delete card.dataset.fit;
    delete card.dataset.tight;
    card.style.width = ''; // (the same card element also shows the other cards)
    if (!body || !card.classList.contains('placard') || !this.isShown('summary')) return;
    body.style.maxHeight = '';
    body.classList.remove('more');
    body.removeAttribute('tabindex');
    if (!matchMedia('(max-width: 999px), (max-aspect-ratio: 5/4)').matches) return;
    const box = this.el.summary.getBoundingClientRect();
    const land = matchMedia('(max-width: 999px) and (max-height: 500px) and (orientation: landscape)').matches;
    // landscape: as wide as the room left of the gate's slot allows (fewer lines)
    const slot = this.chamber.gateSlot().getBoundingClientRect();
    if (land && slot.width > 0) card.style.width = Math.round(Math.max(300, Math.min(440, slot.left - card.getBoundingClientRect().left - 12))) + 'px';
    // the band's top: 12 px under #reg, and 6 px under the chamber's ribbon wherever the card would cover it (a demo
    // or replay ribbon stays readable to the last frame)
    let top = document.getElementById('reg')!.getBoundingClientRect().bottom + 12;
    const rb = this.chamber.isShown() ? this.chamber.el.querySelector<HTMLElement>('#chRibbon') : null;
    if (rb && !rb.hidden) {
      const r = rb.getBoundingClientRect(), c = card.getBoundingClientRect();
      if (r.height > 0 && r.left < c.right && r.right > c.left) top = Math.max(top, r.bottom + 6);
    }
    card.style.maxHeight = 'none';
    body.style.maxHeight = '0px';
    const band = card.offsetTop + card.offsetHeight - (top - box.top); // bottom-anchored: the bottom never moves
    const cap = land ? band : Math.min(band, box.height * 0.52);
    for (let f = 1; f <= 3 && card.offsetHeight > (f < 3 ? cap : band); f++) card.dataset.fit = String(f);
    if (card.offsetHeight > band) card.dataset.tight = ''; // the last step (a short landscape band under a ribbon)
    const fixed = card.offsetHeight;
    const ps = Array.from(body.children) as HTMLElement[];
    const bot = (p: HTMLElement) => p.offsetTop - body.offsetTop + p.offsetHeight + parseFloat(getComputedStyle(p).marginBottom);
    const room = Math.min(band - fixed, Math.max(cap - fixed, ps.length ? bot(ps[0]) : 0));
    let h = 0;
    for (const p of ps) { if (bot(p) <= room + 0.5) h = bot(p); else break; }
    body.style.maxHeight = h + 'px';
    card.style.maxHeight = '';
    body.classList.toggle('more', body.scrollHeight > h + 1);
    if (h === 0) body.setAttribute('tabindex', '-1'); // a 0-px scroller is no tab stop
  }

  /** Focus moves into the dialog on open; it is returned to the opener only for keyboard closes (Esc),
   *  otherwise a later Space would re-open the dialog instead of spinning. */
  openMenu(b: boolean, restoreFocus = false, tab?: string): void {
    if (tab) this.menuTab = tab;
    if (b) {
      this.renderMenu();
      const a = document.activeElement;
      if (!this.el.menuWrap.contains(a)) this.menuFrom = a instanceof HTMLElement && a !== document.body ? a : null;
    }
    this.el.menuWrap.classList.toggle('show', b);
    this.el.menuWrap.inert = !b;
    this.onIntent({ t: 'menu', open: b });
    if (b) setTimeout(() => this.el.menuClose.focus(), 50);
    else if (restoreFocus) {
      // back to the opener; else "Regler og tal ›" in the chamber (#hdr is inert there) or the menu button
      const from = this.menuFrom, usable = (e: HTMLElement | null) => !!e && e.isConnected && !e.closest('[inert]') && e.getClientRects().length > 0;
      (usable(from) ? from! : this.chamber.isShown() ? this.chamber.el.querySelector<HTMLElement>('#chRules')! : this.el.menuBtn).focus({ preventScroll: true });
    } else (document.activeElement as HTMLElement | null)?.blur?.();
  }
  /** The element that had focus when the menu opened (keyboard opens only: a pointer press drops focus first). */
  private menuFrom: HTMLElement | null = null;
  openDrawer(b: boolean, restoreFocus = false): void {
    this.el.drawerWrap.classList.toggle('show', b);
    this.el.drawerWrap.inert = !b;
    this.onIntent({ t: 'menu', open: b });
    if (b) setTimeout(() => this.el.drawerClose.focus(), 50);
    else if (restoreFocus) this.el.toolsBtn.focus({ preventScroll: true });
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }
  private calmChipTimer = 0;
  /** Shown for 8 s (it would otherwise cover the Kp arc); "Vis fuld effekt" stays in the demo tools + settings. */
  setCalmChip(b: boolean): void {
    this.el.calmChip.classList.toggle('show', b);
    clearTimeout(this.calmChipTimer);
    if (b) this.calmChipTimer = window.setTimeout(() => this.el.calmChip.classList.remove('show'), 8000);
  }
  menuOpen(): boolean { return this.el.menuWrap.classList.contains('show') || this.el.drawerWrap.classList.contains('show') || this.el.autoWrap.classList.contains('show'); }

  // ---------------- Terningen: the niche (Vault), landing ----------------
  private diceShow = true;
  /** The niche is status only: a count, never a fraction. `enabled` = idle (tap opens the chamber); otherwise aria-disabled. */
  setDice(shown: number, o: { show: boolean; unlock: DiceView['unlock']; enabled: boolean }): void {
    document.documentElement.classList.toggle('nodice', !o.show);
    this.vault.set(shown, { unlock: o.unlock, enabled: o.enabled });
    if (o.show !== this.diceShow) { this.diceShow = o.show; this.vault.fit(); this.vault.repaint(true); }
  }
  /** Every die icon: the niche (both canvases), the demo pill, the menu tab, open cards, the banner, the chamber. */
  paintDiceIcons(): void {
    this.vault.repaint(true);
    for (const r of [this.el.demoPill, this.el.tabs, this.el.menuBody, this.el.histSide, this.el.summaryCard, this.el.banner, this.chamber?.el]) if (r) paintDieIcons(r);
  }
  /** The niche die's centre and size in #app coordinates (= stage px): where every flight lands, on every viewport. */
  diceTarget(): { x: number; y: number; size: number } {
    const host = this.root.getBoundingClientRect();
    const t = this.vault.target(host);
    if (t) return t;
    const d = this.el.deck.getBoundingClientRect();
    return { x: d.right - 60 - host.left, y: d.top - 30 - host.top, size: 18 };
  }
  /** A die lands in the niche: the catch (ring, count roll, aurora puff, a 3 px dip; the first one thaws the die). */
  landDice(n: number, calm: boolean): void { this.vault.land(n, calm); }
  /** Demo landing: the amber "+n demo" beside the niche for 1,5 s; the number is unchanged. */
  demoDiceTag(n = 1): void { this.vault.demoTag(n); }
  focusDiceChip(): void { this.vault.focus(); }

  // ---------------- Terningen: first-visit introduction (#hello, non-modal coach card) ----------------
  showHello(html: string): HTMLElement {
    const el = this.el.hello;
    el.innerHTML = `<div class="caret" aria-hidden="true"></div>${html}`;
    el.hidden = false;
    this.placeHello();
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    return el;
  }
  hideHello(): void { this.el.hello.hidden = true; this.el.hello.classList.remove('in'); }
  helloShown(): boolean { return !this.el.hello.hidden; }
  /** Anchored above the niche, right-aligned with it (phones: over the grid's lower part, never over SPIN, the niche or
   *  the Netto line; desktop: over the right column, above the niche's panel). A short screen widens it (leftward) until
   *  it clears #reg; where even 600 px cannot clear it (landscape phones) the card stands beside the niche instead, to
   *  its left and above the Netto line, its buttons in a column on the right. The caret points at the die. */
  placeHello(): void {
    const el = this.el.hello;
    if (el.hidden) return;
    const host = this.root.getBoundingClientRect();
    const v = this.vault.nicheRect();
    const ico = this.vault.ico.getBoundingClientRect();
    const reg = this.el.reg.getBoundingClientRect().bottom - host.top;
    const gutter = host.width < 380 ? 8 : 16;
    const caret = el.querySelector('.caret') as HTMLElement | null;
    el.classList.remove('side');
    caret?.style.removeProperty('top');
    if (v.width < 1) { el.style.left = gutter + 'px'; el.style.right = ''; el.style.bottom = Math.round(host.bottom - this.el.deck.getBoundingClientRect().top + 10) + 'px'; return; }
    // desktop: the whole right-column block (the card sits over the column, above the niche's panel)
    const desk = this.vault.el.classList.contains('desk'), a = desk ? this.vault.el.getBoundingClientRect() : v;
    const right = Math.max(gutter, Math.round(host.right - a.right - (desk ? 0 : 4)));
    const bottom = Math.round(host.bottom - a.top + 10);
    const maxW = host.width - right - gutter;
    let w = Math.min(desk ? Math.max(a.width, 280) : 320, maxW);
    el.style.left = '';
    el.style.right = right + 'px';
    el.style.bottom = bottom + 'px';
    el.style.width = Math.floor(w) + 'px';
    while (w < Math.min(maxW, 600) && host.height - bottom - el.offsetHeight < reg + 8) { w = Math.min(w + 40, maxW, 600); el.style.width = Math.floor(w) + 'px'; }
    if (!desk && host.height - bottom - el.offsetHeight < reg + 8) {
      // beside the niche: its right edge 12 px left of the niche, its foot 6 px over the Netto line
      el.classList.add('side');
      const win = this.el.winstrip.getBoundingClientRect();
      const r2 = Math.round(host.right - v.left + 12), room = host.width - r2 - gutter;
      el.style.right = r2 + 'px';
      el.style.width = Math.floor(Math.min(680, room)) + 'px';
      const b2 = Math.round(host.bottom - Math.min(win.top, v.bottom) + 6);
      el.style.bottom = Math.max(0, Math.min(b2, host.height - reg - 8 - el.offsetHeight)) + 'px';
      const top = el.getBoundingClientRect().top;
      caret?.style.setProperty('top', Math.max(12, Math.min(el.offsetHeight - 22, ico.top + ico.height / 2 - top - 5)) + 'px');
      return;
    }
    // the shortest screens: #reg wins (the card may come down beside the niche, never onto #reg)
    el.style.bottom = Math.max(0, Math.min(bottom, host.height - reg - 8 - el.offsetHeight)) + 'px';
    const left = host.width - right - el.offsetWidth;
    caret?.style.setProperty('left', Math.max(12, Math.min(el.offsetWidth - 22, ico.left + ico.width / 2 - host.left - left - 5)) + 'px');
  }

  // ---------------- Terningen: chamber / ceremony mode ----------------
  /** :root.chamber hides the machine UI (visibility + inert); #reg (now with the balance) and #foot stay interactive. */
  setChamberMode(b: boolean): void {
    document.documentElement.classList.toggle('chamber', b);
    for (const el of [document.getElementById('hdr'), this.slotArc, this.el.winstrip, document.getElementById('deck'), ...Array.from(document.querySelectorAll('.side'))]) {
      if (!el) continue;
      if (b) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    }
  }
  /** :root.ceremony fades the chamber text; ChamberDom makes its controls inert and holds focus on the dialog (Space skips). */
  setCeremonyMode(b: boolean): void { document.documentElement.classList.toggle('ceremony', b); this.chamber.setCeremony(b); }

  // ---------------- side panels (desktop) ----------------
  refreshSide(stakeOre: number, storm = false): void {
    this.el.ladderSide.innerHTML = this.ladderHtml();
    this.el.payMini.innerHTML = this.payMiniHtml(stakeOre, storm);
    (this.el.payMini.previousElementSibling as HTMLElement).textContent = storm ? 'Solstorm · gevinst før mærker' : 'Gevinsttabel · ved indsats';
    this.el.histSide.innerHTML = this.histHtml(8);
    paintDieIcons(this.el.histSide);
  }

  // ---------------- menu content ----------------
  private renderMenu(): void {
    this.el.tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === this.menuTab)));
    const body = this.el.menuBody;
    const st = this.settingsRef();
    switch (this.menuTab) {
      case 'rules': body.innerHTML = this.rulesHtml(); break;
      case 'pay': body.innerHTML = this.payHtml(); break;
      case 'ladder': body.innerHTML = `<p>Nordlyset viser dit fremskridt. Knuste symboler giver ladning (lav krystal 1, høj 2, WILD 3, 3 sole +${CONFIG.sunCharge}). Ladet spin ved Kp 3, 5 og 7 · Solstorm ved Kp 9. Tallene til højre er det gennemsnitlige antal spin fra Kp 0.</p><p class="hint">Dit fremskridt gemmes i 365 dage efter dit sidste spin.</p><p class="hint">${MENU.kpHint}</p><div class="ladder">${this.ladderHtml()}</div>`; break;
      case 'dice': body.innerHTML = this.diceTabHtml(); break;
      case 'hist': body.innerHTML = `<p>De seneste 100 spin. Hvert spin kan genskabes præcist ud fra sit Spil-ID og den gemte tilstand før spinnet.${MENU.histIntro}</p><div class="hist"><div class="h head"><span>Spil-ID</span><span>Gevinst</span><span>Netto</span></div>${this.histHtml(100)}</div>`; break;
      case 'settings': body.innerHTML = `
        <label class="setting"><span>Musik</span><select data-k="musicSource" id="setMusicSrc"><option value="polar" ${st.musicSource !== 'code' ? 'selected' : ''}>Polar Night</option><option value="code" ${st.musicSource === 'code' ? 'selected' : ''}>Kode</option></select></label>
        <label class="setting"><span>Musikstyrke</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-k="music" id="setMusic"></label>
        <label class="setting"><span>Lydeffekter</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-k="sfx" id="setSfx"></label>
        <label class="setting"><span>Lyd slået fra</span><input type="checkbox" ${st.muted ? 'checked' : ''} data-k="muted" id="setMuted"></label>
        <label class="setting"><span>Haptik (Android)</span><input type="checkbox" ${st.haptics ? 'checked' : ''} data-k="haptics" id="setHaptics"></label>
        <label class="setting"><span>Rolig tilstand</span><select data-k="calm" id="setCalm"><option value="auto" ${st.calm === 'auto' ? 'selected' : ''}>Følg system</option><option value="on" ${st.calm === 'on' ? 'selected' : ''}>Til</option><option value="off" ${st.calm === 'off' ? 'selected' : ''}>Fra</option></select></label>
        <p class="hint">Rolig tilstand fjerner rystelser, blink, kromatiske effekter og glasskår og bruger bløde overgange i stedet.</p>
        <label class="setting"><span>${MENU.setting}</span><input type="checkbox" ${st.dice !== false ? 'checked' : ''} data-k="dice" id="setDice"></label>
        <p class="hint">${MENU.settingHint}</p>
        <label class="setting"><span>${MENU.gambleSetting}</span><input type="checkbox" ${st.gambleOffers !== false ? 'checked' : ''} data-k="gambleOffers" id="setGamble"></label>
        <p class="hint">${MENU.gambleHint}</p>
        <div class="actions"><button class="btn ghost small" data-act="refill">Fyld op (legepenge)</button><button class="btn ghost small" data-act="reset">Nulstil demo</button></div>`; break;
      case 'rg': body.innerHTML = `
        <h4>Spil med omtanke</h4>
        <p>Dette er en <b>demo med legepenge</b>. Der kan ikke indbetales, vindes eller tabes rigtige penge.</p>
        <p>Spil aldrig for mere, end du har råd til at tabe. Sæt grænser for tid og penge, og hold pauser.</p>
        <p>Rådgivning: <a href="https://www.stopspillet.dk" target="_blank" rel="noopener">StopSpillet 70 22 28 25</a> · Udelukkelse: <a href="https://www.spillemyndigheden.dk/rofus" target="_blank" rel="noopener">ROFUS</a>.</p>
        <h4>Designprincipper</h4>
        <p>Mindst 3,0 s pr. spin – også i autospin · ingen turbo eller køb af bonus · autospin kræver en tabsgrænse og stopper ved hver terning, Ladet spin og Solstorm · resultater under indsatsen fejres ikke · ingen konstruerede "næsten"-resultater · sessionstid og netto vises altid.${MENU.rgLine}</p>`; break;
    }
    paintDieIcons(this.el.tabs);
    paintDieIcons(body);
    // the selected tab in view (the row scrolls sideways on phones; never the page)
    const sel = this.el.tabs.querySelector<HTMLElement>('[aria-selected="true"]'), row = this.el.tabs;
    if (sel && row.clientWidth > 0) {
      const l = sel.offsetLeft - row.offsetLeft, r = l + sel.offsetWidth;
      if (l < row.scrollLeft || r > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, l - (row.clientWidth - sel.offsetWidth) / 2);
    }
  }
  /** The "Terningen" tab: the die and the count, "Dine valg" (the last 10 choices: ID, choice, face, result; a choice
   *  whose result is not shown yet is never listed), then the rules. */
  private diceTabHtml(): string {
    const v = this.diceRef(), g = this.gambleLogRef();
    const rows = gambleLogRows(g.log, g.open, 10);
    const H = GAMBLE_LOG.head;
    const log = rows.length
      ? `<div class="glog num" role="table" aria-label="${GAMBLE_LOG.h}"><div class="gl head" role="row"><span role="columnheader" class="sr">${H.id}</span><span role="columnheader">${H.choice}</span><span role="columnheader">${H.pip}</span><span role="columnheader">${H.result}</span></div>${rows.map((r) => `<div class="gl" role="row" aria-label="${r.aria}"><span class="id" role="cell">${r.id}</span><span role="cell">${r.choice}</span><span role="cell">${r.pip}</span><span role="cell" class="${r.result.endsWith('ingen') ? 'neg' : 'pos'}">${r.result}</span></div>`).join('')}</div>`
      : `<p class="hint">${GAMBLE_LOG.empty}</p>`;
    return `<div class="dice-hdr">${DIE('hdr-die', v.count === 0)}<div class="dh-t"><h4>${MENU.tab}</h4><span class="dice-status num">${MENU.status(v.count)}</span></div><button class="btn ghost small" data-act="chamber">${MENU.open}</button></div>
      <h4>${GAMBLE_LOG.h}</h4><p class="hint">${GAMBLE_LOG.intro}</p>${log}${diceRulesHtml()}`;
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
      <h4>${AUTO.title}</h4>
      <p>${AUTO.rules}</p>
      ${diceRulesHtml(R, C)}
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
    const kr = (ore: number) => fmtKr(ore).replace(' kr', '');
    const table = (scale: number) => {
      let t = `<div style="overflow-x:auto"><table class="num"><tr><th>Symbol</th>${heads.map((x) => `<th>${x}</th>`).join('')}</tr>`;
      for (let s = 6; s >= 0; s--) {
        t += `<tr><td>${SYM_NAMES[s]}</td>${C.paytable[s].map((v) => `<td>${kr(Math.round(v * scale * this.stakeOre))}</td>`).join('')}</tr>`;
      }
      return t + '</table></div>';
    };
    return `<h4>Basisspil · kr ved indsats ${fmtKr(this.stakeOre)}</h4><p>Gevinst i kr efter klyngestørrelse (før mærker). I × indsats: fra ${fmtX(C.paytable[0][0] * C.payScale)} til ${fmtX(C.paytable[6][7] * C.payScale)}.</p>${table(C.payScale)}
      <p>Solen: 3 sole = ${C.sunPayX}× indsats (${fmtKr(C.sunPayX * this.stakeOre)}). 4+ sole = Solstorm.</p>
      <h4>Solstorm · kr ved samme indsats</h4><p>I stormen udbetaler klynger ${fmtPct(C.stormPayScale, 2)} af tabellen ovenfor, før plasmamærker.</p>${table(C.payScale * C.stormPayScale)}`;
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
      return `<div class="r ${cls}"><span class="k">Kp ${t.kp}</span><span><span class="c">${t.change}</span><br><span class="g">${t.gName ? t.gName + ' · ' : ''}${t.name}${spins ? ' · <span class="num">≈ ' + fmtInt(Math.round(spins)) + ' spin</span>' : ''}</span></span></div>`;
    }).reverse().join('');
  }
  private histHtml(n: number): string {
    const hs = this.historyRef().slice(-n).reverse();
    if (!hs.length) return '<p class="hint">Ingen spin endnu.</p>';
    const modeName: Record<string, string> = { perk: 'Ladet spin', storm: 'Solstorm', demo: 'Demo' };
    return hs.map((e) => `<div class="h"><span class="id">${e.spinId}${e.mode !== 'base' ? ' · ' + (modeName[e.mode] ?? e.mode) : ''}${e.die ? ` · ${DIE('h-die')}${MENU.histMark.replace(/^ · /, '')}` : ''}${e.spinId.endsWith('-G') ? ' · garanti' : ''}</span><span class="num ${e.netOre > 0 ? 'pos' : 'neg'}">${fmtKr(e.winOre)}</span><span class="num ${e.netOre > 0 ? 'pos' : 'neg'}">${fmtSignedKr(e.netOre)}</span></div>`).join('');
  }
}
