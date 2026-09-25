// Ny regel (signal 'regel'): varsel ("på vej fra …") eller ikrafttræden ("nu gælder …"), med effekten fra
// regelBeskrivelse og hvad den konkret betyder for spillerens produkter, bonus/VIP og marketing i markedet.
// Flere regler af samme slags i samme uge samles i én dialog med en række pr. marked.
// En afgiftsstigning viser det præcise tal (signal/plan pp), og et nyt politisk indgreb viser, hvad der drev presset (presLog).
import { useState } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { presHistorik, regelBeskrivelseMedPp, vaelgMarked } from '../lib/markedHjaelp';
import { MARKETS } from '../../data/markets';
import { REGLER } from '../../data/regulationTimeline';
import { datoTekst } from '../../sim/selectors';
import { useSmal } from '../hooks/useMedia';
import { Btn, Ikon, Modal } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { PresLog } from '../components/MarkedKortDele';
import { GruppeListe, type GruppeRaekke } from '../components/SignalGruppe';
import { TONE_FARVE, regelIkraft, regelKonsekvenser, ugerKort } from '../lib/tvaersHjaelp';

export default function RegelDialog({ signal: foerste, gruppe, onLuk }: { signal: Signal; gruppe?: Signal[]; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  // Ekstra stor tekst på en smal skærm: knapperne i foden mister ikonet, så teksten kan stå på én linje
  const smal = useSmal();
  const ekstra = useGame((s) => s.settings.tekstStoerrelse === 'ekstra');
  const [valgt, setValgt] = useState(0);
  const flere = !!gruppe && gruppe.length > 1;
  const signal = flere ? (gruppe[valgt] ?? foerste) : foerste;
  if (!g || signal.k !== 'regel') return null;
  const { marked: m, regelId, varsel } = signal;
  const def = MARKETS[m];
  const r = REGLER[regelId];
  const navn = r?.navn ?? regelId;
  const plan = regelIkraft(g, m, regelId);
  const uger = plan ? Math.max(0, plan.uge - g.uge) : 0;
  // Afgiftsstigningens størrelse er trukket ved varslet: samme tal i varslet og ved ikrafttræden
  const pp = regelId === 'afgiftsstigning' ? (signal.pp ?? plan?.pp) : undefined;
  const konsekvenser = regelKonsekvenser(g, m, regelId, pp);
  // Et nyt politisk indgreb: vis hvad der har flyttet presset i markedet
  const presPoster = varsel && plan?.dynamisk ? presHistorik(g, m) : [];
  const skidte = konsekvenser.filter((k) => k.tone === 'skidt').length;
  const gode = konsekvenser.filter((k) => k.tone === 'god').length;
  const tone = skidte > 0 ? 'skidt' : gode > 0 ? 'god' : 'neutral';
  const farve = varsel ? 'var(--color-warn)' : tone === 'god' ? 'var(--color-good)' : 'var(--color-sky)';
  const tilMarked = () => {
    vaelgMarked(m, 'regler');
    useUi.getState().setPanel('marked');
    onLuk();
  };
  const udenIkon = smal && ekstra;
  const raekker: GruppeRaekke[] = flere
    ? gruppe.flatMap((x): GruppeRaekke[] => {
        if (x.k !== 'regel') return [];
        const p = regelIkraft(g, x.marked, x.regelId);
        const xPp = x.regelId === 'afgiftsstigning' ? (x.pp ?? p?.pp) : undefined;
        return [{
          marked: x.marked,
          ikon: x.varsel ? 'paragraf' : 'skjold',
          farve: x.varsel ? 'var(--color-warn)' : 'var(--color-sky)',
          titel: `${REGLER[x.regelId]?.navn ?? x.regelId}${xPp !== undefined ? ` +${xPp} pp` : ''}`,
          under: x.varsel ? (p ? `Fra ${datoTekst(p.uge)} · om ${ugerKort(Math.max(0, p.uge - g.uge))}` : 'Vedtaget') : `Gælder nu i ${MARKETS[x.marked].navn}`,
        }];
      })
    : [];

  return (
    <Modal
      titel={flere ? (varsel ? `${gruppe.length} nye regler på vej` : `${gruppe.length} nye regler i kraft`) : varsel ? 'Ny regel på vej' : 'Ny regel i kraft'}
      onLuk={onLuk}
      testId="dialog-regel"
      bredde={580}
      fod={
        <div className="flex w-full gap-2 sm:w-auto">
          <Btn onClick={tilMarked} testId="regel-til-marked" className="flex-1 whitespace-nowrap sm:flex-none">
            {!udenIkon && <Ikon navn="kort" farve="currentColor" indre="var(--color-panel2)" />} Til Marked
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="regel-ok" className="flex-1 whitespace-nowrap sm:flex-none">
            Forstået
          </Btn>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-varsel={varsel ? '1' : '0'}>
        {flere && (
          <GruppeListe
            raekker={raekker}
            valgt={valgt}
            onVaelg={setValgt}
            overskrift={varsel ? 'Politikerne har travlt' : 'Gælder fra i dag'}
            testId="regel-gruppe"
          />
        )}
        <section className="@container overflow-hidden rounded-lg border-2 border-line bg-bg2">
          <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
          {/* Smal container (fx ekstra stor tekst på mobil): nedtællingen lægger sig under titlen, og ikonet bliver mindre */}
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3 @min-[22rem]:flex-nowrap">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-line pixel-skygge @min-[22rem]:h-12 @min-[22rem]:w-12"
              style={{ background: farve }}
            >
              <Ikon navn={varsel ? 'paragraf' : 'skjold'} farve="var(--color-line)" str={22} />
            </span>
            <div className="min-w-0 flex-1 basis-[10rem]">
              <p className="flex flex-wrap items-center gap-x-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
                {def.navn} · {def.tilsyn}
              </p>
              <h3 className="font-pixel text-base font-black leading-snug break-words text-ink" data-testid="regel-overskrift">
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
              {varsel && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-bold text-ink">
                  {navn}
                  {pp !== undefined && (
                    <span className="tal inline-flex items-center gap-1 rounded border-2 border-line bg-panel px-1.5 font-pixel text-xs font-black text-bad" data-testid="regel-pp">
                      <Ikon navn="op" farve="var(--color-bad)" str={10} /> {pp} pp
                    </span>
                  )}
                </p>
              )}
            </div>
            {varsel && plan && (
              <span
                className="order-last flex w-full shrink-0 items-center gap-1.5 rounded-md border-2 border-line bg-panel px-2 py-1 @min-[22rem]:order-none @min-[22rem]:w-auto @min-[22rem]:flex-col @min-[22rem]:gap-0"
                data-testid="regel-nedtaelling"
              >
                <span className="tal font-pixel text-lg font-black leading-none text-warn">{uger}</span>
                <span className="text-[0.6rem] uppercase text-muted">{uger === 1 ? 'uge' : 'uger'}</span>
              </span>
            )}
          </div>
          <p className="border-t-2 border-line px-3 py-2 text-sm leading-snug text-ink" data-testid="regel-effekt">
            {regelBeskrivelseMedPp(regelId, pp)}
          </p>
        </section>

        {presPoster.length > 0 && (
          <section className="rounded-md border-2 border-line bg-bg2 px-2.5 py-2">
            <PresLog poster={presPoster} overskrift={`Det politiske pres i ${def.navn}`} testId="regel-pres" />
          </section>
        )}

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
