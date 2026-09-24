// Hændelser (signal 'event'): titel, tekst og valg som store knapper med forklaring og effekt-chips.
// Kan ikke lukkes uden et valg.
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Ikon, Modal } from '../components/kit';
import { Chip, FirmaAvatar } from '../components/FirmaDele';
import { EVENT_BY_ID } from '../../data/events';
import { eventTekst } from '../../sim/events';
import { effektChips } from '../lib/firmaHjaelp';
import { mio } from '../format';

const TONE_FARVE = { god: 'var(--color-good)', skidt: 'var(--color-bad)', neutral: 'var(--color-muted)' } as const;

export default function EventDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const eventId = signal.k === 'event' ? signal.eventId : '';
  const def = EVENT_BY_ID[eventId];
  const pending = useGame((s) => s.game?.ventendeEvents.find((e) => e.eventId === eventId));
  const kapital = useGame((s) => s.game?.kapital ?? 0);
  const staff = useGame((s) => {
    const id = pending?.ctx.staffId;
    return typeof id === 'string' ? s.game?.staff.find((m) => m.id === id) : undefined;
  });

  // Eventet er allerede afgjort (fx efter indlæsning): luk stille
  useEffect(() => {
    if (!def || !pending) onLuk();
  }, [def, pending, onLuk]);

  if (!def || !pending) return null;
  const ctx = pending.ctx;

  const vaelg = (i: number) => {
    if (useGame.getState().dispatch({ t: 'eventChoice', eventId, valg: i })) onLuk();
  };

  // Valg, der sender kassen i minus: deaktiveres, hvis der findes et andet valg, der ikke gør. Ellers må man godt
  // vælge det (dialogen kan ikke lukkes uden et valg), men det står tydeligt, at konkurs-nedtællingen starter.
  const iMinus = def.valg.map((v) => kapital >= 0 && kapital + (v.effekt.kapital ?? 0) < 0);
  const harUdvej = iMinus.some((x) => !x);

  return (
    <Modal titel={def.titel} lukbar={false} bredde={560} testId="dialog-event">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 rounded-md border-2 border-line bg-bg2 p-2.5">
          {staff ? (
            <FirmaAvatar m={staff} str={48} />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-line bg-warn">
              <Ikon navn="lyn" farve="var(--color-line)" str={26} />
            </span>
          )}
          <p className="min-w-0 flex-1 text-[0.95rem] leading-snug text-ink" data-testid="event-tekst">
            {eventTekst(def.tekst, ctx)}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {def.valg.map((v, i) => {
            const chips = effektChips(v.effekt, ctx);
            const pris = -(v.effekt.kapital ?? 0);
            const spaerret = iMinus[i] && harUdvej;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => vaelg(i)}
                  disabled={spaerret}
                  data-testid={`valg-${i}`}
                  className="flex min-h-14 w-full flex-col gap-1.5 rounded-md border-2 border-line bg-panel2 p-2.5 text-left pixel-skygge transition-[transform,filter] duration-75 hover:bg-hi active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-panel2 disabled:active:translate-y-0"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line bg-gold font-pixel text-xs font-black text-line">{i + 1}</span>
                    <span className="font-pixel text-sm font-black text-ink">{v.tekst}</span>
                  </span>
                  <span className="text-sm text-muted">{eventTekst(v.forklaring, ctx)}</span>
                  <span className="flex flex-wrap gap-1">
                    {chips.map((c) => (
                      <Chip key={c.tekst} ikon={c.ikon} farve={TONE_FARVE[c.tone]}>
                        {c.tekst}
                      </Chip>
                    ))}
                    {iMinus[i] && !spaerret && (
                      <Chip ikon="advarsel" farve="var(--color-bad)">
                        Kassen går i minus
                      </Chip>
                    )}
                  </span>
                  {spaerret && (
                    <span className="flex items-center gap-1 text-xs font-bold text-bad" data-testid={`valg-${i}-grund`}>
                      <Ikon navn="laas" farve="var(--color-bad)" str={12} /> Kræver {mio(pris)} — kassen har {mio(kapital)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
