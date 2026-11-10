/**
 * The menu sheet: rules and paytable, the maths lab, settings and the demo
 * tools. Built once; afterwards only texts and attributes change.
 */
import { SYM, SYMBOLS } from '../core/config';
import type { SymbolId } from '../core/config';
import { formatKr, formatMultiple, formatPercent } from '../core/format';
import type { ModelInfo, Quality, RigKind, SimProgress, Simulator } from '../core/types';
import { createConvergenceChart } from './chart';
import { attr, button, el, setText, svg, toggleAttr } from './dom';
import { DIAGRAM, ICON, symbolSvg } from './icons';

export type MenuTab = 'rules' | 'math' | 'settings' | 'demo';
export type DemoAction = RigKind | 'addBalance' | 'resetBalance';

export interface MenuHost {
  model: ModelInfo;
  volumes: { music: number; sfx: number };
  onDemo(action: DemoAction, label: string): void;
  onVolume(bus: 'music' | 'sfx', v01: number): void;
  onQuality(q: Quality): void;
  onTurbo(on: boolean): void;
  onAutoNudge(on: boolean): void;
  onClosed(): void;
}

export interface Menu {
  readonly root: HTMLElement;
  readonly isOpen: boolean;
  open(tab?: MenuTab): void;
  close(): void;
  setBet(bet: number): void;
  setSymbolIcons(icons: Record<number, string>): void;
  setSimulator(sim: Simulator): void;
  setQuality(q: Quality): void;
  setTurbo(on: boolean): void;
  setAutoNudge(on: boolean): void;
  /** The sheet changed size: repaint what is drawn in pixels. */
  relayout(): void;
}

const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });

/** 250000 → "250.000" ; 2500000 → "2,5 mio." */
function formatSpins(n: number): string {
  return n >= 1e6 ? `${nf1.format(n / 1e6)} mio.` : nf0.format(Math.round(n));
}

const TABS: readonly [MenuTab, string][] = [
  ['rules', 'Regler'],
  ['math', 'Matematik'],
  ['settings', 'Indstillinger'],
  ['demo', 'Demo'],
];

const RIGS: readonly [RigKind, string, string][] = [
  ['nova', 'Udløs Stella Nova', 'Stjernen eksploderer i næste spin'],
  ['freeSpins', 'Udløs Kometnat', 'Tre kometer i næste spin'],
  ['bigWin', 'Stor gevinst', 'Mindst 10× indsatsen'],
  ['megaWin', 'Mega gevinst', 'Mindst 25× indsatsen'],
  ['supernovaWin', 'Supernova-gevinst', 'Mindst 60× indsatsen'],
  ['chain', 'Kædereaktion', 'Flere gevinster i træk'],
  ['nudgeWin', 'Træk-gevinst', 'Et træk, der giver gevinst'],
  ['dead', 'Nitte', 'Et spin uden gevinst'],
];

const SIM_SIZES: readonly [number, string][] = [
  [100_000, '100.000'],
  [1_000_000, '1 mio.'],
  [10_000_000, '10 mio.'],
];

const QUALITIES: readonly [Quality, string][] = [
  ['low', 'Lav'],
  ['medium', 'Mellem'],
  ['high', 'Høj'],
];

const sec = (title: string, ...children: (Node | string | null | false)[]) =>
  el('section', 'sn-sec', el('h3', 'sn-sec__h', title), ...children);

export function createMenu(host: MenuHost): Menu {
  const { model } = host;
  const stats = model.stats;
  let isOpen = false;
  let tab: MenuTab = 'rules';
  let bet = 0;

  const symHolders: { id: number; node: HTMLElement }[] = [];
  const betBound: (() => void)[] = [];

  const sym = (id: SymbolId): HTMLElement => {
    const node = svg(symbolSvg(id), 'sn-sym');
    symHolders.push({ id, node });
    return node;
  };

  // ───────────────────────────── Regler ─────────────────────────────

  function rulesPane(): HTMLElement {
    const steps = el('ol', 'sn-steps');
    const stepText: [string, string, string][] = [
      [DIAGRAM.board, 'Fire ringe, otte eger', 'Symbolerne sidder i fire ringe om stjernen. Hver eger er en linje, der læses fra stjernen og udad.'],
      [DIAGRAM.line, 'Tre eller fire ens', 'En linje betaler, når de tre inderste eller alle fire symboler er ens. Stella Nova er wild. En komet bryder linjen.'],
      [DIAGRAM.nudge, 'Dit træk', 'Efter spinnet må du dreje én ring ét hak, hvis det kan give gevinst. Der er ingen tidsfrist, og du kan springe over.'],
      [DIAGRAM.cascade, 'Urværket tikker', 'Vindende symboler splintres, nye falder ned, og hver ring tikker ét hak. Hvert trin i kæden løfter multiplikatoren.'],
    ];
    stepText.forEach(([diagram, head, text], i) => {
      steps.append(
        el('li', 'sn-stepcard', svg(diagram, 'sn-dia'), el('div', '', el('div', 'sn-stepcard__n', `Trin ${i + 1}`), el('h4', '', head), el('p', '', text))),
      );
    });

    const pay = el('div', 'sn-pay');
    pay.append(el('div', 'sn-pay__row sn-pay__row--head', el('span'), el('span', 'sn-cap', 'Symbol'), el('span', 'sn-cap', '3 ens'), el('span', 'sn-cap', '4 ens')));
    const entries = model.paytable.filter((e) => e.symbol <= SYM.SUN).sort((a, b) => b.pay4 - a.pay4);
    for (const e of entries) {
      const kr3 = el('span');
      const kr4 = el('span');
      pay.append(
        el(
          'div',
          'sn-pay__row',
          el('div', '', sym(e.symbol)),
          el('div', 'sn-pay__name', SYMBOLS[e.symbol].name),
          el('div', 'sn-pay__num', el('b', '', formatMultiple(e.pay3)), kr3),
          el('div', 'sn-pay__num', el('b', '', formatMultiple(e.pay4)), kr4),
        ),
      );
      betBound.push(() => {
        setText(kr3, formatKr(Math.round(e.pay3 * bet)));
        setText(kr4, formatKr(Math.round(e.pay4 * bet)));
      });
    }
    const award = model.freeSpinsAward;
    const extra = model.retriggerAward;
    pay.append(
      el(
        'div',
        'sn-pay__row',
        el('div', '', sym(SYM.WILD)),
        el('div', 'sn-pay__name sn-pay__wide', 'Stella Nova', el('small', '', 'Wild. Erstatter alle symboler undtagen komet. En linje af lutter wilds betaler som Sol.')),
      ),
      el(
        'div',
        'sn-pay__row',
        el('div', '', sym(SYM.SCATTER)),
        el('div', 'sn-pay__name sn-pay__wide', 'Komet', el('small', '', `3 kometer giver ${award[3]} gratisspil, 4 giver ${award[4]}. Kometen betaler ikke selv, og den bryder linjen.`)),
      ),
    );
    const betNote = el('p', 'sn-sec__note');
    betBound.push(() => setText(betNote, `Beløb ved en indsats på ${formatKr(bet)}. Alle 8 eger er altid aktive, og gevinster er multipla af hele indsatsen.`));

    const chips = el('div', 'sn-chips', ...model.ladder.map((v) => el('span', 'sn-chip', `×${v}`)));

    const feature = (icon: HTMLElement, head: string, text: string) => el('div', 'sn-feature', icon, el('div', '', el('h4', '', head), el('p', '', text)));
    const features = el(
      'div',
      '',
      feature(
        svg(ICON.autoNudge),
        'Dit træk',
        'Efter hvert spin regner maskinen alle 8 træk igennem. Kan mindst ét give gevinst, venter spillet på dig. Auto-juster vælger det træk, der giver mest med det samme.',
      ),
      feature(
        svg(ICON.spin),
        'Kædereaktion',
        'En gevinst splintrer sine symboler, nye falder ned, og urværket tikker ét hak. Brættet læses igen på næste trin af multiplikatorstigen, så længe der er gevinst.',
      ),
      feature(
        sym(SYM.WILD),
        'Stella Nova',
        `Hvert splintret symbol lader stjernen. Ved ${model.novaThreshold} ladninger eksploderer den, og alle symboler på de to inderste ringe bliver wild.`,
      ),
      feature(
        sym(SYM.SCATTER),
        'Kometnat',
        `${award[3]} eller ${award[4]} gratisspil, hvor den inderste ring er en krans af wilds. 2 kometer undervejs giver +${extra[2]} spil, 3 giver +${extra[3]}.`,
      ),
    );

    const maxKr = el('p');
    betBound.push(() => setText(maxKr, `Det svarer til ${formatKr(model.maxWinMultiple * bet)} ved den aktuelle indsats. Nås loftet, slutter spinnet.`));

    return el(
      'div',
      'sn-pane',
      sec('Sådan spiller du', steps),
      sec('Gevinsttabel', pay, betNote),
      sec('Multiplikatorstige', chips, el('p', 'sn-sec__note', 'Stiger ét trin for hver kædereaktion i samme spin og starter forfra ved næste spin.')),
      sec('Features', features),
      el('div', 'sn-callout sn-plq', el('span', 'sn-cap', 'Maksimal gevinst'), el('span', 'sn-callout__big', `${nf0.format(model.maxWinMultiple)}× indsatsen`), maxKr),
      el(
        'p',
        'sn-fineprint',
        `Demo uden rigtige penge. Teoretisk tilbagebetaling (RTP) er ${formatPercent(stats.rtp)} med auto-juster og ${formatPercent(stats.rtpNoNudge)}, hvis trækket aldrig bruges. Det, du ser på ringene, er altid den rigtige position.`,
      ),
    );
  }

  // ───────────────────────────── Matematik ─────────────────────────────

  let sim: Simulator | null = null;
  let run: { cancel(): void } | null = null;
  let runId = 0;
  let simSize = SIM_SIZES[0][0];
  let lastSpins = 0;

  const canvas = el('canvas');
  attr(canvas, { role: 'img', 'aria-label': 'Simuleret RTP mod antal spins' });
  const chartTip = el('div', 'sn-chart__tip');
  const chartEmpty = el('div', 'sn-chart__empty', 'Vælg antal spins, og kør simulationen. Kurven viser, hvordan den simulerede RTP nærmer sig modellens værdi.');
  const chart = createConvergenceChart(canvas, chartTip, { rtp: stats.rtp, stdDev: stats.stdDev, formatSpins });

  const sizeButtons = SIM_SIZES.map(([n, label]) => {
    const b = button('', `${label} spins`, label);
    attr(b, { role: 'radio', 'aria-checked': n === simSize ? 'true' : 'false' });
    b.addEventListener('click', () => {
      simSize = n;
      for (let i = 0; i < sizeButtons.length; i++) attr(sizeButtons[i], { 'aria-checked': SIM_SIZES[i][0] === n ? 'true' : 'false' });
    });
    return b;
  });
  const runBtn = el('button', 'sn-act sn-plq', 'Kør simulation');
  runBtn.type = 'button';
  runBtn.disabled = true;
  const progressFill = el('div', 'sn-progress__fill');
  const progressLabel = el('span', '', 'Ingen simulation endnu');
  const tileValues: HTMLElement[] = [];
  const tile = (label: string) => {
    const b = el('b', '', '–');
    tileValues.push(b);
    return el('div', 'sn-tile', el('span', 'sn-cap', label), b);
  };
  const tiles = el('div', 'sn-tiles', tile('RTP'), tile('Træfprocent'), tile('Kometnat'), tile('Stella Nova'), tile('Største gevinst'), tile('Spins'));

  function setRunning(on: boolean): void {
    toggleAttr(runBtn, 'data-running', on);
    setText(runBtn, on ? 'Stop' : 'Kør simulation');
    for (const b of sizeButtons) b.disabled = on;
  }

  function onProgress(p: SimProgress): void {
    lastSpins = p.spins;
    if (p.spins > 0) chart.push(p.spins, p.rtp);
    progressFill.style.setProperty('--p', Math.min(1, p.spins / Math.max(1, p.target)).toFixed(4));
    setText(progressLabel, p.done ? `Færdig: ${nf0.format(p.spins)} spins` : `${nf0.format(p.spins)} / ${nf0.format(p.target)}`);
    const every = (count: number) => (count > 0 ? `1 ud af ${nf0.format(Math.round(p.spins / count))}` : '–');
    setText(tileValues[0], formatPercent(p.rtp));
    setText(tileValues[1], formatPercent(p.hitFrequency, 1));
    setText(tileValues[2], every(p.freeSpinsTriggers));
    setText(tileValues[3], every(p.novaTriggers));
    setText(tileValues[4], formatMultiple(Math.round(p.maxMultiple * 10) / 10));
    setText(tileValues[5], formatSpins(p.spins));
    if (p.done) {
      run = null;
      setRunning(false);
    }
  }

  function stopSim(): void {
    if (!run) return;
    run.cancel();
    run = null;
    runId++;
    setRunning(false);
    setText(progressLabel, `Afbrudt ved ${nf0.format(lastSpins)} spins`);
  }

  function startSim(): void {
    if (!sim || run) return;
    const id = ++runId;
    lastSpins = 0;
    chartEmpty.style.display = 'none';
    chart.reset(simSize);
    progressFill.style.setProperty('--p', '0');
    setText(progressLabel, `0 / ${nf0.format(simSize)}`);
    setRunning(true);
    // A cancelled run may still deliver a queued chunk: the id filters it out.
    const handle = sim(simSize, (p) => {
      if (id === runId) onProgress(p);
    });
    if (id === runId && lastSpins < simSize) run = handle;
  }

  runBtn.addEventListener('click', () => (run ? stopSim() : startSim()));

  function mathPane(): HTMLElement {
    const kv = el('dl', 'sn-kv');
    const row = (label: string, value: string, note?: string, key = false) => {
      kv.append(el('dt', '', label, note ? el('small', '', note) : null), el('dd', key ? 'is-key' : '', value));
    };
    row('RTP med auto-juster', formatPercent(stats.rtp), 'Bedste træk i hvert spin', true);
    row('RTP uden træk', formatPercent(stats.rtpNoNudge), 'Hvis trækket aldrig bruges');
    row('Træfprocent', formatPercent(stats.hitFrequency, 1), 'Spins med gevinst');
    row('Gevinst på mindst indsatsen', formatPercent(stats.hitFrequencyAtLeastBet, 1));
    row('Standardafvigelse', `${nf1.format(stats.stdDev)} indsatser`, 'Pr. spin');
    row('Kometnat', `1 ud af ${nf0.format(Math.round(stats.freeSpinsEvery))} spins`);
    row('Stella Nova', `1 ud af ${nf0.format(Math.round(stats.novaEvery))} spins`);
    row('Største gevinst i beregningen', formatMultiple(Math.round(stats.maxObservedMultiple * 10) / 10));
    row('Maksimal gevinst', `${nf0.format(model.maxWinMultiple)}×`);
    row('Grundlag', `${formatSpins(stats.sampleSize)} spins`, `${model.name} ${model.version}`);

    const parts: [string, number, string][] = [
      ['Grundspil', stats.breakdown.base, 'var(--sn-viz-base)'],
      ['Dit træk', stats.breakdown.nudge, 'var(--sn-viz-nudge)'],
      ['Stella Nova', stats.breakdown.nova, 'var(--sn-viz-nova)'],
      ['Kometnat', stats.breakdown.freeSpins, 'var(--sn-viz-free)'],
    ];
    const split = el('div', 'sn-split');
    attr(split, { role: 'img', 'aria-label': parts.map(([name, v]) => `${name} ${formatPercent(v)}`).join(', ') });
    const legend = el('ul', 'sn-legend');
    for (const [name, v, color] of parts) {
      const bar = el('i');
      bar.style.setProperty('--c', color);
      bar.style.flex = `${Math.max(v, 0.0001)} 1 0px`;
      split.append(bar);
      const dot = el('i');
      dot.style.setProperty('--c', color);
      legend.append(el('li', '', dot, el('span', '', name), el('b', '', formatPercent(v))));
    }

    const seg = el('div', 'sn-seg', ...sizeButtons);
    attr(seg, { role: 'radiogroup', 'aria-label': 'Antal spins' });
    const key = (color: string, label: string, band = false) => {
      const mark = el('i');
      mark.style.setProperty('--c', color);
      toggleAttr(mark, 'data-band', band);
      return el('li', '', mark, label);
    };
    const lab = el(
      'div',
      'sn-lab',
      el('div', 'sn-lab__bar', seg, runBtn),
      el('div', 'sn-chart', canvas, chartTip, chartEmpty),
      el('ul', 'sn-keys', key('rgb(var(--rgb-gold))', 'Simuleret RTP'), key('repeating-linear-gradient(90deg, rgb(var(--rgb-comet)) 0 4px, transparent 4px 6px)', 'Modellens RTP'), key('rgb(var(--rgb-comet))', '95 %-interval', true)),
      el('div', 'sn-progress', el('div', 'sn-progress__track', progressFill), progressLabel),
      tiles,
    );

    return el(
      'div',
      'sn-pane',
      sec('Nøgletal', kv),
      sec('Hvor tilbagebetalingen kommer fra', split, legend),
      sec(
        'Simulation',
        el('p', 'sn-sec__note', 'Kør spillets egen motor med auto-juster, og se den simulerede RTP lægge sig ind mod modellens værdi. Jo flere spins, jo smallere bliver intervallet.'),
        lab,
      ),
    );
  }

  // ───────────────────────────── Indstillinger ─────────────────────────────

  const qualityButtons = QUALITIES.map(([q, label]) => {
    const b = button('', `Kvalitet: ${label.toLowerCase()}`, label);
    attr(b, { role: 'radio', 'aria-checked': 'false' });
    b.addEventListener('click', () => {
      setQuality(q);
      host.onQuality(q);
    });
    return b;
  });

  function setQuality(q: Quality): void {
    for (let i = 0; i < qualityButtons.length; i++) attr(qualityButtons[i], { 'aria-checked': QUALITIES[i][0] === q ? 'true' : 'false' });
  }

  const makeSwitch = (label: string, onChange: (on: boolean) => void) => {
    const b = button('sn-switch', label);
    attr(b, { role: 'switch', 'aria-checked': 'false' });
    b.addEventListener('click', () => onChange(b.getAttribute('aria-checked') !== 'true'));
    return b;
  };
  const turboSwitch = makeSwitch('Turbo', (on) => host.onTurbo(on));
  const autoNudgeSwitch = makeSwitch('Auto-juster', (on) => host.onAutoNudge(on));

  function settingsPane(): HTMLElement {
    const slider = (label: string, bus: 'music' | 'sfx') => {
      const input = el('input', 'sn-range');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.value = String(Math.round(host.volumes[bus] * 100));
      attr(input, { 'aria-label': `Lydstyrke, ${label.toLowerCase()}` });
      const pct = el('span', 'sn-set__pct');
      const sync = () => {
        input.style.setProperty('--v', `${input.value}%`);
        setText(pct, `${input.value} %`);
      };
      input.addEventListener('input', () => {
        sync();
        host.onVolume(bus, Number(input.value) / 100);
      });
      sync();
      return el('div', 'sn-set__row sn-set__row--slider', el('span', 'sn-set__label', label), input, pct);
    };
    const labelled = (label: string, note: string, control: HTMLElement) =>
      el('div', 'sn-set__row', el('span', 'sn-set__label', label, el('small', '', note)), control);

    const seg = el('div', 'sn-seg', ...qualityButtons);
    attr(seg, { role: 'radiogroup', 'aria-label': 'Grafikkvalitet' });

    const keys = el('dl', 'sn-keysheet');
    const keyRow = (caps: string[], text: string) => keys.append(el('dt', '', ...caps.map((c) => el('span', 'sn-kbd', c))), el('dd', '', text));
    keyRow(['Mellemrum'], 'Spin, eller spring animationen over');
    keyRow(['↑', '↓'], 'Vælg ring, når det er dit træk');
    keyRow(['←', '→'], 'Drej den valgte ring ét hak');
    keyRow(['Enter'], 'Spring trækket over');
    keyRow(['M'], 'Lyd til og fra');
    keyRow(['Esc'], 'Luk menuen');

    return el(
      'div',
      'sn-pane',
      sec('Lyd', el('div', 'sn-set', slider('Musik', 'music'), slider('Effekter', 'sfx'))),
      sec(
        'Grafik og spil',
        el(
          'div',
          'sn-set',
          labelled('Kvalitet', 'Lav skåner batteriet, høj giver skygger og flere partikler', seg),
          labelled('Turbo', 'Kortere animationer', turboSwitch),
          labelled('Auto-juster', 'Maskinen vælger selv det bedste træk', autoNudgeSwitch),
        ),
        el('p', 'sn-sec__note', 'Har du bedt dit system om mindre bevægelse, dæmper spillet selv rystelser og blink.'),
      ),
      sec('Tastatur', keys),
    );
  }

  // ───────────────────────────── Demo ─────────────────────────────

  function demoPane(): HTMLElement {
    const demoButton = (action: DemoAction, label: string, note: string) => {
      const b = el('button', 'sn-demo-btn sn-plq', label, el('small', '', note));
      b.type = 'button';
      b.addEventListener('click', () => {
        host.onDemo(action, label);
        close();
      });
      return b;
    };
    return el(
      'div',
      'sn-pane',
      el(
        'div',
        'sn-demo-note sn-plq',
        el('span', 'sn-cap', 'Kun i demoen'),
        el('p', '', 'Knapperne tvinger udfaldet af næste spin, så du kan se hver feature. De er ikke en del af spillets matematik og findes ikke i et rigtigt spil.'),
      ),
      sec('Udløs i næste spin', el('div', 'sn-demo-grid', ...RIGS.map(([kind, label, note]) => demoButton(kind, label, note)))),
      sec(
        'Saldo',
        el('div', 'sn-demo-grid', demoButton('addBalance', '+1.000 kr.', 'Læg demopenge på saldoen'), demoButton('resetBalance', 'Nulstil saldo', 'Tilbage til startsaldoen')),
      ),
    );
  }

  // ───────────────────────────── Sheet ─────────────────────────────

  const panes: Record<MenuTab, HTMLElement> = { rules: rulesPane(), math: mathPane(), settings: settingsPane(), demo: demoPane() };
  const tabButtons = TABS.map(([id, label]) => {
    const b = el('button', 'sn-tab', label);
    b.type = 'button';
    attr(b, { role: 'tab', id: `sn-tab-${id}`, 'aria-controls': `sn-pane-${id}`, 'aria-selected': 'false', tabindex: -1 });
    attr(panes[id], { role: 'tabpanel', id: `sn-pane-${id}`, 'aria-labelledby': `sn-tab-${id}` });
    b.addEventListener('click', () => select(id));
    return b;
  });
  const tablist = el('div', 'sn-tabs', ...tabButtons);
  attr(tablist, { role: 'tablist', 'aria-label': 'Menu' });
  tablist.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = (TABS.findIndex(([id]) => id === tab) + step + TABS.length) % TABS.length;
    select(TABS[i][0]);
    tabButtons[i].focus();
  });

  const body = el('div', 'sn-sheet__body', panes.rules, panes.math, panes.settings, panes.demo);
  const closeBtn = button('sn-ibtn', 'Luk menuen', svg(ICON.close));
  const panel = el('div', 'sn-sheet__panel', el('div', 'sn-sheet__head', el('h2', 'sn-sheet__title', svg(ICON.star), 'Stella Nova'), closeBtn), tablist, body);
  attr(panel, { tabindex: -1 });
  const root = el('div', 'sn-sheet', panel);
  attr(root, { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Menu', 'aria-hidden': 'true' });

  function select(next: MenuTab): void {
    tab = next;
    TABS.forEach(([id], i) => {
      const on = id === next;
      attr(tabButtons[i], { 'aria-selected': on ? 'true' : 'false', tabindex: on ? 0 : -1 });
      panes[id].classList.toggle('is-on', on);
    });
    body.scrollTop = 0;
    if (next === 'math') chart.draw();
  }

  function open(next?: MenuTab): void {
    select(next ?? tab);
    if (isOpen) return;
    isOpen = true;
    root.classList.add('is-open');
    attr(root, { 'aria-hidden': 'false' });
    panel.focus({ preventScroll: true });
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    // A simulation left running would steal frames from the game underneath.
    stopSim();
    root.classList.remove('is-open');
    attr(root, { 'aria-hidden': 'true' });
    host.onClosed();
  }

  closeBtn.addEventListener('click', close);
  root.addEventListener('click', (e) => {
    if (e.target === root) close();
  });
  select(tab);

  return {
    root,
    get isOpen() {
      return isOpen;
    },
    open,
    close,
    setBet(next) {
      if (next === bet) return;
      bet = next;
      for (const fn of betBound) fn();
    },
    setSymbolIcons(icons) {
      for (const { id, node } of symHolders) {
        const src = icons[id];
        if (!src) continue;
        const img = el('img');
        img.alt = '';
        img.decoding = 'async';
        img.src = src;
        node.replaceChildren(img);
      }
    },
    setSimulator(next) {
      sim = next;
      runBtn.disabled = false;
    },
    setQuality,
    setTurbo(on) {
      attr(turboSwitch, { 'aria-checked': on ? 'true' : 'false' });
    },
    setAutoNudge(on) {
      attr(autoNudgeSwitch, { 'aria-checked': on ? 'true' : 'false' });
    },
    relayout() {
      if (isOpen && tab === 'math') chart.draw();
    },
  };
}
