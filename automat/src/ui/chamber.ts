// Terningekammeret: the DOM dialog layered over the gate (#chGate is the Pixi slot, measured like #slot-grid).
// Text and state only; the gate itself (GateView) and the open/close motion belong to the presenter.
// It reads a DiceView (never the store) plus the player's real count for the preview ribbons.
import type { DiceView } from '../game/dice.ts';
import { fmtDice, diceWord } from '../game/dice.ts';
import { CHAMBER, chamberFacts, chamberMyth, chamberSummary, gateState, type GateState, type MythLine, type RibbonKind } from './diceCopy.ts';

const ICON_CLOSE = '✕';

/** Markup of the section (inserted in #overlays BEFORE #menuWrap, so the rules menu can open on top of it). */
export function chamberMarkup(soundIcon: string): string {
  return `<section id="chamber" role="dialog" aria-modal="true" aria-labelledby="chTitle" aria-describedby="chSum" tabindex="-1" hidden>
    <div id="chRibbon" class="ch-ribbon" hidden></div>
    <header class="ch-hdr">
      <div><p class="ch-eb">${CHAMBER.eyebrow}</p><h2 id="chTitle">${CHAMBER.title}</h2></div>
      <button class="iconbtn" id="chMute" aria-label="Lyd til/fra">${soundIcon}</button>
      <button class="iconbtn" id="chClose" aria-label="${CHAMBER.close}">${ICON_CLOSE}</button>
    </header>
    <div class="ch-myth" id="chMyth" aria-hidden="true"></div>
    <div class="ch-gate" id="chGate" aria-hidden="true"></div>
    <p class="sr" id="chSum"></p>
    <div class="ch-count">
      <span class="n num" id="chN">0</span><span class="w" id="chW">terninger</span>
      <span class="tag" id="chTag" hidden>${CHAMBER.previewTag}</span>
      <button class="btn gate small" id="chOpen" hidden>${CHAMBER.open}</button>
      <span class="st" id="chSt" hidden>${CHAMBER.openStatus}</span>
      <button class="btn ghost small" id="chReplay" hidden>${CHAMBER.replay}</button>
    </div>
    <ul class="ch-facts" id="chFacts"><li></li><li></li><li></li></ul>
    <div class="ch-act">
      <button class="linkbtn" id="chRules" aria-label="${CHAMBER.rulesAria}">${CHAMBER.rules}</button>
      <button class="btn ghost small" id="chDone">${CHAMBER.done}</button>
    </div>
  </section>`;
}

const mythHtml = (lines: MythLine[], concept: string): string => {
  let html = '', open = 0;
  for (const l of lines) {
    if (open && l.pair !== open) { html += '</span>'; open = 0; }
    if (l.pair && l.pair !== open) { html += `<span class="pair p${l.pair}">`; open = l.pair; }
    html += `<span class="l ${l.tone} n${l.n}">${l.t}</span>`;
    // the concept chip sits inside pair 2, directly under the name it qualifies
    if (l.pair === 2 && (l.n === 6 || lines.every((x) => x.n !== 6))) html += `<span class="chip concept">${concept}</span>`;
  }
  if (open) html += '</span>';
  return html;
};

export class ChamberDom {
  readonly el: HTMLElement;
  private q = (id: string) => this.el.querySelector('#' + id) as HTMLElement;
  view: DiceView = { count: 0, unlock: 'none', mode: 'real' };
  state: GateState = 'sealed';

  constructor(root: ParentNode) {
    this.el = root.querySelector('#chamber') as HTMLElement;
  }
  isShown(): boolean { return !this.el.hidden; }
  gateSlot(): HTMLElement { return this.q('chGate'); }

  /** Rewrites every text for this view (and #chSum). `ribbon` null = none. `canOpen` = the real, pending gate. */
  render(v: DiceView, realN: number, ribbon: { kind: RibbonKind; text: string } | null, facts = chamberFacts()): void {
    this.view = v;
    const st = (this.state = gateState(v));
    this.el.dataset.state = st;
    this.el.dataset.mode = v.mode;
    const rb = this.q('chRibbon');
    rb.hidden = !ribbon;
    rb.textContent = ribbon?.text ?? '';
    rb.classList.toggle('neutral', ribbon?.kind === 'replay');
    this.q('chMyth').innerHTML = `<div class="full">${mythHtml(chamberMyth(st), CHAMBER.concept)}</div><div class="cond">${mythHtml(chamberMyth(st, true), CHAMBER.concept)}</div>`;
    this.q('chN').textContent = fmtDice(v.count);
    this.q('chW').textContent = diceWord(v.count);
    this.q('chN').parentElement!.classList.toggle('zero', v.count === 0);
    this.q('chTag').hidden = v.mode !== 'preview';
    this.q('chOpen').hidden = !(st === 'pending' && v.mode === 'real');
    this.q('chSt').hidden = st !== 'open';
    this.q('chReplay').hidden = !(st === 'open' && v.mode === 'real');
    this.el.querySelectorAll('#chFacts li').forEach((li, i) => { li.textContent = facts[i]; });
    this.q('chSum').textContent = chamberSummary(v, realN);
  }

  show(b: boolean): void {
    this.el.hidden = !b;
    // in the ceremony the dialog itself holds focus (its controls are inert), so Space reaches the skip
    if (b) setTimeout(() => (this.ceremony ? this.el : this.q('chClose')).focus({ preventScroll: true }), 50);
  }

  private ceremony = false;
  /** The ceremony: the faded chamber text and its controls go inert (no Tab, no Enter on an invisible "Regler og
   *  tal ›" or "Luk"); focus moves to the dialog itself, where Space / Esc / Enter reach the skip. Afterwards the
   *  controls come back, and focus that was lost (the placard closed) returns to "Luk". */
  setCeremony(b: boolean): void {
    this.ceremony = b;
    this.el.querySelectorAll<HTMLElement>(':scope > :not(.ch-ribbon):not(.ch-gate):not(.sr)').forEach((c) => { c.inert = b; });
    if (!this.isShown()) return;
    const a = document.activeElement;
    if (b) this.el.focus({ preventScroll: true });
    else if (!a || a === document.body || a === this.el || !a.getClientRects().length) this.q('chClose').focus({ preventScroll: true });
  }

  /** Fit loop (phone portrait): raise data-fit until the gate slot is ≥ 200 px and nothing overflows (the gate row
   *  is minmax(200px, 1fr), so a short screen shows up as overflow). Never drops the count, the concept chip,
   *  F1–F3 or "Luk"; everything stays above the fold. */
  place(): void {
    if (this.el.hidden) return;
    const gate = this.q('chGate');
    let fit = 0;
    this.el.dataset.fit = '0';
    const portrait = innerHeight > innerWidth && !matchMedia('(max-height: 500px)').matches;
    const tight = () => gate.getBoundingClientRect().height < 200 || this.el.scrollHeight > this.el.clientHeight + 1;
    while (portrait && fit < 5 && tight()) this.el.dataset.fit = String(++fit);
  }
}
