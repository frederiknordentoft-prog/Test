// Akt-skiftet (signal 'aktSkift'): "Verdensbilledet 2026". Alle verdensscenarier med sandsynlighed, tekst og effekt —
// de trukne markeret med ikon + farve — samt verdensvurderingerne. AI-laboratoriet åbner, og kontoret skifter stemning.
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Modal } from '../components/kit';
import { AiStil, GloedTerminal } from '../components/AiDele';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { spil } from '../../audio/sfx';
import { procentTekst, verdensbillede } from '../lib/aiHjaelp';

export default function AktSkiftDialog({ signal, onLuk, genvisning }: { signal: Signal; onLuk: () => void; genvisning?: boolean }) {
  const g = useGame((s) => s.game);
  const red = useReduceretBevaegelse();
  useEffect(() => {
    if (genvisning) return;
    try {
      spil('fanfareSlut');
    } catch {
      /* lyd må aldrig vælte spillet */
    }
  }, [genvisning]);
  if (!g) return null;
  const sc = signal.k === 'aktSkift' ? signal.scenarier : undefined;
  const vu = signal.k === 'aktSkift' ? signal.vurderinger : undefined;
  const vb = verdensbillede(g, sc, vu);
  const trukne = vb.scenarier.filter((v) => v.trukket);

  const tilLab = () => {
    useUi.getState().setPanel('ailab');
    onLuk();
  };

  return (
    <Modal
      titel="Verdensbilledet 2026"
      onLuk={onLuk}
      testId="dialog-aktSkift"
      bredde={780}
      fod={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Btn variant="ghost" onClick={onLuk} testId="aktSkift-luk" className="flex-1 sm:flex-none">
            {genvisning ? 'Luk' : 'Senere'}
          </Btn>
          {!genvisning && (
            <Btn variant="primaer" onClick={tilLab} testId="aktSkift-til-ailab" className="flex-[2] sm:flex-none">
              <Ikon navn="chip" farve="currentColor" indre="var(--color-gold)" /> Til AI-laboratoriet
            </Btn>
          )}
        </div>
      }
    >
      <AiStil />
      <div className="flex flex-col gap-3">
        <section className={`ai-nat ai-linjer relative overflow-hidden rounded-lg border-2 border-line px-4 py-4 ${red ? '' : 'ai-scan'}`} data-testid="aktSkift-intro">
          <div className="relative flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:text-left">
            <GloedTerminal str={60} className={red ? '' : 'ai-gloed'} />
            <div className="min-w-0 flex-1">
              <p className={`font-pixel text-[0.7rem] font-black uppercase tracking-[0.3em] text-cyan ${red ? '' : 'ai-ind'}`}>Akt to · januar 2026</p>
              <p className={`font-pixel text-2xl font-black uppercase tracking-wider text-ink ai-tekst-gloed sm:text-3xl ${red ? '' : 'ai-ind'}`}>Et nyt kapitel</p>
              <p className="mt-1.5 text-sm text-muted">
                Lysstofrørene er skiftet ud med blåt neonlys. Serverne summer, og kaffemaskinen har fået en app. <b className="text-cyan">AI-laboratoriet åbner</b>: agenter kan sætte
                odds, lave indhold, svare kunderne og holde øje med dem, der spiller for meget. Ugerne går lidt langsommere nu. Der er mere at tænke over.
              </p>
            </div>
          </div>
        </section>

        <p className="flex items-center gap-1.5 text-sm text-ink">
          <Ikon navn="globus" farve="var(--color-violet)" indre="var(--color-line)" className="shrink-0" />
          {trukne.length === 0 ? (
            <span>Verden holder vejret: ingen af de store omvæltninger rammer jer. Resten er op til jer.</span>
          ) : (
            <span>
              Verden har valgt retning. <b className="text-cyan">{trukne.length === 1 ? 'Ét scenarie' : `${trukne.length} scenarier`}</b> former de næste ti år:
            </span>
          )}
        </p>

        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="aktSkift-scenarier">
          {vb.scenarier.map((v, i) => (
            <li
              key={v.id}
              className={`relative flex flex-col gap-1 rounded-md border-2 p-2.5 ${v.trukket ? `border-cyan bg-[#0c1f3a] ${red ? 'ai-gloed-stille' : 'ai-gloed ai-ind'}` : 'border-line bg-bg2 opacity-70'}`}
              style={!red && v.trukket ? { animationDelay: `${120 + i * 90}ms` } : undefined}
              data-testid={`aktSkift-scenarie-${v.id}`}
              data-trukket={v.trukket ? '1' : '0'}
            >
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 font-pixel text-sm font-black uppercase tracking-wide text-ink">{v.navn}</span>
                <span className="tal shrink-0 rounded border-2 border-line bg-[#070b1a] px-1.5 font-pixel text-[0.7rem] font-bold text-muted" title="Sandsynlighed ved spillets start">
                  {procentTekst(v.sandsynlighed)}
                </span>
              </div>
              <span
                className={`inline-flex w-fit items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 font-pixel text-[0.62rem] font-black uppercase ${v.trukket ? 'bg-cyan text-line' : 'bg-panel2 text-dim'}`}
                data-testid={`aktSkift-status-${v.id}`}
              >
                <Ikon navn={v.trukket ? 'flueben' : 'kryds'} farve={v.trukket ? 'var(--color-line)' : 'var(--color-dim)'} str={10} />
                {v.trukket ? 'Sker i jeres spil' : 'Ikke i kortene'}
              </span>
              <p className="text-[0.78rem] text-ink">{v.tekst}</p>
              <p className="text-[0.74rem] text-muted">
                <b className={v.trukket ? 'text-cyan' : 'text-dim'}>Effekt:</b> {v.effekt}
              </p>
            </li>
          ))}
        </ul>

        <section className="rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="aktSkift-vurderinger">
          <p className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="kalender" farve="var(--color-sky)" indre="var(--color-line)" str={14} /> Og i øvrigt
          </p>
          <ul className="flex flex-col gap-1.5">
            {vb.vurderinger.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm" data-testid={`aktSkift-vurdering-${v.id}`} data-trukket={v.trukket ? '1' : '0'}>
                <Ikon navn={v.trukket ? 'flueben' : 'kryds'} farve={v.trukket ? 'var(--color-cyan)' : 'var(--color-dim)'} str={12} className="shrink-0" />
                <span className={`font-bold ${v.trukket ? 'text-ink' : 'text-dim'}`}>{v.navn}</span>
                <span className="tal text-[0.7rem] text-dim">({procentTekst(v.sandsynlighed)})</span>
                <span className={`min-w-0 flex-1 basis-full text-[0.74rem] sm:basis-auto ${v.trukket ? 'text-muted' : 'text-dim'}`}>
                  {v.tekst} {v.trukket ? <b className="text-cyan">{v.aar ? `Forventes omkring ${v.aar}.` : 'I kortene.'}</b> : <span>Ikke i kortene.</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
