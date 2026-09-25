// Samlede signal-dialoger (flere markeder i samme uge): en række pr. marked. Rækkerne er knapper, der vælger,
// hvilket marked dialogens detaljer viser. Ikon + farve på hver række; aktiv række markeres med guldkant og aria-pressed.
import type { ReactNode } from 'react';
import type { MarketId } from '../../sim/types';
import { MARKETS } from '../../data/markets';
import { Ikon, type IkonNavn } from './kit';
import { FlagStribe } from './FirmaDele';

export type GruppeRaekke = { marked?: MarketId; titel: ReactNode; under?: ReactNode; ikon: IkonNavn; farve: string };

export function GruppeListe({
  raekker, valgt, onVaelg, overskrift, testId,
}: { raekker: GruppeRaekke[]; valgt: number; onVaelg: (i: number) => void; overskrift: ReactNode; testId: string }) {
  return (
    <section className="flex flex-col gap-1.5" data-testid={testId}>
      <h4 className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
        <Ikon navn="globus" farve="var(--color-sky)" indre="var(--color-line)" str={12} /> {overskrift}
      </h4>
      <ul className="flex flex-col gap-1">
        {raekker.map((r, i) => {
          const aktiv = i === valgt;
          const def = r.marked ? MARKETS[r.marked] : null;
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={aktiv}
                onClick={() => onVaelg(i)}
                data-testid={`${testId}-${r.marked ?? i}`}
                className={`flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-md border-2 px-2 py-1 text-left ${
                  aktiv ? 'border-gold bg-panel2' : 'border-line bg-bg2 hover:bg-panel2'
                }`}
              >
                {def ? (
                  <span className="flex w-9 shrink-0 flex-col items-center gap-0.5">
                    <FlagStribe farver={def.farver} className="h-2.5 w-7" />
                    <span className="font-pixel text-[0.65rem] font-black text-ink">{def.kort}</span>
                  </span>
                ) : null}
                <Ikon navn={r.ikon} farve={r.farve} indre="var(--color-line)" str={14} className="shrink-0" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-sm font-bold text-ink">{r.titel}</span>
                  {r.under && <span className="block text-xs text-muted">{r.under}</span>}
                </span>
                {aktiv ? (
                  <span className="shrink-0 font-pixel text-[0.6rem] font-black uppercase text-gold">Vises</span>
                ) : (
                  <Ikon navn="pil" farve="var(--color-muted)" str={11} className="shrink-0" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
