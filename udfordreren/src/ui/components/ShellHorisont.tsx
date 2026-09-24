// "I sigte": kalender (licens, messe, kvartalsmøde, galla) og kvartalets mål — altid noget at se frem til.
// Vises under kontoret på brede skærme.
import { useGame } from '../../store/gameStore';
import { naesteMesse, evaluerMaal } from '../../sim/selectors';
import { ugeIAar, aarFor } from '../../sim/time';
import { EXPO_BY_ID, STAND_NAVN } from '../../data/expos';
import { GALA_UGE_I_AAR } from '../../data/galaCategories';
import { Ikon, type IkonNavn } from './kit';
import { licensUgerTilbage } from '../lib/shellHjaelp';
import { maalVisning } from '../lib/firmaHjaelp';
import type { GameState } from '../../sim/types';

type Punkt = { id: string; ikon: IkonNavn; farve: string; tekst: string; uger: number; note?: string };

function punkter(s: GameState): Punkt[] {
  const ud: Punkt[] = [];
  const lic = licensUgerTilbage(s);
  if (lic > 0) ud.push({ id: 'licens', ikon: 'skjold', farve: 'var(--color-good)', tekst: 'Dansk licens', uger: lic });
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
  return ud.sort((a, b) => a.uger - b.uger);
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
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <Ikon navn={p.ikon} farve={p.farve} indre="var(--color-line)" />
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
        </div>
      </div>
    </section>
  );
}
