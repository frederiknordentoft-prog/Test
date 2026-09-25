// Verdensnyheder (signal 'verdensNyhed'): højesteret i USA, den store skandale, Norge åbner, AI-krav, EU-harmonisering.
// Titel og tekst fra sim-kernen + en kort forklaring på, hvad det betyder for jer, og en genvej til det rette panel.
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi, type PanelId } from '../../store/uiStore';
import { Btn, Ikon, Modal, type IkonNavn } from '../components/kit';
import { AiStil } from '../components/AiDele';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { datoTekst } from '../../sim/time';
import { AI_EFFEKT, BOERSLICENS } from '../../data/ai';

type Kontekst = { tekst: string; panel: PanelId; knap: string; ikon: IkonNavn };

function kontekst(id: string): Kontekst | null {
  switch (id) {
    case 'hoejesteret':
      return {
        tekst: `Prediction markets tager fart i USA. I kan søge børslicens i AI-laboratoriet (${BOERSLICENS.gebyr} mio. kr., ${BOERSLICENS.uger} uger) og sælge event-kontrakter i hele landet.`,
        panel: 'ailab',
        knap: 'Til AI-lab',
        ikon: 'chip',
      };
    case 'skandale':
      return {
        tekst: 'Reklameforbud, AI-risikokrav og økonomiske tjek er på vej i Norden. En risikoagent med overvågning på mindst 0,6 opfylder AI-kravet.',
        panel: 'ailab',
        knap: 'Til AI-lab',
        ikon: 'chip',
      };
    case 'aiKrav':
      return {
        tekst: `En risikoagent med overvågning på mindst 0,6 opfylder kravet. Uden den koster det ${AI_EFFEKT.ansvarligAiTillid} i tilsynstillid pr. kvartal i de markeder.`,
        panel: 'ailab',
        knap: 'Til AI-lab',
        ikon: 'chip',
      };
    case 'norgeAabner':
      return { tekst: 'Et nyt marked med mange spillere, der i dag spiller gråt. Søg licens under Marked, når det åbner.', panel: 'marked', knap: 'Til Marked', ikon: 'kort' };
    case 'euHarmonisering':
      return { tekst: 'Fælles regler i hele EU om et år. Se under Marked, hvad der ændrer sig for jer.', panel: 'marked', knap: 'Til Marked', ikon: 'kort' };
    default:
      return null;
  }
}

export default function VerdensNyhedDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const uge = useGame((s) => s.game?.uge ?? 0);
  const red = useReduceretBevaegelse();
  if (signal.k !== 'verdensNyhed') return null;
  const k = kontekst(signal.id);
  const gaaTil = (p: PanelId) => {
    useUi.getState().setPanel(p);
    onLuk();
  };
  return (
    <Modal
      titel="Verdensnyhed"
      onLuk={onLuk}
      testId="dialog-verdensNyhed"
      bredde={580}
      fod={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {k && (
            <Btn variant="sekundaer" onClick={() => gaaTil(k.panel)} testId="verdensNyhed-gaa-til" className="flex-1 sm:flex-none">
              <Ikon navn={k.ikon} farve="var(--color-cyan)" indre="var(--color-line)" /> {k.knap}
            </Btn>
          )}
          <Btn variant="primaer" onClick={onLuk} testId="verdensNyhed-ok" className="flex-1 sm:flex-none">
            OK
          </Btn>
        </div>
      }
    >
      <AiStil />
      <div className="flex flex-col gap-3">
        <section className={`ai-nat ai-linjer relative overflow-hidden rounded-lg border-2 border-line px-4 py-4 ${red ? '' : 'ai-scan'}`}>
          <div className="relative flex flex-col items-center gap-2 text-center">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-line bg-[#0c1f3a] ${red ? 'ai-gloed-stille' : 'ai-gloed'}`}>
              <Ikon navn="globus" farve="var(--color-violet)" indre="var(--color-cyan)" str={32} />
            </span>
            <span className="tal font-pixel text-[0.7rem] font-black uppercase tracking-[0.25em] text-cyan">{datoTekst(uge)}</span>
            <h3 className="font-pixel text-xl font-black uppercase tracking-wide text-ink ai-tekst-gloed" data-testid="verdensNyhed-titel">
              {signal.titel}
            </h3>
            <p className="max-w-md text-sm text-ink">{signal.tekst}</p>
          </div>
        </section>
        {k && (
          <p className="flex items-start gap-1.5 rounded-md border-2 border-line bg-bg2 px-3 py-2 text-sm text-muted" data-testid="verdensNyhed-kontekst">
            <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
            <span>
              <b className="text-ink">Hvad betyder det for jer?</b> {k.tekst}
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
