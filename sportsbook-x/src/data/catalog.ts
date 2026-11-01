import { bo3Win, priceFromProb } from '../odds/model';
import { generateFeed, probsAt, type FeedEvent } from '../odds/feed';

export type Category = 'fodbold' | 'esport' | 'politik' | 'vejr' | 'awards';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'fodbold', label: 'Fodbold' },
  { id: 'esport', label: 'Esport' },
  { id: 'politik', label: 'Politik' },
  { id: 'vejr', label: 'Vejr' },
  { id: 'awards', label: 'Awards' },
];

export interface Fixture {
  id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  /** Mock expected goals for the full match. */
  lamH: number;
  lamA: number;
  seed: string;
}

export const FIXTURES: Fixture[] = [
  { id: 'sl-1', league: 'Superligaen', home: 'FC København', away: 'Brøndby IF', kickoff: '8. nov · 18:00', lamH: 1.55, lamA: 1.15, seed: 'sl-1-2026' },
  { id: 'cl-1', league: 'Champions League', home: 'Bayern München', away: 'Real Madrid', kickoff: '11. nov · 21:00', lamH: 1.8, lamA: 1.5, seed: 'cl-1-2026' },
  { id: 'pl-1', league: 'Premier League', home: 'Liverpool', away: 'Manchester City', kickoff: '14. nov · 16:30', lamH: 1.45, lamA: 1.6, seed: 'pl-1-2026' },
];

export interface Selection {
  id: string;
  label: string;
  prob: number;
  odds: number;
}

export interface Rules {
  source: string;
  cutoff: string;
  edge: string;
  changes: { date: string; text: string }[];
}

export interface Market {
  id: string;
  category: Category;
  fixtureId: string | null;
  league: string;
  title: string;
  /** 'row' = a few side-by-side choices. 'ladder' = ranked outright list. */
  layout: 'row' | 'ladder';
  margin: number;
  selections: Selection[];
  /** Info-only rows, never tappable (e.g. "Andet"). */
  infoRows: { label: string; prob: number }[];
  rules: Rules;
  /** Football-only: the fixture's clock and feed drive the probabilities. */
  live: boolean;
}

const DEMO_RULE_NOTE = 'Demo: regler er illustrative.';

function row(id: string, labels: string[], probs: number[], margin: number): Selection[] {
  return labels.map((label, i) => ({
    id: `${id}:${i}`,
    label,
    prob: probs[i],
    odds: priceFromProb(probs[i], margin),
  }));
}

function ladder(id: string, rows: { label: string; weight: number }[], andet: number, margin: number): { selections: Selection[]; infoRows: { label: string; prob: number }[] } {
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const named = rows.map((r, i) => {
    const prob = (r.weight / total) * (1 - andet);
    return { id: `${id}:${i}`, label: r.label, prob, odds: priceFromProb(prob, margin) };
  });
  named.sort((a, b) => b.prob - a.prob);
  return { selections: named, infoRows: [{ label: 'Andet', prob: andet }] };
}

const FEEDS: Record<string, FeedEvent[]> = Object.fromEntries(
  FIXTURES.map((f) => [f.id, generateFeed(f.seed, f.lamH, f.lamA)]),
);

export function feedFor(fixtureId: string): FeedEvent[] {
  return FEEDS[fixtureId] ?? [];
}

export function fixtureFor(id: string): Fixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}

/** Football markets priced from the fixture's clock at `minute`. */
export function footballMarkets(f: Fixture, minute: number): Market[] {
  const feed = feedFor(f.id);
  const p = probsAt(feed, f.lamH, f.lamA, minute);
  const base = { category: 'fodbold' as const, fixtureId: f.id, league: f.league, live: true };
  return [
    {
      ...base,
      id: `${f.id}:1x2`,
      title: `Kampens vinder`,
      layout: 'row',
      margin: 0.05,
      selections: row(`${f.id}:1x2`, [f.home, 'Uafgjort', f.away], [p.home, p.draw, p.away], 0.05),
      infoRows: [],
      rules: {
        source: 'Resultat efter 90 minutter, inkl. tillægstid.',
        cutoff: `Ved slutfløjt. Kickoff ${f.kickoff}.`,
        edge: `Udsat kamp: markedet annulleres. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
    {
      ...base,
      id: `${f.id}:ou`,
      title: 'Antal mål',
      layout: 'row',
      margin: 0.06,
      selections: row(`${f.id}:ou`, ['Over 2,5', 'Under 2,5'], [p.over25, p.under25], 0.06),
      infoRows: [],
      rules: {
        source: 'Samlet antal mål efter 90 minutter.',
        cutoff: 'Ved slutfløjt.',
        edge: `Mål i forlænget spil tæller ikke. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
    {
      ...base,
      id: `${f.id}:btts`,
      title: 'Begge hold scorer',
      layout: 'row',
      margin: 0.06,
      selections: row(`${f.id}:btts`, ['Ja', 'Nej'], [p.bttsYes, p.bttsNo], 0.06),
      infoRows: [],
      rules: {
        source: 'Begge hold scorer mindst ét mål i kampen.',
        cutoff: 'Ved slutfløjt.',
        edge: DEMO_RULE_NOTE,
        changes: [],
      },
    },
  ];
}

/** Non-live markets. Probabilities are fixed mock values. */
export function staticMarkets(): Market[] {
  const cl = ladder(
    'cl-winner',
    [
      { label: 'Bayern München', weight: 0.22 },
      { label: 'Real Madrid', weight: 0.18 },
      { label: 'Manchester City', weight: 0.15 },
      { label: 'Liverpool', weight: 0.1 },
      { label: 'Arsenal', weight: 0.09 },
      { label: 'Barcelona', weight: 0.08 },
      { label: 'Inter', weight: 0.06 },
      { label: 'PSG', weight: 0.05 },
    ],
    0.04,
    0.1,
  );
  const esportP = bo3Win(0.56);
  const politik = ladder(
    'politik-parti',
    [
      { label: 'Parti A', weight: 0.38 },
      { label: 'Parti B', weight: 0.27 },
      { label: 'Parti C', weight: 0.19 },
      { label: 'Parti D', weight: 0.1 },
    ],
    0.06,
    0.1,
  );
  const awards = ladder(
    'awards-spiller',
    [
      { label: 'Spiller Nilsen', weight: 0.4 },
      { label: 'Spiller Larsen', weight: 0.3 },
      { label: 'Spiller Berg', weight: 0.2 },
    ],
    0.1,
    0.1,
  );
  const rain = 0.32;
  return [
    {
      id: 'cl-winner',
      category: 'fodbold',
      fixtureId: null,
      league: 'Champions League',
      title: 'Vinder af Champions League 2026/27',
      layout: 'ladder',
      margin: 0.1,
      ...cl,
      live: false,
      rules: {
        source: 'Vinder af finalen, afgjort i 90 minutter, forlænget spil eller straffesparkskonkurrence.',
        cutoff: 'Ved finalens slutfløjt.',
        edge: `Ved aflysning af finalen: markedet annulleres. ${DEMO_RULE_NOTE}`,
        changes: [{ date: '20. okt', text: 'Afgørelseskilde præciseret (demo)' }],
      },
    },
    {
      id: 'esport-bo3',
      category: 'esport',
      fixtureId: null,
      league: 'Esport · bo3',
      title: 'Nordlys Esports mod Vikingerne',
      layout: 'row',
      margin: 0.06,
      live: false,
      selections: row('esport-bo3', ['Nordlys Esports', 'Vikingerne'], [esportP, 1 - esportP], 0.06),
      infoRows: [],
      rules: {
        source: 'Vinderen af flest kort i en bo3. Mock-model: 56 % pr. kort.',
        cutoff: 'Når serien er afgjort.',
        edge: `Forfald af serie: markedet annulleres. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
    {
      id: 'politik-parti',
      category: 'politik',
      fixtureId: null,
      league: 'Politik · fiktiv demo',
      title: 'Største parti efter næste valg',
      layout: 'ladder',
      margin: 0.1,
      ...politik,
      live: false,
      rules: {
        source: 'Det parti med flest mandater. Fiktive partier, kun demo.',
        cutoff: 'Ved valgets afslutning.',
        edge: `Delt førsteplads: markedet deles efter fast regel. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
    {
      id: 'vejr-regn',
      category: 'vejr',
      fixtureId: null,
      league: 'Vejr · København',
      title: 'Over 5 mm nedbør i morgen?',
      layout: 'row',
      margin: 0.06,
      live: false,
      selections: row('vejr-regn', ['Ja', 'Nej'], [rain, 1 - rain], 0.06),
      infoRows: [],
      rules: {
        source: 'Målt nedbør på en navngiven station, døgnværdi 00–24.',
        cutoff: 'Når døgnværdien er offentliggjort.',
        edge: `Manglende måling: markedet annulleres. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
    {
      id: 'awards-spiller',
      category: 'awards',
      fixtureId: null,
      league: 'Awards · fiktiv demo',
      title: 'Årets Spiller (fiktiv pris)',
      layout: 'ladder',
      margin: 0.1,
      ...awards,
      live: false,
      rules: {
        source: 'Vinderen som annonceres ved prisoverrækkelsen.',
        cutoff: 'Ved annonceringen.',
        edge: `Ingen vinder: markedet annulleres. ${DEMO_RULE_NOTE}`,
        changes: [],
      },
    },
  ];
}

/** Every market on the board at the given per-fixture minutes. */
export function allMarkets(minuteFor: (fixtureId: string) => number): Market[] {
  const football = FIXTURES.flatMap((f) => footballMarkets(f, minuteFor(f.id)));
  return [...football, ...staticMarkets()];
}

export function probsForFixture(fixtureId: string, minute: number) {
  const f = fixtureFor(fixtureId);
  if (!f) throw new Error(`Unknown fixture ${fixtureId}`);
  return probsAt(feedFor(fixtureId), f.lamH, f.lamA, minute);
}
