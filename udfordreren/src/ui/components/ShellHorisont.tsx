// "I sigte": kalender (licenser, messe, kvartalsmøde, galla, markedsåbninger, nye regler, næste slutrunde),
// kvartalets mål og de aktive trends — altid noget at se frem til. Vises under kontoret på brede skærme.
import { useGame } from '../../store/gameStore';
import { naesteMesse, evaluerMaal } from '../../sim/selectors';
import { ugeIAar, aarFor } from '../../sim/time';
import { EXPO_BY_ID, STAND_NAVN } from '../../data/expos';
import { GALA_UGE_I_AAR } from '../../data/galaCategories';
import { Ikon, type IkonNavn } from './kit';
import { maalVisning } from '../lib/firmaHjaelp';
import type { GameState, Vertical } from '../../sim/types';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { VERTICALS } from '../../data/verticals';
import { REGLER } from '../../data/regulationTimeline';
import TrendBadges from './TrendBadges';
import { naesteSport } from '../lib/tvaersHjaelp';
import { kommendeAfgifter } from '../lib/markedHjaelp';

const VERTIKALER: Vertical[] = ['betting', 'kasino'];
const MAKS_PUNKTER = 8;

type Punkt = { id: string; ikon: IkonNavn; farve: string; tekst: string; uger: number; note?: string };

function punkter(s: GameState): Punkt[] {
  const ud: Punkt[] = [];
  // Licenser på vej — i alle markeder og vertikaler
  for (const m of MARKET_IDS) {
    for (const v of VERTIKALER) {
      const vl = s.markeder[m].vertikaler[v];
      if (vl.status !== 'ansoegt') continue;
      const uger = Math.max(0, (vl.klarUge ?? s.uge) - s.uge);
      const dansk = m === 'dk' && v === s.startVertikal;
      ud.push({ id: dansk ? 'licens' : `licens-${m}-${v}`, ikon: 'skjold', farve: 'var(--color-good)', tekst: dansk ? 'Dansk licens' : `${VERTICALS[v].kort}-licens ${MARKETS[m].kort}`, uger });
    }
  }
  // Markeder, der åbner inden for et år
  for (const m of MARKET_IDS) {
    const a = MARKETS[m].aabnerUge;
    if (a === null || s.markeder[m].aaben || a - s.uge > 52) continue;
    ud.push({ id: `aabner-${m}`, ikon: 'globus', farve: 'var(--color-sky)', tekst: `${MARKETS[m].navn} åbner`, uger: a - s.uge, note: 'nyt marked' });
  }
  // Nye regler på vej i markeder, hvor I er aktive
  for (const p of s.planlagteRegler) {
    const lic = s.markeder[p.marked].licens;
    if (lic === 'ingen' || lic === 'inddraget' || p.ikrafttraedelseUge <= s.uge) continue;
    ud.push({
      // To dynamiske afgiftsstigninger kan være planlagt i samme marked: ugen gør nøglen entydig
      id: `regel-${p.marked}-${p.regelId}-${p.ikrafttraedelseUge}`,
      ikon: 'paragraf',
      farve: 'var(--color-warn)',
      tekst: `${REGLER[p.regelId]?.navn ?? p.regelId} (${MARKETS[p.marked].kort})`,
      uger: p.ikrafttraedelseUge - s.uge,
      note: p.regelId === 'afgiftsstigning' && p.pp !== undefined ? `+${p.pp} pp` : undefined,
    });
  }
  // Vedtagne afgiftsskift inden for et år i markeder, hvor I er aktive
  for (const m of MARKET_IDS) {
    const lic = s.markeder[m].licens;
    if (lic === 'ingen' || lic === 'inddraget') continue;
    for (const a of kommendeAfgifter(s, m, 52)) {
      ud.push({ id: `${a.id}-${m}`, ikon: 'penge', farve: 'var(--color-warn)', tekst: `${a.navn} (${MARKETS[m].kort})`, uger: a.ugerTil, note: a.tal });
    }
  }
  // Sportskalenderens næste slutrunde
  const sport = naesteSport(s.uge);
  if (sport && !sport.igang) {
    ud.push({ id: 'sport', ikon: 'bold', farve: 'var(--color-good)', tekst: sport.titel, uger: sport.uger, note: sport.chips[0]?.tekst });
  }
  const u = ugeIAar(s.uge);
  const kvartal = 13 - (u % 13);
  ud.push({ id: 'kvartal', ikon: 'firma', farve: 'var(--color-sky)', tekst: 'Kvartalsmøde', uger: kvartal });
  const m = naesteMesse(s);
  if (m) {
    const e = EXPO_BY_ID[m.expoId];
    ud.push({
      id: 'messe',
      ikon: 'stjerne',
      farve: 'var(--color-pink)',
      tekst: e?.navn ?? 'Messe',
      uger: m.uge - s.uge,
      note: m.booket ? STAND_NAVN[m.booket] : m.aaben ? 'Book stand nu' : undefined,
    });
  }
  const galla = u <= GALA_UGE_I_AAR ? GALA_UGE_I_AAR - u : 52 - u + GALA_UGE_I_AAR;
  ud.push({ id: 'galla', ikon: 'trofae', farve: 'var(--color-gold)', tekst: `Branchegallaen ${u <= GALA_UGE_I_AAR ? aarFor(s.uge) : aarFor(s.uge) + 1}`, uger: galla });
  return ud.sort((a, b) => a.uger - b.uger).slice(0, MAKS_PUNKTER);
}

export default function Horisont() {
  const g = useGame((s) => s.game);
  if (!g) return null;
  const liste = punkter(g);
  const maal = g.kvartalsmaal;
  return (
    <section className="rounded-lg border-2 border-line bg-panel pixel-skygge" data-testid="horisont" aria-label="I sigte">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel2 px-3 py-1.5 rounded-t-md">
        <h2 className="flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider">
          <Ikon navn="ur" farve="var(--color-gold)" indre="var(--color-line)" /> I sigte
        </h2>
        <span className="font-pixel text-[0.65rem] uppercase text-dim">Kvartal {Math.floor(ugeIAar(g.uge) / 13) + 1}</span>
      </header>
      <div className="grid gap-3 p-3 xl:grid-cols-2">
        <ul className="space-y-1.5">
          {liste.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm" data-testid={`horisont-${p.id}`}>
              <Ikon navn={p.ikon} farve={p.farve} indre={p.ikon === 'bold' ? 'var(--color-ink)' : 'var(--color-line)'} />
              <span className="min-w-0 flex-1 truncate">
                {p.tekst}
                {p.note && <span className="ml-1.5 text-xs text-gold">· {p.note}</span>}
              </span>
              <span className="tal shrink-0 font-pixel text-xs font-bold text-muted">{p.uger <= 0 ? 'nu' : p.uger === 1 ? '1 uge' : `${p.uger} uger`}</span>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1.5 font-pixel text-[0.65rem] font-bold uppercase tracking-wider text-muted">Kvartalets mål</p>
          {maal.length === 0 ? (
            <p className="text-sm text-dim">Ingen mål lige nu.</p>
          ) : (
            <ul className="space-y-1.5" data-testid="horisont-maal">
              {maal.map((m) => {
                const v = maalVisning(g, m, evaluerMaal(g, m));
                const ok = v.status === 'ok';
                return (
                  <li key={m.id} className="flex items-start gap-2 text-sm" data-testid={`horisont-maal-${m.kind}`}>
                    <span className="mt-0.5 shrink-0">
                      <Ikon
                        navn={ok ? 'flueben' : v.status === 'undervejs' ? 'ur' : 'diamant'}
                        farve={ok ? 'var(--color-good)' : 'var(--color-dim)'}
                        str={14}
                        titel={ok ? 'Opfyldt' : v.status === 'undervejs' ? 'Afgøres ved kvartalsmødet' : 'Ikke opfyldt endnu'}
                      />
                    </span>
                    <span className={ok ? 'text-ink' : 'text-muted'}>
                      {m.tekst}
                      {v.note && (
                        <span className="block text-xs" style={{ color: v.noteGod ? 'var(--color-good)' : 'var(--color-bad)' }}>
                          {v.note}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Trends under målene: højre kolonne har plads, og så skubber de ikke "I sigte" ud over skærmen */}
          <p className="mb-1.5 mt-3 flex items-center gap-1.5 font-pixel text-[0.65rem] font-bold uppercase tracking-wider text-muted">
            <Ikon navn="trend" farve="var(--color-violet)" str={12} /> Trends nu
          </p>
          <TrendBadges />
        </div>
      </div>
    </section>
  );
}
