// Et nyt marked åbner (signal 'markedAabner'): fejring + markedets konsolkort — størrelse, afgift, strenghed,
// CAC-faktor og licens (gebyr/behandlingstid). Primærknappen søger licens til startvertikalen.
import { useEffect, useState } from 'react';
import type { Signal, Vertical } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { MARKETS } from '../../data/markets';
import { VERTICALS, ANDEN_VERTIKAL } from '../../data/verticals';
import { REGLER } from '../../data/regulationTimeline';
import { VERTIKAL_LICENS, LICENS_AARSGEBYR } from '../../data/costs';
import { datoTekst, licensPris, licensStatus, markedStoerrelse } from '../../sim/selectors';
import { Btn, Ikon, Modal } from '../components/kit';
import { Chip, FlagStribe, Pips } from '../components/FirmaDele';
import { PixelTekst } from '../components/ShellPixelFont';
import { Konfetti } from '../components/ShellKonfetti';
import { Noegle } from '../components/TvaersDele';
import { spil } from '../../audio/sfx';
import { mio, mioKort } from '../format';
import { procent } from '../lib/firmaHjaelp';
import { faktorTekst, markedAarsBsi, markedBeskrivelse, stoerrelseTekst, ugerKort } from '../lib/tvaersHjaelp';
import { vaelgMarked } from '../lib/markedHjaelp';

const VERTIKALER: Vertical[] = ['betting', 'kasino'];
const fmt1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

export default function MarkedAabnerDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const m = signal.k === 'markedAabner' ? signal.marked : 'dk';
  const g = useGame((s) => s.game);
  const [medAnden, setMedAnden] = useState(false);
  useEffect(() => {
    try {
      spil('fanfareSlut');
    } catch {
      /* lyd må aldrig vælte spillet */
    }
  }, []);
  // Det nye marked er det naturlige at se på, næste gang spilleren åbner Marked
  useEffect(() => vaelgMarked(m), [m]);
  if (!g) return null;

  const def = MARKETS[m];
  const ms = g.markeder[m];
  const v = g.startVertikal;
  const anden = ANDEN_VERTIKAL[v];
  const harAnden = Object.values(g.markeder).some((x) => x.vertikaler[anden].status !== 'ingen');
  const pris = licensPris(g, m);
  const st = licensStatus(g, m);
  const allerede = ms.vertikaler[v].status !== 'ingen';
  const andenAllerede = ms.vertikaler[anden].status !== 'ingen';
  const ekstra = medAnden && !andenAllerede ? VERTIKAL_LICENS.gebyr : 0;
  const total = (allerede ? 0 : pris.gebyr) + ekstra;
  const raad = g.kapital >= total;
  const grund = !st.ok
    ? st.grund
    : allerede
      ? `Der er allerede søgt ${VERTICALS[v].kort.toLowerCase()}-licens i ${def.navn}.`
      : !raad
        ? `Ikke råd endnu: licensen koster ${mio(total)}, og kassen har ${mio(g.kapital)}. I kan søge senere under Marked.`
        : undefined;

  const soeg = () => {
    if (grund) return;
    const d = useGame.getState().dispatch;
    const ok = d({ t: 'applyLicense', market: m, vertical: v });
    if (ok && medAnden && !andenAllerede) d({ t: 'applyLicense', market: m, vertical: anden });
    if (ok) {
      useGame.getState().toast(`Ansøgning sendt til ${def.tilsyn}!`, 'godt');
      onLuk();
    }
  };

  const afgiftEns = ms.afgiftPrVertikal.betting === ms.afgiftPrVertikal.kasino;
  // Et marked, der åbner uden for tidsplanen (Norge i et verdensscenarie): licensen er gratis og straks, og afgiften
  // er endnu ikke fastsat — sig det, i stedet for at det ligner en fejl
  const overgang = def.aabnerUge === null;
  const gebyrTekst = pris.gebyr <= 0 ? 'Gratis' : mio(pris.gebyr);
  const indsats = def.afgiftModel === 'indsats';
  const regler = [
    ...ms.regler.map((id) => ({ id, navn: REGLER[id]?.navn ?? id, uge: null as number | null })),
    ...g.planlagteRegler.filter((p) => p.marked === m).map((p) => ({ id: p.regelId, navn: REGLER[p.regelId]?.navn ?? p.regelId, uge: p.ikrafttraedelseUge })),
  ];

  return (
    <Modal
      titel="Nyt marked!"
      onLuk={onLuk}
      testId="dialog-markedAabner"
      bredde={640}
      fod={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {grund && (
            <p className="flex min-w-0 flex-1 basis-full items-start gap-1.5 text-xs font-bold text-warn sm:basis-auto" data-testid="markedAabner-grund">
              <Ikon navn={allerede ? 'flueben' : 'advarsel'} farve={allerede ? 'var(--color-good)' : 'var(--color-warn)'} indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
              {grund}
            </p>
          )}
          <div className="flex w-full gap-2 sm:w-auto">
            <Btn variant="ghost" onClick={onLuk} testId="markedAabner-senere" className="flex-1 sm:flex-none">
              Senere
            </Btn>
            <Btn variant="primaer" onClick={soeg} disabled={!!grund} title={grund} testId="markedAabner-soeg" className="flex-[2] sm:flex-none">
              <Ikon navn="noegle" farve="currentColor" indre="var(--color-gold)" /> Søg licens · {(total || pris.gebyr) <= 0 ? 'gratis' : (total || pris.gebyr) < 1 ? mio(total || pris.gebyr) : mioKort(total || pris.gebyr)}
            </Btn>
          </div>
        </div>
      }
    >
      <Konfetti antal={120} />
      <div className="flex flex-col gap-3">
        <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2 pixel-skygge" data-testid="markedAabner-kort">
          <FlagStribe farver={def.farver} className="h-3 rounded-none border-0 border-b-2" />
          <div className="flex flex-col items-center gap-2 px-3 pt-3 pb-2.5 text-center">
            <span className="flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-widest text-muted">
              <Ikon navn="skjold" farve="var(--color-muted)" indre="var(--color-line)" str={12} /> {def.tilsyn} åbner for licenser
            </span>
            <div className="shell-svaev flex max-w-full items-center justify-center">
              <PixelTekst tekst={def.navn} dybde={1} className="h-11 w-auto max-w-full" titel={def.navn} />
            </div>
            <p className="max-w-md text-sm text-muted" data-testid="markedAabner-beskrivelse">{markedBeskrivelse(m, g.uge, ms.aaben)}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-t-2 border-line p-2.5 sm:grid-cols-3">
            {VERTIKALER.map((x) => {
              // Norge har ingen tidsplan i datafilen: brug størrelsen i denne verden (det grå marked, der nu kan licenseres)
              const aar = overgang ? markedStoerrelse(g, m, x) * 52 : markedAarsBsi(m, x, g.uge);
              return (
                <Noegle key={x} label={`Marked · ${VERTICALS[x].kort}`} titel="Hele markedets online-BSI pr. år (licenseret + offshore)" testId={`markedAabner-stoerrelse-${x}`}>
                  <span className="tal font-pixel text-sm font-bold text-gold">{aar > 0 ? stoerrelseTekst(aar) : '–'}</span>
                </Noegle>
              );
            })}
            <Noegle
              label={overgang ? 'Afgift (overgang)' : indsats ? 'Afgift af indsats' : 'Afgift af BSI'}
              titel={overgang ? 'Afgiften er endnu ikke fastsat for det nye licensmarked' : indsats ? 'Indsatsafgift: rammer alle spil — også dem, huset taber' : undefined}
            >
              <span className="tal font-pixel text-sm font-bold text-ink">
                {afgiftEns ? procent(ms.afgiftPrVertikal.betting) : `${procent(ms.afgiftPrVertikal.betting)} / ${procent(ms.afgiftPrVertikal.kasino)}`}
              </span>
            </Noegle>
            <Noegle label={`Strenghed ${fmt1(ms.strenghed)}/5`} titel="Regler for bonus, grænser, reklame og KYC">
              <Pips vaerdi={ms.strenghed} label="Strenghed" />
            </Noegle>
            <Noegle label="Kundepris (CAC)" titel={`Nye kunder koster ${faktorTekst(def.cacFaktor)} så meget som i Danmark`}>
              <span className={`tal font-pixel text-sm font-bold ${def.cacFaktor > 1.3 ? 'text-warn' : 'text-ink'}`}>{faktorTekst(def.cacFaktor)}</span>
              <span className="text-[0.66rem] text-dim"> af DK</span>
            </Noegle>
            <Noegle label="Kanalisering" titel="Andel af spillet, der foregår hos licenserede udbydere — resten er offshore">
              <span className="tal font-pixel text-sm font-bold text-ink">{procent(ms.kanalisering, 0)}</span>
              <span className="text-[0.66rem] text-dim"> licenseret</span>
            </Noegle>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="markedAabner-licens">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
              <Ikon navn="noegle" farve="var(--color-gold)" indre="var(--color-line)" str={14} /> Licens
            </span>
            <span className="tal text-sm text-ink">
              <b className="text-gold">{gebyrTekst}</b> · {pris.uger <= 0 ? 'godkendes straks' : `behandling ${ugerKort(pris.uger)}`}
              {overgang && <span className="text-dim"> (overgangsordning)</span>}
            </span>
            <span className="tal text-xs text-dim">Årsgebyr {mio(LICENS_AARSGEBYR)} pr. vertikal</span>
          </div>
          <p className="text-xs text-muted">
            {allerede ? (
              <>
                I har allerede søgt — licensen til {VERTICALS[v].kort.toLowerCase()} er på vej.
              </>
            ) : (
              <>
                I søger til <b style={{ color: VERTICALS[v].farve }}>{VERTICALS[v].kort.toLowerCase()}</b>, jeres startvertikal. Når licensen er klar, kan nye produkter lanceres i {def.navn} — og I kan
                vælge {def.kort} allerede, når I starter udviklingen.
              </>
            )}
          </p>
          {harAnden && !allerede && !andenAllerede && (
            <button
              type="button"
              role="checkbox"
              aria-checked={medAnden}
              onClick={() => setMedAnden((x) => !x)}
              data-testid="markedAabner-anden"
              className={`flex min-h-[44px] items-center gap-2 rounded-md border-2 border-line px-2 py-1.5 text-left text-sm ${medAnden ? 'bg-hi' : 'bg-panel2'}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line ${medAnden ? 'bg-gold' : 'bg-bg'}`}>
                {medAnden && <Ikon navn="flueben" farve="var(--color-line)" str={14} />}
              </span>
              <span className="min-w-0 flex-1">
                Søg også <b style={{ color: VERTICALS[anden].farve }}>{VERTICALS[anden].kort.toLowerCase()}</b>-licens{' '}
                <span className="tal text-muted">
                  (+{mio(VERTIKAL_LICENS.gebyr)}, {ugerKort(Math.max(pris.uger, VERTIKAL_LICENS.uger))})
                </span>
              </span>
            </button>
          )}
        </section>

        {regler.length > 0 && (
          <section className="flex flex-col gap-1.5" data-testid="markedAabner-regler">
            <p className="flex items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
              <Ikon navn="paragraf" farve="var(--color-warn)" str={12} /> Regler i {def.navn}
            </p>
            <div className="flex flex-wrap gap-1">
              {regler.map((r) => (
                <Chip key={`${r.id}-${r.uge ?? 'nu'}`} ikon={r.uge === null ? 'paragraf' : 'ur'} farve="var(--color-warn)" titel={REGLER[r.id]?.beskrivelse}>
                  {r.navn}
                  {r.uge !== null && ` fra ${datoTekst(r.uge)}`}
                </Chip>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
