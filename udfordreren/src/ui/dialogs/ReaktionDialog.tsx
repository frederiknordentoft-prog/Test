// Konkurrentreaktion (signal 'reaktion'): kun R1 (bonuskrig) og R8 (påbud) får en dialog — resten er toasts.
// Viser teksten, reglen bag (hvis → så), hvem der reagerer (monogram eller tilsynet) og konsekvensen.
// Flere markeder i samme uge (fx påbud i DK, UK og SE) samles i én dialog med en række pr. marked.
import { useEffect, useState } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { vaelgMarked } from '../lib/markedHjaelp';
import { Btn, Ikon, Modal, Monogram, type IkonNavn } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { MARKETS } from '../../data/markets';
import { REAKTIONS_REGLER, R1, R8 } from '../../data/reactionRules';
import { datoTekst, ejerInfo, spillerCacTillaeg } from '../../sim/selectors';
import { spil } from '../../audio/sfx';
import { aggressionsIndeks, aktiveReaktioner, udloebTekst } from '../lib/konkurrentHjaelp';
import { GruppeListe, type GruppeRaekke } from '../components/SignalGruppe';

type Linje = { ikon: IkonNavn; farve: string; tekst: string };

export default function ReaktionDialog({ signal: foerste, gruppe, onLuk }: { signal: Signal; gruppe?: Signal[]; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const [valgt, setValgt] = useState(0);
  const flere = !!gruppe && gruppe.length > 1;
  const signal = flere ? (gruppe[valgt] ?? foerste) : foerste;
  useEffect(() => {
    try {
      spil('fejl');
    } catch {
      /* lyd må aldrig vælte spillet */
    }
  }, []);
  if (!g || signal.k !== 'reaktion') return null;

  const regel = REAKTIONS_REGLER[signal.regel];
  const m = signal.marked;
  const marked = m ? MARKETS[m] : null;
  const bonuskrig = signal.regel === 'R1';
  const konk = signal.competitorId ? ejerInfo(g, signal.competitorId) : null;
  const aktiv = aktiveReaktioner(g).find((r) => r.regel === signal.regel && r.marked === m && r.competitorId === signal.competitorId);

  const linjer: Linje[] = [];
  if (bonuskrig && m) {
    linjer.push({
      ikon: 'ned',
      farve: 'var(--color-bad)',
      tekst: `Nye kunder koster ${Math.round(R1.cac * 100)} % mere i ${marked!.navn}${aktiv ? ` ${udloebTekst(g, aktiv.slutUge)}` : ' i et år'}. Samlet CAC-tillæg dér nu: +${Math.round(spillerCacTillaeg(g, m) * 100)} %.`,
    });
    linjer.push({
      ikon: 'hype',
      farve: 'var(--color-warn)',
      tekst: `${konk?.navn ?? 'Giganten'} kører marketing ×${String(R1.marketing).replace('.', ',')} i ${marked!.navn} og tager en større bid af de nye spillere.`,
    });
    linjer.push({ ikon: 'globus', farve: 'var(--color-good)', tekst: 'Jeres andre markeder er ikke ramt.' });
  } else if (m) {
    const ms = g.markeder[m];
    const antal = g.r8Antal[m] ?? 1;
    linjer.push({ ikon: 'skjold', farve: 'var(--color-bad)', tekst: `Tilsynstilliden i ${marked!.navn} falder 6 point (nu ${Math.round(ms.tilsynstillid)}).` });
    if (ms.sanktion.trin >= 1) linjer.push({ ikon: 'nyhed', farve: 'var(--color-warn)', tekst: `I står på sanktionstrappens trin ${ms.sanktion.trin} i ${marked!.navn}.` });
    linjer.push(
      antal % R8.reglerEfter === 0
        ? { ikon: 'paragraf', farve: 'var(--color-bad)', tekst: `Det er påbud nr. ${antal}: en ny regel rammer hele branchen i ${marked!.navn}, og omdømmet falder 3.` }
        : {
            ikon: 'paragraf',
            farve: 'var(--color-warn)',
            tekst: `Påbud nr. ${antal} i ${marked!.navn}. Ved hvert ${R8.reglerEfter}. påbud strammes reglerne for alle — ${R8.reglerEfter - (antal % R8.reglerEfter)} påbud til.`,
          },
    );
  }
  const indeks = !bonuskrig && m ? aggressionsIndeks(g, m) : null;

  const tilMarked = () => {
    if (m) vaelgMarked(m, 'bonus');
    useUi.getState().setPanel('marked');
    onLuk();
  };
  const raekker: GruppeRaekke[] = flere
    ? gruppe.flatMap((x): GruppeRaekke[] => {
        if (x.k !== 'reaktion' || !x.marked) return [];
        const xm = x.marked;
        if (x.regel === 'R1') {
          const k = x.competitorId ? ejerInfo(g, x.competitorId) : null;
          return [{ marked: xm, ikon: 'svaerd', farve: 'var(--color-bad)', titel: `${k?.navn ?? 'En gigant'} starter bonuskrig`, under: `Nye kunder +${Math.round(R1.cac * 100)} % dyrere i ${MARKETS[xm].navn}` }];
        }
        const idx = aggressionsIndeks(g, xm);
        return [{
          marked: xm,
          ikon: 'skjold',
          farve: 'var(--color-bad)',
          titel: `${MARKETS[xm].tilsyn}: påbud nr. ${g.r8Antal[xm] ?? 1}`,
          under: `Tillid ${Math.round(g.markeder[xm].tilsynstillid)} (−6) · indeks ${idx.total}/${idx.taerskel}`,
        }];
      })
    : [];
  const tilRivaler = () => {
    useUi.getState().setPanel('konkurrenter');
    onLuk();
  };

  return (
    <Modal
      titel={flere ? (bonuskrig ? `Bonuskrig i ${gruppe.length} markeder!` : `Påbud i ${gruppe.length} markeder`) : bonuskrig ? 'Bonuskrig!' : 'Påbud'}
      onLuk={onLuk}
      testId="dialog-reaktion"
      bredde={620}
      fod={
        <>
          <Btn onClick={bonuskrig ? tilRivaler : tilMarked} testId="reaktion-gaa" className="mr-auto">
            {bonuskrig ? 'Se rivalerne' : 'Til bonus og VIP'} <Ikon navn="pil" farve="currentColor" str={12} />
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="reaktion-ok">
            Forstået
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-regel={signal.regel}>
        {flere && (
          <GruppeListe
            raekker={raekker}
            valgt={valgt}
            onVaelg={setValgt}
            overskrift={bonuskrig ? 'Samme uge, flere markeder' : `${gruppe.length} tilsyn på én gang`}
            testId="reaktion-gruppe"
          />
        )}
        <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2">
          {marked && <FlagStribe farver={marked.farver} className="h-2 rounded-none border-0 border-b-2" />}
          <div className="flex items-start gap-3 p-3">
            {konk ? (
              <Monogram tekst={konk.monogram} farve={konk.farve} str={56} />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-line bg-warn pixel-skygge">
                <Ikon navn="skjold" farve="var(--color-line)" indre="var(--color-warn)" str={30} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
                <Ikon navn={bonuskrig ? 'svaerd' : 'skjold'} farve="var(--color-muted)" indre="var(--color-line)" str={12} />
                {bonuskrig ? konk?.navn ?? 'En gigant' : marked?.tilsyn ?? 'Tilsynet'} · {signal.regel}: {regel.navn}
              </p>
              <p className="font-pixel text-sm font-black leading-snug text-ink" data-testid="reaktion-tekst">
                {signal.tekst}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="reaktion-regel">
          <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="spoergsmaal" farve="var(--color-cyan)" str={12} /> Hvorfor sker det?
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
            <dt className="font-pixel text-xs font-black uppercase text-muted">Hvis</dt>
            <dd className="text-ink">{regel.hvis}</dd>
            <dt className="font-pixel text-xs font-black uppercase text-muted">Så</dt>
            <dd className="text-ink">{regel.saa}</dd>
          </dl>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={12} /> Konsekvenser
          </h4>
          <ul className="flex flex-col gap-1.5" data-testid="reaktion-konsekvenser">
            {linjer.map((l) => (
              <li key={l.tekst} className="flex items-start gap-2 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 text-sm text-ink">
                <Ikon navn={l.ikon} farve={l.farve} indre="var(--color-line)" className="mt-0.5 shrink-0" />
                <span>{l.tekst}</span>
              </li>
            ))}
          </ul>
        </section>

        {indeks && (
          <section className="rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="reaktion-indeks">
            <h4 className="mb-1.5 flex items-center justify-between gap-2 font-pixel text-xs font-black uppercase tracking-wider text-ink">
              <span className="flex items-center gap-1.5">
                <Ikon navn="hype" farve="var(--color-pink)" indre="var(--color-line)" str={12} /> Jeres aggressivitet i {marked?.navn}
              </span>
              <span className="tal" style={{ color: indeks.total >= indeks.taerskel ? 'var(--color-bad)' : 'var(--color-good)' }}>
                {indeks.total} / grænse {indeks.taerskel}
              </span>
            </h4>
            <ul className="flex flex-wrap gap-1">
              {indeks.dele.map((d) => (
                <li
                  key={d.navn}
                  className={`tal inline-flex items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 text-[0.72rem] font-bold ${d.v > 0 ? 'bg-panel text-ink' : 'bg-bg text-dim'}`}
                >
                  <Ikon navn={d.v > 0 ? 'op' : 'streg'} farve={d.v > 0 ? 'var(--color-warn)' : 'var(--color-dim)'} str={10} />
                  {d.navn} {d.v}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              Ligger indekset på {R8.taerskel} eller mere i {R8.kvartaler} kvartaler i træk, kommer der et nyt påbud. Hold det under, og tilsynet finder andre at kigge på.
            </p>
          </section>
        )}

        {bonuskrig && aktiv && (
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Ikon navn="ur" farve="var(--color-muted)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={12} />
            Bonuskrigen slutter af sig selv i {datoTekst(aktiv.slutUge)}. Mange udfordrere flytter lidt marketing til andre markeder imens — eller nyder, at de er blevet store nok til at blive bemærket.
          </p>
        )}
      </div>
    </Modal>
  );
}
