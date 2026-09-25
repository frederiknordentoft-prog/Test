// Sanktion (signal 'sanktion'): trin 1-4 på trappen (påbud → bøde → gennemgang → inddragelse) med tilsynets navn,
// bøden, suspensionen, konsekvenserne, tillidstrappen og konkrete råd til at komme ned ad trappen igen.
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi, type PanelId } from '../../store/uiStore';
import { vaelgMarked } from '../lib/markedHjaelp';
import { MARKETS } from '../../data/markets';
import { TRUST } from '../../data/trust';
import { datoTekst, SANKTION_NAVN, SANKTION_RISIKO, tillidsPoster } from '../../sim/selectors';
import { rystelse } from '../../render/particles';
import { spil } from '../../audio/sfx';
import { reduceretBevaegelseNu } from '../hooks/useMedia';
import { Btn, Ikon, Modal, type IkonNavn } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { TillidsTrappe } from '../components/TvaersDele';
import { mio } from '../format';
import { naesteTrin, sanktionsRaad, tillidsTendens, ugerKort } from '../lib/tvaersHjaelp';

type Konsekvens = { ikon: IkonNavn; tekst: string; farve: string };

const TRIN_IKON: Record<1 | 2 | 3 | 4, IkonNavn> = { 1: 'nyhed', 2: 'penge', 3: 'pause', 4: 'kryds' };
const TRIN_FARVE: Record<1 | 2 | 3 | 4, string> = { 1: 'var(--color-warn)', 2: 'var(--color-warn)', 3: 'var(--color-bad)', 4: 'var(--color-bad)' };
const fmt1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  const t = String(Math.abs(r)).replace('.', ',');
  return r > 0 ? `+${t}` : r < 0 ? `−${t}` : '±0';
};

export default function SanktionDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const trinRaa = signal.k === 'sanktion' ? signal.trin : 1;
  useEffect(() => {
    // Skærmryst og et dumpt "dunk" — ingen rystelse med reduceret bevægelse
    if (!reduceretBevaegelseNu()) rystelse(trinRaa >= 3 ? 520 : 380, trinRaa >= 3 ? 6 : 4);
    try {
      spil('fejl');
    } catch {
      /* lyd må aldrig vælte spillet */
    }
  }, [trinRaa]);
  if (!g || signal.k !== 'sanktion') return null;

  const { marked: m, trin, boede } = signal;
  const def = MARKETS[m];
  const ms = g.markeder[m];
  const navn = SANKTION_NAVN[trin];
  const naeste = naesteTrin(trin);
  const tendens = tillidsTendens(g, m);
  const poster = tillidsPoster(g, m).filter((p) => p.vaerdi !== 0);
  const raad = sanktionsRaad(g, m);
  const suspUger = ms.suspenderetTil !== null ? Math.max(0, ms.suspenderetTil - g.uge) : 8;

  const konsekvenser: Konsekvens[] = [];
  if (trin === 1) {
    konsekvenser.push({ ikon: 'penge', tekst: `Sagsbehandlingen koster ${mio(0.05)}`, farve: 'var(--color-gold)' });
    konsekvenser.push({ ikon: 'nyhed', tekst: `${def.tilsyn} holder øje. Der sker ikke mere, hvis tilliden holder sig over ${naeste?.graense ?? 40}.`, farve: 'var(--color-muted)' });
  }
  if (trin === 2) {
    konsekvenser.push({ ikon: 'penge', tekst: `Bøden på ${mio(boede ?? 0.2)} er trukket fra kassen.`, farve: 'var(--color-bad)' });
    konsekvenser.push({ ikon: 'stjerne', tekst: 'Omdømmet falder 3 point — det mærkes på hypen og lanceringerne.', farve: 'var(--color-warn)' });
  }
  if (trin === 3) {
    konsekvenser.push({
      ikon: 'pause',
      tekst: `Licensen er suspenderet i ${ugerKort(suspUger)}${ms.suspenderetTil !== null ? ` (til ${datoTekst(ms.suspenderetTil)})` : ''}. Ingen BSI fra ${def.navn} så længe.`,
      farve: 'var(--color-bad)',
    });
    konsekvenser.push({ ikon: 'folk', tekst: 'Kunderne kan ikke spille og siver væk — ca. 10 % om ugen.', farve: 'var(--color-bad)' });
    konsekvenser.push({ ikon: 'stjerne', tekst: 'Omdømmet falder 5 point.', farve: 'var(--color-warn)' });
  }
  if (trin === 4) {
    konsekvenser.push({ ikon: 'kryds', tekst: `Licensen i ${def.navn} er inddraget for altid. Alle kunder her er tabt.`, farve: 'var(--color-bad)' });
    konsekvenser.push({ ikon: 'produkt', tekst: `Jeres produkter er trukket ud af ${def.navn}. Produkter uden andre markeder er lukket.`, farve: 'var(--color-bad)' });
    if (m === 'dk') konsekvenser.push({ ikon: 'globus', tekst: `Tabt dansk licens smitter: −${Math.abs(TRUST.dkLicensTabSmitte)} i tilsynstillid i alle andre markeder.`, farve: 'var(--color-bad)' });
  }
  if (naeste && trin < 4) {
    konsekvenser.push({
      ikon: 'advarsel',
      tekst: `Næste trin er ${naeste.trin === 4 ? 'inddragelse' : naeste.trin === 3 ? 'en gennemgang med suspension' : 'en bøde'}, hvis tilliden kommer under ${naeste.graense} — der er ${Math.round(SANKTION_RISIKO * 100)} % risiko pr. kvartal.`,
      farve: 'var(--color-warn)',
    });
  }

  const gaaTil = (panel: PanelId) => {
    if (panel === 'marked') vaelgMarked(m);
    useUi.getState().setPanel(panel);
    onLuk();
  };
  const titel = `${navn} · ${def.navn}`;

  return (
    <Modal
      titel={titel}
      onLuk={onLuk}
      testId="dialog-sanktion"
      bredde={660}
      fod={
        <Btn variant="primaer" onClick={onLuk} testId="sanktion-ok" className="w-full sm:w-auto">
          Forstået
        </Btn>
      }
    >
      <div className="flex flex-col gap-3" data-trin={trin}>
        <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2">
          <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
          <div className="flex items-start gap-3 p-3">
            <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border-2 border-line pixel-skygge" style={{ background: TRIN_FARVE[trin] }}>
              <Ikon navn={TRIN_IKON[trin]} farve="var(--color-line)" indre={TRIN_FARVE[trin]} str={26} />
              <span className="font-pixel text-[0.55rem] font-black uppercase text-line">Trin {trin}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
                <Ikon navn="skjold" farve="var(--color-muted)" indre="var(--color-line)" str={12} /> {def.tilsyn}
              </p>
              <h3 className="font-pixel text-base font-black leading-snug text-ink" data-testid="sanktion-overskrift">
                {trin === 1 && `${def.tilsyn} giver ${g.firmaNavn} et påbud`}
                {trin === 2 && (
                  <>
                    Bøde på <span className="text-bad">{mio(boede ?? 0.2)}</span>
                  </>
                )}
                {trin === 3 && `Licensen i ${def.navn} er suspenderet`}
                {trin === 4 && `Licensen i ${def.navn} er inddraget`}
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {trin === 1 && 'Tilsynet har kigget jer over skulderen og vil se strammere procedurer. Endnu er det bare en løftet pegefinger.'}
                {trin === 2 && 'Påbuddet hjalp ikke nok. Nu koster det — og pressen har fået nys om det.'}
                {trin === 3 && `Tilsynet gennemgår hele forretningen. I ${ugerKort(suspUger)} står ${def.navn} stille.`}
                {trin === 4 && 'Tilliden er brugt op. Markedet er lukket for jer — resten af forretningen kører videre.'}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" str={12} /> Konsekvenser
          </h4>
          <ul className="flex flex-col gap-1.5" data-testid="sanktion-konsekvenser">
            {konsekvenser.map((k) => (
              <li key={k.tekst} className="flex items-start gap-2 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 text-sm text-ink">
                <Ikon navn={k.ikon} farve={k.farve} indre="var(--color-line)" className="mt-0.5 shrink-0" />
                <span>{k.tekst}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border-2 border-line bg-bg2 p-2.5">
          <h4 className="mb-2 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="trend" farve="var(--color-gold)" str={12} /> Sanktionstrappen i {def.navn}
          </h4>
          <TillidsTrappe tillid={ms.tilsynstillid} trin={trin} testId="sanktion-trappe" />
          {trin < 4 && (
            <p className="mt-2 text-xs text-muted">
              Fire rolige kvartaler i træk med tillid på mindst <b className="text-good">60</b> flytter jer et trin ned igen
              {ms.sanktion.trin > 0 && ms.sanktion.roligeKvartaler > 0 && <> — I har {Math.min(3, ms.sanktion.roligeKvartaler)} af 4</>}.
            </p>
          )}
          {trin < 4 && poster.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1" data-testid="sanktion-poster">
              <span className="text-xs text-muted">Pr. kvartal:</span>
              {poster.map((p) => (
                <span
                  key={p.tekst}
                  className="tal inline-flex items-center gap-1 rounded border-2 border-line bg-panel px-1.5 py-0.5 text-[0.7rem] font-bold"
                  style={{ color: p.vaerdi > 0 ? 'var(--color-good)' : 'var(--color-bad)' }}
                >
                  {p.tekst} {fmt1(p.vaerdi)}
                </span>
              ))}
              <span className="tal ml-auto font-pixel text-xs font-black" style={{ color: tendens >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                I alt {fmt1(tendens)}
              </span>
            </div>
          )}
        </section>

        <section>
            <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
              <Ikon navn="flueben" farve="var(--color-good)" str={12} /> {trin < 4 ? 'Sådan kommer I op igen' : 'Så det ikke sker i de andre markeder'}
            </h4>
            {raad.length === 0 ? (
              <p className="text-sm text-muted">I gør allerede det, der trækker op. Hold kursen — tilliden kommer langsomt igen.</p>
            ) : (
              <ul className="flex flex-col gap-1.5" data-testid="sanktion-raad">
                {raad.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-bg2 px-2 py-1.5" data-testid={`sanktion-raad-${r.id}`}>
                    <Ikon navn={r.ikon} farve={r.farve} indre="var(--color-line)" className="shrink-0" />
                    <span className="min-w-0 flex-1 text-sm text-ink">{r.tekst}</span>
                    <Btn lille onClick={() => gaaTil(r.panel)} testId={`sanktion-gaa-${r.id}`} className="min-h-[44px] shrink-0">
                      {r.knap} <Ikon navn="pil" farve="currentColor" str={12} />
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </Modal>
  );
}
