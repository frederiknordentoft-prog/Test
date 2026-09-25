// Ny regel (signal 'regel'): varsel ("på vej fra …") eller ikrafttræden ("nu gælder …"), med effekten fra
// regelBeskrivelse og hvad den konkret betyder for spillerens produkter, bonus/VIP og marketing i markedet.
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { vaelgMarked } from '../lib/markedHjaelp';
import { MARKETS } from '../../data/markets';
import { REGLER } from '../../data/regulationTimeline';
import { datoTekst, regelBeskrivelse } from '../../sim/selectors';
import { Btn, Ikon, Modal } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { TONE_FARVE, regelIkraft, regelKonsekvenser, ugerKort } from '../lib/tvaersHjaelp';

export default function RegelDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  if (!g || signal.k !== 'regel') return null;
  const { marked: m, regelId, varsel } = signal;
  const def = MARKETS[m];
  const r = REGLER[regelId];
  const navn = r?.navn ?? regelId;
  const plan = regelIkraft(g, m, regelId);
  const uger = plan ? Math.max(0, plan.uge - g.uge) : 0;
  const konsekvenser = regelKonsekvenser(g, m, regelId);
  const skidte = konsekvenser.filter((k) => k.tone === 'skidt').length;
  const gode = konsekvenser.filter((k) => k.tone === 'god').length;
  const tone = skidte > 0 ? 'skidt' : gode > 0 ? 'god' : 'neutral';
  const farve = varsel ? 'var(--color-warn)' : tone === 'god' ? 'var(--color-good)' : 'var(--color-sky)';
  const tilMarked = () => {
    vaelgMarked(m);
    useUi.getState().setPanel('marked');
    onLuk();
  };

  return (
    <Modal
      titel={varsel ? 'Ny regel på vej' : 'Ny regel i kraft'}
      onLuk={onLuk}
      testId="dialog-regel"
      bredde={580}
      fod={
        <div className="flex w-full gap-2 sm:w-auto">
          <Btn onClick={tilMarked} testId="regel-til-marked" className="flex-1 sm:flex-none">
            <Ikon navn="kort" farve="currentColor" indre="var(--color-panel2)" /> Til Marked
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="regel-ok" className="flex-1 sm:flex-none">
            Forstået
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-varsel={varsel ? '1' : '0'}>
        <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2">
          <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
          <div className="flex items-start gap-3 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-line pixel-skygge" style={{ background: farve }}>
              <Ikon navn={varsel ? 'paragraf' : 'skjold'} farve="var(--color-line)" str={28} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
                {def.navn} · {def.tilsyn}
              </p>
              <h3 className="font-pixel text-base font-black leading-snug text-ink" data-testid="regel-overskrift">
                {varsel ? (
                  <>
                    Ny regel på vej i {def.navn}
                    {plan && <span className="text-warn"> fra {datoTekst(plan.uge)}</span>}
                  </>
                ) : (
                  <>
                    Nu gælder <span style={{ color: farve }}>{navn.toLowerCase()}</span> i {def.navn}
                  </>
                )}
              </h3>
              {varsel && <p className="mt-0.5 font-bold text-ink">{navn}</p>}
            </div>
            {varsel && plan && (
              <span className="flex shrink-0 flex-col items-center rounded-md border-2 border-line bg-panel px-2 py-1" data-testid="regel-nedtaelling">
                <span className="tal font-pixel text-lg font-black leading-none text-warn">{uger}</span>
                <span className="text-[0.6rem] uppercase text-muted">{uger === 1 ? 'uge' : 'uger'}</span>
              </span>
            )}
          </div>
          <p className="border-t-2 border-line px-3 py-2 text-sm leading-snug text-ink" data-testid="regel-effekt">
            {regelBeskrivelse(regelId)}
          </p>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="spoergsmaal" farve="var(--color-gold)" str={12} /> Hvad betyder det for jer?
          </h4>
          <ul className="flex flex-col gap-1.5" data-testid="regel-konsekvenser">
            {konsekvenser.map((k) => (
              <li key={k.tekst} className="flex items-start gap-2 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 text-sm">
                <Ikon navn={k.ikon} farve={TONE_FARVE[k.tone]} indre="var(--color-line)" className="mt-0.5 shrink-0" />
                <span className={k.tone === 'neutral' ? 'text-muted' : 'text-ink'}>{k.tekst}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-dim">
          {varsel
            ? `${plan?.dynamisk ? `Politikerne reagerede på presset i ${def.navn}.` : 'Reglen er vedtaget.'} ${
                plan ? `I har ${ugerKort(uger)} til at justere marketing, bonus og produkter.` : 'I har tid til at justere marketing, bonus og produkter.'
              }`
            : 'Reglen gælder fra i dag. Effekten ses i markedskortet under Marked.'}
        </p>
      </div>
    </Modal>
  );
}
