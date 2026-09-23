// Terningen · every dice string lives here (pure: no DOM). Numbers come from REPORT through the formatters below —
// never typed in — so the copy follows `npm run sim` and the model hash. Myth is always legend ("Man siger …"),
// the facts always sit next to it, and the payback idea appears in ONE sanctioned sentence (rules + placard only).
import { fmtInt, fmtKr, fmtPct, fmt1 } from '../core/format.ts';
import { CONFIG, REPORT, type MathConfig, type MathReport } from '../math/config.ts';
import { T } from '../present/schedule.ts';
import { DICE_GOAL, DICE_MIN_X, fmtDice, diceWord, type DiceView } from '../game/dice.ts';

/** Legal swap flag: false removes the payback idea from the rules and the placard without a redesign. */
export const AUTOMAT_PAYBACK_CLAUSE = true;

const X = `${DICE_MIN_X}×`;
const G = String(DICE_GOAL);

// ---------------------------------------------------------------- numbers (REPORT → text)
const round1000 = (x: number) => fmtInt(Math.round(x / 1000) * 1000);
const floor10 = (x: number) => Math.floor(x / 10) * 10;
const round100 = (x: number) => fmtInt(Math.round(x / 100) * 100);

export interface DiceNumbers {
  per: string; perBase: string; ratePct: string; stormPct: string; firstMedian: string;
  spins: string; spinsP5: string; spinsP95: string; hours: string; floorSecs: string; lossPct: string;
  lowStake: string; lowKr: string; lowP5: string; lowP95: string; stake: string; kr: string; krP5: string; krP95: string;
  lossShare: string; rtp: string; model: string; journeys: string;
}
/** Spins rounded to 1.000, hours floored to 10, kr rounded to 100, percentages via fmtPct (spec: copy). */
export function diceNumbers(R: MathReport = REPORT, C: MathConfig = CONFIG): DiceNumbers {
  const low = C.stakesOre[0], std = C.defaultStakeOre;
  const kr = (x: number, ore: number) => round100((x * ore) / 100);
  return {
    per: fmtInt(Math.round(1 / R.diceRate)),
    perBase: fmtInt(Math.round(1 / R.diceRateBase)),
    ratePct: fmtPct(R.diceRate, 2),
    stormPct: `${Math.round(R.diceStormShare * 100)} %`,
    firstMedian: fmtInt(R.diceFirstMedian),
    spins: round1000(R.dice1948Spins), spinsP5: round1000(R.dice1948SpinsP5), spinsP95: round1000(R.dice1948SpinsP95),
    hours: fmtInt(floor10((R.dice1948Spins * T.floor) / 3600)),
    floorSecs: fmt1(T.floor),
    lossPct: `${Math.round((1 - R.rtp) * 100)} %`,
    lowStake: fmtKr(low), lowKr: kr(R.dice1948LossX, low), lowP5: kr(R.dice1948LossP5X, low), lowP95: kr(R.dice1948LossP95X, low),
    stake: fmtKr(std), kr: kr(R.dice1948LossX, std), krP5: kr(R.dice1948LossP5X, std), krP95: kr(R.dice1948LossP95X, std),
    lossShare: `${Math.round(R.dice1948LossShare * 100)} %`,
    rtp: fmtPct(R.rtp, 1),
    model: C.modelHash.slice(0, 8),
    journeys: fmtInt(R.diceJourneys),
  };
}

/** "37 terninger" / "1 terning" / "0 terninger" — plain digits up to 9999 (fmtDice). */
export const countWord = (n: number) => `${fmtDice(n)} ${diceWord(n)}`;

// ---------------------------------------------------------------- HUD chip + desktop panel
export const CHIP_TITLE = 'Terningekammeret';
export const DEMO_TAG = '+1 demo';
export function chipAria(n: number, unlock: DiceView['unlock']): string {
  const s = unlock === 'pending' ? ' Porten kan åbnes.' : unlock === 'seen' ? ' Porten står åben.' : '';
  return `Terninger: ${fmtDice(n)}.${s} Åbn Terningekammeret.`;
}
export const PANEL = { h: 'Terningekammeret', link: 'Porten under klinten ›' };

// ---------------------------------------------------------------- award
export const awardCaption = (n: number) => `TERNING NR. ${fmtDice(n)}`;
export const DEMO_CAPTION = 'DEMO · TÆLLER IKKE';
export const srAward = (n: number) => `Terning nr. ${fmtDice(n)} er lagt i Terningekammeret.`;
export const srStormPop = (n: number) => `Terning nr. ${fmtDice(n)}. Den lægges i kammeret, når stormen har lagt sig.`;
export const srStormOutro = (k: number) => `${countWord(k)} fra stormen er lagt i Terningekammeret.`;
export const heldOverflow = (m: number) => `+${m}`;
export const stormSummaryRow = (k: number, demo: boolean) => ({ label: demo ? 'Terninger · demo · tæller ikke' : 'Terninger fra stormen', value: fmtDice(k) });
export const DEMO_STORM_NOTE = 'Demo-udløst storm · krediteres ikke saldoen · tæller ikke i statistikken · giver ingen terninger';
export const DEMO_DIE_BANNER = { t: 'DEMO · TERNING', s: 'Sådan ser en terning ud · tæller ikke med' };

// ---------------------------------------------------------------- first-visit introduction (#hello, non-modal)
export function helloCopy(R: MathReport = REPORT) {
  const k = diceNumbers(R);
  return {
    eyebrow: 'TERNINGEKAMMERET',
    title: 'Terningen',
    body: `Hvert spin, der vinder mindst ${X} indsatsen, giver en terning. Den lægges i Terningekammeret.`,
    myth: `Man siger, at porten derinde blev lukket i 1948 – og at den åbner ved ${G} terninger.`,
    facts: `I gennemsnit tager ${G} terninger ca. ${k.spins} spin. Automat 1948 bag porten er et koncept. Terninger udløber ikke.`,
    see: 'Se kammeret',
    close: 'Luk',
    sr: `Terningen. Hvert spin, der vinder mindst ${DICE_MIN_X} gange indsatsen, giver en terning til Terningekammeret. Man siger, at porten derinde blev lukket i 1948, og at den åbner ved ${G} terninger. I gennemsnit tager det ca. ${k.spins} spin. Automat 1948 er et koncept.`,
  };
}
export function helloHtml(R: MathReport = REPORT): string {
  const c = helloCopy(R);
  return `<canvas class="medal" aria-hidden="true"></canvas>
    <p class="eb">${c.eyebrow}</p><h3 id="helloTitle">${c.title}</h3>
    <p class="b">${c.body}</p><p class="m">${c.myth}</p><p class="facts">${c.facts}</p>
    <div class="btns"><button class="btn ghost small" data-hello="chamber">${c.see}</button><button class="btn ghost small" data-hello="close">${c.close}</button></div>`;
}

// ---------------------------------------------------------------- first-die card (modal, once)
export function firstDieCopy(R: MathReport = REPORT) {
  const k = diceNumbers(R);
  return {
    eyebrow: 'TERNING NR. 1',
    title: 'Din første terning',
    body1: `Den er lagt i Terningekammeret. Du får en terning, hver gang et spin vinder mindst ${X} sin indsats – indsatsens størrelse er ligegyldig.`,
    body2: `Ved ${G} terninger åbner porten i kammeret ind til Automat 1948 – et koncept i denne demo.`,
    facts: `I gennemsnit tager ${G} terninger ca. ${k.spins} spin. Terninger udløber ikke og har ingen pengeværdi.`,
    see: 'Se kammeret',
    ok: 'Forstået',
    sr: `Din første terning, nummer 1, er lagt i Terningekammeret. Du får en terning, hver gang et spin vinder mindst ${DICE_MIN_X} gange sin indsats. Ved ${G} terninger åbner porten ind til Automat 1948, et koncept i denne demo. I gennemsnit tager det ca. ${k.spins} spin.`,
  };
}
export const firstDieDemoNote = (n: number) => `DEMO · Sådan møder man den første terning · dit antal er uændret (${fmtDice(n)})`;
/** `demoN` = the real count when opened with the demo tool (the amber note goes first). */
export function firstDieHtml(demoN: number | null, R: MathReport = REPORT): string {
  const c = firstDieCopy(R);
  return `<canvas class="medal" aria-hidden="true"></canvas>
    ${demoN !== null ? `<div class="demo-note">${firstDieDemoNote(demoN)}</div>` : ''}
    <h2>${c.eyebrow}</h2><div class="t" id="dcTitle">${c.title}</div>
    <p>${c.body1}</p><p>${c.body2}</p><p class="facts">${c.facts}</p>
    <div class="btns"><button class="btn ghost small" data-act="chamber">${c.see}</button><button class="btn small" data-act="ok" data-primary>${c.ok}</button></div>`;
}

// ---------------------------------------------------------------- unlock card (real, once)
export const unlockCardCopy = (n: number) => ({
  eyebrow: `TERNING NR. ${fmtDice(n)}`,
  big: G,
  sub: `Alle ${G} fliser i porten lyser.`,
  body: 'Porten under klinten kan åbnes – nu eller en anden gang.',
  later: 'Ikke nu',
  open: 'Åbn porten',
});
/** Inert to SPIN/Space: focus goes to the heading (data-focus), never to a button. */
export function unlockCardHtml(n: number): string {
  const c = unlockCardCopy(n);
  return `<canvas class="medal" aria-hidden="true"></canvas>
    <h2 tabindex="-1" data-focus>${c.eyebrow}</h2><div class="big1948 num">${c.big}</div><div class="t">${c.sub}</div>
    <p>${c.body}</p>
    <div class="btns"><button class="btn ghost small" data-act="later">${c.later}</button><button class="btn small gate" data-act="gate">${c.open}</button></div>`;
}

// ---------------------------------------------------------------- Terningekammeret
export type GateState = 'sealed' | 'pending' | 'open';
export const gateState = (v: DiceView): GateState => (v.unlock === 'seen' ? 'open' : v.unlock === 'pending' || v.count >= DICE_GOAL ? 'pending' : 'sealed');

export const CHAMBER = {
  eyebrow: 'Terningekammeret · Møns Klint',
  title: 'Porten under klinten',
  close: 'Luk Terningekammeret',
  concept: 'Koncept · findes ikke i denne demo',
  previewTag: 'forhåndsvisning',
  open: 'Åbn porten',
  openStatus: 'Porten står åben.',
  replay: 'Se åbningen igen',
  rules: 'Regler og tal ›',
  rulesAria: 'Regler og tal for Terningen',
  done: 'Luk',
};
/** Pixi labels (GateView / ceremony). "AUTOMAT 1948" is never shown without the concept label directly under it. */
export const GATE_LABELS = { lintel: G, niche: 'NORDLYS', title: 'AUTOMAT 1948', concept: 'KONCEPT · FINDES IKKE I DENNE DEMO' };

export interface MythLine { t: string; tone: 'cool' | 'ice' | 'strong' | 'muted'; pair?: 1 | 2; n: number }
/** Myth lines per state. Lines 1–3 are pair 1, lines 5–6 + the concept chip are pair 2 (never split). */
export function chamberMyth(state: GateState, condensed = false): MythLine[] {
  const p2a = state === 'pending' ? 'Porten kan åbnes' : state === 'open' ? 'Porten står åben' : 'Når alle lyser, åbner porten';
  if (condensed) {
    return [
      { t: 'Man siger, at porten under klinten blev lukket i 1948.', tone: 'cool', pair: 1, n: 1 },
      state === 'sealed'
        ? { t: `Ved ${G} terninger åbner den ind til Automat 1948.`, tone: 'strong', pair: 2, n: 5 }
        : { t: `Alle ${G} fliser lyser. ${p2a} ind til Automat 1948.`, tone: 'strong', pair: 2, n: 5 },
    ];
  }
  return [
    { t: 'Man siger, at der under klinten', tone: 'cool', pair: 1, n: 1 },
    { t: 'står en port af kridt og is,', tone: 'cool', pair: 1, n: 2 },
    { t: 'og at den blev lukket i 1948.', tone: 'cool', pair: 1, n: 3 },
    { t: state === 'sealed' ? `Hver terning tænder én af dens ${G} fliser.` : `Alle ${G} fliser lyser.`, tone: 'ice', n: 4 },
    { t: p2a, tone: 'strong', pair: 2, n: 5 },
    { t: 'ind til Automat 1948.', tone: 'strong', pair: 2, n: 6 },
    { t: state === 'open' ? 'Lyset fra porten falder ud over stranden.' : 'Bag den står endnu kun en idé – og et årstal.', tone: 'muted', n: 7 },
  ];
}
/** F1–F3: never dropped by any fit step. */
export function chamberFacts(R: MathReport = REPORT): [string, string, string] {
  const k = diceNumbers(R);
  return [
    `1 terning pr. spin, der vinder mindst ${X} sin indsats – også Ladede spin og stormspin. Indsatsen er ligegyldig.`,
    `I gennemsnit 1 terning pr. ${k.per} betalte spin, tilfældigt fordelt. ${G} terninger kræver ca. ${k.spins} spin – mindst ca. ${k.hours} timers spil.`,
    `Undervejs taber man i gennemsnit ca. ${k.lossPct} af indsatserne. Terninger har ingen pengeværdi og udløber ikke. De fem mørke automater er pladsholdere.`,
  ];
}
/** #chSum: the canvas is aria-hidden and fully described here. `realN` is the player's own count (previews). */
export function chamberSummary(v: DiceView, realN: number): string {
  const st = gateState(v);
  const have = v.mode === 'real' ? `Du har ${countWord(v.count)}.` : `Forhåndsvisning med ${countWord(v.count)}. Dit antal er uændret (${fmtDice(realN)}).`;
  const gate = st === 'pending' ? ` Alle ${G} fliser lyser, og porten kan åbnes.` : st === 'open' ? ' Porten står åben.' : '';
  return `Terningekammeret. Man siger, at porten under klinten blev lukket i 1948. Den har ${G} fliser, og hver terning tænder én. ${have}${gate} I nicherne står seks automater: NORDLYS lyser, de fem andre er mørke pladsholdere. Automat 1948 er et koncept og findes ikke i denne demo.`;
}
/** Ribbons (DOM in #chamber — #clean never hides them). Replay is neutral, the others amber. */
export type RibbonKind = 'preview' | 'demo' | 'replay';
export function chamberRibbon(kind: RibbonKind, N: number, realN: number): string {
  if (kind === 'replay') return 'GENSYN · Åbningen vises igen · intet ændrer sig';
  if (kind === 'demo') return `DEMO · Portens åbning vist med demo-værktøjet · tæller ikke · dit antal er uændret (${fmtDice(realN)})`;
  return N >= DICE_GOAL
    ? `FORHÅNDSVISNING · ${countWord(N)} · porten åben · dit antal er uændret (${fmtDice(realN)})`
    : `FORHÅNDSVISNING · ${countWord(N)} · dit antal er uændret (${fmtDice(realN)})`;
}

// ---------------------------------------------------------------- ceremony + placard
export type CeremonyKind = 'real' | 'demo' | 'replay';
export const ceremonyEyebrow = (kind: CeremonyKind, n: number) => (kind === 'real' ? `TERNING NR. ${fmtDice(n)}` : kind === 'demo' ? 'DEMO · FORHÅNDSVISNING' : 'GENSYN');
export const srCeremonyStart = (kind: CeremonyKind, n: number) =>
  kind === 'real' ? `Terning nr. ${fmtDice(n)}. Porten under klinten åbner.` : kind === 'demo' ? `Demo: portens åbning ved ${G} terninger. Tæller ikke.` : 'Gensyn af portens åbning.';
export const SR_CEREMONY_END = 'Porten er åben. Automat 1948 er et koncept og findes ikke i denne demo.';
export const demoGateBanner = (n: number) => ({ t: 'DIN SAMLING ER UÆNDRET', s: `${countWord(n)} · demo-åbningen talte ikke med` });

/** THE sanctioned sentence (rules + placard only, behind AUTOMAT_PAYBACK_CLAUSE) and its always-present guard. */
export const PAYBACK_SENTENCE = 'I konceptet er Automat 1948 tænkt med højere tilbagebetaling end de andre automater.';
export const NOT_AN_OFFER = 'Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling.';
const clauseText = (clause: boolean) => (clause ? `${PAYBACK_SENTENCE} ${NOT_AN_OFFER}` : NOT_AN_OFFER);

export function placardCopy(kind: CeremonyKind, n: number, clause = AUTOMAT_PAYBACK_CLAUSE) {
  return {
    eyebrow: kind === 'demo' ? 'DEMO · FORHÅNDSVISNING' : 'PORTEN ER ÅBEN',
    demoNote: kind === 'demo' ? `DEMO · Porten er åbnet med demo-værktøjet · dit antal terninger er uændret (${fmtDice(n)})` : null,
    title: 'Automat 1948',
    concept: CHAMBER.concept,
    p1: `Bag porten skulle Automat 1948 stå: en automat for dem, der har samlet ${G} terninger.`,
    p2: clauseText(clause),
    p3: 'Et årstal. En nøgle.',
    p4: kind === 'real' ? 'Dine terninger bliver i kammeret, og tællingen fortsætter. Intet i NORDLYS ændrer sig.' : null,
    buttons: kind === 'real'
      ? [{ act: 'chamber', label: 'Se kammeret' }, { act: 'back', label: 'Tilbage til NORDLYS', primary: true }]
      : kind === 'replay' ? [{ act: 'close', label: 'Luk', primary: true }] : [{ act: 'endDemo', label: 'Afslut demo', primary: true }],
  };
}
export function placardHtml(kind: CeremonyKind, n: number, clause = AUTOMAT_PAYBACK_CLAUSE): string {
  const c = placardCopy(kind, n, clause);
  const btn = (b: { act: string; label: string; primary?: boolean }) => `<button class="btn small${b.primary ? '' : ' ghost'}" data-act="${b.act}"${b.primary ? ' data-primary' : ''}>${b.label}</button>`;
  return `${c.demoNote ? `<div class="demo-note">${c.demoNote}</div>` : ''}
    <h2>${c.eyebrow}</h2><div class="t" id="plTitle">${c.title}</div><span class="chip concept">${c.concept}</span>
    <div class="pl-body"><p>${c.p1}</p><p>${c.p2}</p><p class="muted">${c.p3}</p>${c.p4 ? `<p>${c.p4}</p>` : ''}</div>
    <div class="btns">${c.buttons.map(btn).join('')}</div>`;
}

// ---------------------------------------------------------------- menu, other tabs, settings
export const MENU = {
  tab: 'Terningen',
  open: 'Åbn Terningekammeret',
  status: (n: number) => `Du har ${countWord(n)}.`,
  kpHint: 'Terninger er ikke en del af ladningen og udløber ikke.',
  histIntro: ' Spin, der gav en terning, er mærket »terning«.',
  histMark: ' · terning',
  rgLine: ' Terningerne har ingen tidsfrister, streaks, daglige belønninger eller påmindelser og udløber ikke – en pause koster ingen terninger. Terning-tælleren kan slås fra under Indstillinger.',
  setting: 'Vis terninger i spillet',
  settingHint: 'Slået fra: ingen terningtæller og ingen terning-animationer. Terningerne tælles stadig og kan ses under Terningen i menuen.',
  storage: 'Lagring er ikke tilgængelig · fremskridt og terninger gemmes kun i denne fane',
};

// ---------------------------------------------------------------- demo drawer
export const DRAWER = {
  h: 'Terningen',
  die: 'Vis en terning',
  first: 'Vis første terning',
  gate: `Åbn porten · ${G}`,
  segLabel: 'Vis kammeret med (kun visning)',
  segAria: 'Vis kammeret med et antal terninger – kun visning',
  seg: (n: number) => (n >= DICE_GOAL ? `${G} · åben` : String(n)),
  warn: 'Kun til demonstration. Findes ikke i den rigtige version. Demo-storme krediteres ikke saldoen og tæller ikke i statistikken. Demo-værktøjerne giver aldrig terninger og ændrer ikke dit antal.',
  hintHtml: '"Vis Kp" ændrer kun himlen og buen – din rigtige måler røres ikke. Terning-værktøjerne ændrer kun visningen – dit antal terninger røres ikke. Genveje: Mellemrum = spin · E = demo · T = Terningekammeret · M = lyd · Esc = spring over. Direkte links: tilføj <code>#solstorm</code> (demo-stormen), <code>#1948</code> (portens åbning), <code>#kammer</code> (Terningekammeret) eller <code>#terning</code> (en terning) til adressen.',
  resetBanner: (balance: string) => ({ t: 'DEMO NULSTILLET', s: `Saldo ${balance} · Kp 0 · 0 terninger` }),
};

// ---------------------------------------------------------------- rules (Regler & RTP + the "Terningen" tab)
/** The whole rules section. Every number is generated from REPORT (tied to modelHash); nothing is hard-coded. */
export function diceRulesHtml(R: MathReport = REPORT, C: MathConfig = CONFIG, clause = AUTOMAT_PAYBACK_CLAUSE): string {
  const k = diceNumbers(R, C);
  return `
      <h4>Terningen</h4>
      <p>Hvert spin, der vinder <b>mindst ${DICE_MIN_X} gange sin indsats</b>, giver <b>én terning</b>. Det gælder almindelige spin, Ladede spin (målt mod den låste indsats) og hvert enkelt stormspin i Solstorm (målt mod stormens indsats). Gevinsterne fra alle kaskader i samme spin lægges sammen, og et spin giver højst én terning.</p>
      <p>Indsatsens størrelse er ligegyldig: terningen kommer lige ofte ved alle indsatser. <b>En højere indsats giver ikke flere terninger – kun et større forventet tab.</b></p>
      <p>Stormgarantien er ikke et spin og giver ingen terning. Demo-storme og demo-værktøjer giver aldrig terninger og ændrer aldrig dit antal.</p>
      <p>Terningerne udløber ikke og nulstilles ikke, når din ladning (Kp) udløber. De har ingen pengeværdi, ændrer ikke gevinster, sandsynligheder eller tilbagebetalingen (RTP) i NORDLYS og kan ikke købes, veksles eller overføres. Spin, der gav en terning, er mærket i Historik. I denne demo gemmes terningerne i din browser, og "Nulstil demo" sletter dem.</p>
      <h4>Terningekammeret og porten</h4>
      <p>Terningerne samles i Terningekammeret. I fortællingen ligger kammeret under Møns Klint, og porten har ${G} fliser af is. Hver terning tænder én flise. Ved ${G} terninger kan porten åbnes. Terningerne bruges ikke, og tællingen fortsætter bagefter.</p>
      <p>I konceptet samler flere automater terninger til det samme kammer. De fem mørke automater i kammeret er pladsholdere: i denne demo findes kun NORDLYS, og kun NORDLYS giver terninger.</p>
      <h4>Automat 1948</h4>
      <p>Bag porten skulle Automat 1948 stå: en automat for dem, der har samlet ${G} terninger. ${clauseText(clause)}</p>
      <p>En rigtig version skulle have sine egne regler og sin egen RTP.</p>
      <h4>Tal for Terningen</h4>
      <div class="kv num">
        <span>Terning pr. betalt spin (inkl. Ladede spin og stormspin)</span><span>ca. ${k.ratePct} · 1 pr. ${k.per}</span>
        <span>· kun almindelige og Ladede spin</span><span>1 pr. ${k.perBase}</span>
        <span>· andel fra stormspin</span><span>ca. ${k.stormPct}</span>
        <span>Første terning (median)</span><span>efter ca. ${k.firstMedian} spin</span>
        <span>Betalte spin til ${G} terninger</span><span>ca. ${k.spins}</span>
        <span>· 90 % af forløbene</span><span>ca. ${k.spinsP5}–${k.spinsP95}</span>
        <span>Spilletid (mindst ${k.floorSecs} s pr. spin)</span><span>mindst ca. ${k.hours} timer</span>
        <span>Forventet nettotab undervejs</span><span>ca. ${k.lossPct} af indsatserne</span>
        <span>· ved ${k.lowStake} pr. spin</span><span>ca. ${k.lowKr} kr (90 %: ca. ${k.lowP5}–${k.lowP95} kr)</span>
        <span>· ved ${k.stake} pr. spin</span><span>ca. ${k.kr} kr (90 %: ca. ${k.krP5}–${k.krP95} kr)</span>
        <span>Forløb med nettotab ved terning nr. ${G}</span><span>ca. ${k.lossShare}</span>
      </div>
      <p class="hint">Tallene er gennemsnit fra simulering med spillets egen matematik (RTP ${k.rtp}, model ${k.model}, ${k.journeys} simulerede forløb til ${G} terninger). Terningerne kommer tilfældigt, uden faste mellemrum. Antallet af spin til ${G} terninger varierer kun lidt fra spiller til spiller; tabet undervejs varierer mere. Tabet er et forventet tab – ikke en pris for at åbne porten.</p>
      <p><b>Terningerne er et minde om store gevinster – ikke en grund til at spille videre.</b> Porten er ikke noget, du skal nå: den viser, hvor sjældne de store gevinster er. Spil aldrig længere eller for mere for at samle terninger.</p>`;
}
