// Markedskortet: pixelkortet (src/render/marketMap.ts, tegnet i sit eget rAF-loop uden React-rerenders) og en række
// markedschips under det. Chipsene er tastatur- og skærmlæseralternativet til at klikke på kortet (piletaster flytter valget).
import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { MarketId } from '../../sim/types';
import { MarkedKortRenderer, type KortData, type KortKlik, type KortMarked } from '../../render/marketMap';
import { MARKETS } from '../../data/markets';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { Ikon } from './kit';
import { FlagStribe } from './FirmaDele';
import { MARKED_RAEKKE, STATUS_INFO, type MarkedStatus } from '../lib/markedHjaelp';

const andelTekst = (a: number) => `${String(Math.round(a * 1000) / 10).replace('.', ',')} %`;

function KortCanvas({ data, onKlik }: { data: KortData; onKlik: (k: KortKlik) => void }) {
  const boks = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MarkedKortRenderer | null>(null);
  const klik = useRef(onKlik);
  const reduceret = useReduceretBevaegelse();
  useEffect(() => {
    klik.current = onKlik;
  }, [onKlik]);
  useEffect(() => {
    if (!boks.current || !cv.current) return;
    const r = new MarkedKortRenderer(cv.current, boks.current, (k) => klik.current(k));
    renderer.current = r;
    r.start();
    return () => {
      r.stop();
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    renderer.current?.saetData(data);
  }, [data]);
  useEffect(() => {
    renderer.current?.saetReduceret(reduceret);
  }, [reduceret]);
  const valgt = MARKETS[data.valgt];
  const st = STATUS_INFO[data.markeder[data.valgt].status];
  return (
    <div ref={boks} className="relative aspect-video w-full overflow-hidden rounded-md border-2 border-line bg-[#121935]" data-testid="markedskort">
      <canvas
        ref={cv}
        className="pixel absolute left-0 top-0 touch-manipulation select-none"
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-label={`Markedskort over Europa og Nordamerika. Valgt: ${valgt.navn}, ${st.navn.toLowerCase()}. Vælg marked med knapperne under kortet.`}
        data-testid="markedskort-canvas"
      />
    </div>
  );
}

function MarkedChips({ kort, valgt, onVaelg }: { kort: Record<MarketId, KortMarked>; valgt: MarketId; onVaelg: (m: MarketId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tast = (e: KeyboardEvent<HTMLButtonElement>, m: MarketId) => {
    const i = MARKED_RAEKKE.indexOf(m);
    let ny = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ny = (i + 1) % MARKED_RAEKKE.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ny = (i - 1 + MARKED_RAEKKE.length) % MARKED_RAEKKE.length;
    else if (e.key === 'Home') ny = 0;
    else if (e.key === 'End') ny = MARKED_RAEKKE.length - 1;
    if (ny < 0) return;
    e.preventDefault();
    const id = MARKED_RAEKKE[ny];
    onVaelg(id);
    ref.current?.querySelector<HTMLButtonElement>(`[data-testid="marked-chip-${id}"]`)?.focus();
  };
  return (
    <div ref={ref} role="radiogroup" aria-label="Vælg marked" className="grid grid-cols-3 gap-1.5 @md:grid-cols-5 @2xl:grid-cols-9 @2xl:gap-1" data-testid="marked-valg">
      {MARKED_RAEKKE.map((m) => {
        const def = MARKETS[m];
        const km = kort[m];
        const info = STATUS_INFO[km.status];
        const erValgt = m === valgt;
        const visAndel = km.andel >= 0.0005 && (km.status === 'aktiv' || km.status === 'suspenderet');
        const laast: MarkedStatus[] = ['lukket', 'monopol'];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={erValgt}
            tabIndex={erValgt ? 0 : -1}
            onClick={() => onVaelg(m)}
            onKeyDown={(e) => tast(e, m)}
            title={`${def.navn} · ${info.navn}${visAndel ? ` · jeres andel ${andelTekst(km.andel)}` : ''}`}
            data-testid={`marked-chip-${m}`}
            className={`relative flex min-h-[48px] min-w-0 flex-col overflow-hidden rounded-md border-2 border-line text-left ${
              erValgt ? 'bg-panel2 pixel-skygge ring-2 ring-gold ring-offset-0' : 'bg-panel hover:bg-panel2'
            }`}
          >
            <FlagStribe farver={def.farver} className={`h-1.5 shrink-0 rounded-none border-0 border-b-2 ${laast.includes(km.status) ? 'opacity-50 grayscale' : ''}`} />
            <span className="flex min-w-0 items-center gap-1 px-1.5 pt-0.5">
              <span className={`font-pixel text-xs font-black ${erValgt ? 'text-gold' : 'text-ink'}`}>{def.kort}</span>
              <span className="min-w-0 truncate text-xs text-muted @2xl:hidden">{def.navn}</span>
              {km.ny && <span className="ml-auto h-2 w-2 shrink-0 rounded-full border border-line bg-sky" aria-label="Nyåbnet" />}
            </span>
            <span className="flex min-w-0 items-center gap-1 px-1.5 pb-1 text-[0.68rem] font-bold leading-tight @2xl:gap-0.5 @2xl:px-1 @2xl:text-[0.64rem]" style={{ color: visAndel ? 'var(--color-gold)' : info.farve }}>
              <Ikon navn={info.ikon} farve={info.farve} indre="var(--color-line)" str={11} className="shrink-0" />
              <span className="min-w-0 truncate">
                {visAndel ? (
                  andelTekst(km.andel)
                ) : (
                  <>
                    <span className="@md:hidden">{info.kort}</span>
                    <span className="hidden @md:inline">{info.mini}</span>
                  </>
                )}
              </span>
            </span>
            {laast.includes(km.status) && (
              <span className="sr-only" data-testid={`marked-laast-${m}`}>
                Låst
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const LEGENDE: MarkedStatus[] = ['aktiv', 'ansoegt', 'aaben', 'lukket', 'suspenderet', 'inddraget', 'monopol'];

export default function MarkedKort({
  kort, valgt, offshoreAktiv, onVaelg, onOffshore,
}: { kort: Record<MarketId, KortMarked>; valgt: MarketId; offshoreAktiv: boolean; onVaelg: (m: MarketId) => void; onOffshore: () => void }) {
  const data: KortData = { markeder: kort, valgt, offshoreAktiv };
  return (
    <div className="flex flex-col gap-2">
      <KortCanvas data={data} onKlik={(k) => (k === 'offshore' ? onOffshore() : onVaelg(k))} />
      <MarkedChips kort={kort} valgt={valgt} onVaelg={onVaelg} />
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.68rem] text-muted" aria-label="Forklaring til kortet" data-testid="markedskort-forklaring">
        {LEGENDE.map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-line" style={{ background: STATUS_INFO[s].farve }} aria-hidden>
              <Ikon navn={STATUS_INFO[s].ikon} farve="var(--color-line)" str={10} />
            </span>
            {STATUS_INFO[s].kort}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-4 rounded-sm border border-line bg-gold" aria-hidden />
          Jeres andel
        </li>
      </ul>
    </div>
  );
}
