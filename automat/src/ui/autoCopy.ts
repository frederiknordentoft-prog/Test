// Autospin · every string lives here (pure: no DOM). A loss limit is mandatory; the stop reasons say why, in plain words.
import { fmtKr, fmtSignedKr, fmt1 } from '../core/format.ts';
import { AUTO_COUNTS, type AutoStop } from '../game/auto.ts';
import { T } from '../present/schedule.ts';

const counts = `${AUTO_COUNTS.slice(0, -1).join(', ')} eller ${AUTO_COUNTS[AUTO_COUNTS.length - 1]}`;

const STOP: Partial<Record<AutoStop, string>> = {
  done: 'Autospin færdig',
  die: 'Autospin stoppet ved en terning',
  perk: 'Autospin stoppet · Ladet spin er klar',
  storm: 'Autospin stoppet · Solstorm',
  loss: 'Autospin stoppet · tabsgrænsen er nået',
  balance: 'Autospin stoppet · saldoen er for lav',
  menu: 'Autospin stoppet · menuen blev åbnet',
  hidden: 'Autospin stoppet · fanen var skjult',
};

export const AUTO = {
  title: 'Autospin',
  pill: 'AUTO',
  pillAria: 'Autospin: vælg antal spin og tabsgrænse',
  pillTitle: 'Autospin (A)',
  stopWord: 'STOP',
  spinsLabel: 'Antal spin',
  limitLabel: 'Tabsgrænse',
  limitHint: (limitOre: number) => `Autospin stopper, før tabet i denne runde bliver større end ${fmtKr(limitOre)}.`,
  start: 'Start autospin',
  close: 'Luk',
  count: (n: number) => `${n} spin`,
  stopCap: (left: number) => `STOP · ${left}`,
  stopAria: (left: number) => `Stop autospin. Der er ${left} spin i køen.`,
  stop: (r: AutoStop) => STOP[r] ?? 'Autospin stoppet',
  summary: (spins: number, netOre: number) => `${spins} spin · netto ${fmtSignedKr(netOre)}`,
  sr: (r: AutoStop, spins: number, netOre: number) => `${STOP[r] ?? 'Autospin stoppet'}. ${spins} spin, netto ${fmtSignedKr(netOre)}.`,
  rules: `Vælg ${counts} spin og en tabsgrænse. Hvert spin tager mindst ${fmt1(T.floor)} s, præcis som når du trykker selv, og der er ingen turbo. Autospin stopper ved hver terning, ved Ladet spin, ved Solstorm, før tabet i runden ville overstige tabsgrænsen, når saldoen ikke rækker, og når du åbner menuen, skifter fane eller trykker STOP. Indsatsen er låst, og autospin fortsætter aldrig efter en genindlæsning.`,
};
/** Every stop reason (the copy-lint renders them all). */
export const AUTO_STOPS: AutoStop[] = ['done', 'player', 'die', 'perk', 'storm', 'loss', 'balance', 'menu', 'hidden', 'demo', 'chamber', 'card', 'offer', 'stake', 'reset'];
