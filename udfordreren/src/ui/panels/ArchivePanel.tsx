// Arkivet (spec 6.18): "I virkeligheden …"-opslag, der låses op, når markeder, konkurrenter og begivenheder dukker op.
// Ulåste opslag vises ordret fra src/data/archive.ts; låste vises som "???" med et hint om, hvad der låser dem op.
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Panel, Tom } from '../components/kit';
import { arkivListe } from '../lib/arkivHjaelp';

type Filter = 'alle' | 'aabne' | 'laaste';

export default function ArchivePanel() {
  const arkiv = useGame((s) => s.game?.arkiv);
  const arkivTil = useGame((s) => s.settings.arkiv);
  const [filter, setFilter] = useState<Filter>('alle');
  const liste = arkivListe({ arkiv: arkiv ?? [] });
  const aabne = liste.filter((r) => !r.laast).length;

  if (!arkivTil) {
    return (
      <Panel titel="Arkiv" ikon="arkiv" testId="panel-arkiv">
        <Tom>
          <span className="flex flex-col items-center gap-2">
            Arkivet er slået fra.
            <Btn onClick={() => useGame.getState().opdaterSettings({ arkiv: true })} testId="arkiv-slaa-til">
              Slå Arkivet til
            </Btn>
          </span>
        </Tom>
      </Panel>
    );
  }

  const vist = liste.filter((r) => (filter === 'alle' ? true : filter === 'aabne' ? !r.laast : r.laast));
  const FILTRE: { id: Filter; navn: string; antal: number }[] = [
    { id: 'alle', navn: 'Alle', antal: liste.length },
    { id: 'aabne', navn: 'Låst op', antal: aabne },
    { id: 'laaste', navn: 'Låste', antal: liste.length - aabne },
  ];

  return (
    <Panel
      titel="Arkiv"
      ikon="arkiv"
      testId="panel-arkiv"
      hoejre={
        <span className="tal font-pixel text-xs text-muted" data-testid="arkiv-antal">
          {aabne}/{liste.length}
        </span>
      }
    >
      <p className="mb-3 text-sm text-muted">
        I virkeligheden … Her står det, spillet er inspireret af. Opslagene låses op, når markeder, rivaler og nyheder dukker op hos jer.
      </p>
      <div className="mb-3 h-2.5 overflow-hidden rounded-sm border-2 border-line bg-bg" aria-hidden>
        <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${(aabne / Math.max(1, liste.length)) * 100}%` }} />
      </div>
      <div className="shell-uden-scrollbar -mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3" role="radiogroup" aria-label="Filtrér Arkivet">
        {FILTRE.map((f) => {
          const valgt = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={valgt}
              data-testid={`arkivfilter-${f.id}`}
              onClick={() => setFilter(f.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-bold ${
                valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:text-ink'
              }`}
            >
              {f.id !== 'alle' && <Ikon navn={f.id === 'aabne' ? 'arkiv' : 'laas'} str={14} farve="currentColor" indre={valgt ? 'var(--color-gold)' : 'var(--color-panel2)'} />}
              {f.navn}
              <span className={`tal font-pixel text-[0.65rem] ${valgt ? 'text-line/70' : 'text-dim'}`}>{f.antal}</span>
            </button>
          );
        })}
      </div>
      {vist.length === 0 ? (
        <Tom>{filter === 'aabne' ? 'Intet er låst op endnu. Arkivet fyldes, efterhånden som verden åbner sig.' : 'Alt er låst op. Flot arbejde, arkivar!'}</Tom>
      ) : (
        <ol className="grid gap-2 xl:grid-cols-2" data-testid="arkivliste">
          {vist.map(({ opslag, nr, laast, hint }) => (
            <li key={opslag.id} data-testid={`arkiv-${opslag.id}`} data-laast={laast ? '1' : '0'}>
              {laast ? (
                <div className="flex h-full gap-2.5 rounded-md border-2 border-dashed border-hi bg-bg2/60 p-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-line bg-panel" title="Låst">
                    <Ikon navn="laas" farve="var(--color-dim)" indre="var(--color-line)" str={18} titel="Låst" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-pixel text-[0.65rem] font-bold uppercase tracking-wider text-dim">Opslag {nr}</div>
                    <div className="font-pixel text-base font-black text-dim">???</div>
                    <p className="text-xs leading-snug text-muted">{hint}</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => useUi.getState().aabn({ kind: 'arkiv', id: opslag.id })}
                  className="flex h-full min-h-[44px] w-full gap-2.5 rounded-md border-2 border-line bg-bg2 p-2.5 text-left pixel-skygge transition-transform hover:bg-panel2 active:translate-y-[2px]"
                  aria-label={`Læs opslaget ${opslag.titel}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-line bg-gold" title="Låst op">
                    <Ikon navn="arkiv" farve="var(--color-line)" indre="var(--color-gold)" str={18} titel="Låst op" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-pixel text-[0.65rem] font-bold uppercase tracking-wider text-gold">Opslag {nr}</span>
                    <span className="block font-pixel text-sm font-black text-ink">{opslag.titel}</span>
                    <span className="mt-0.5 line-clamp-3 block text-xs leading-snug text-muted">{opslag.tekst}</span>
                  </span>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
