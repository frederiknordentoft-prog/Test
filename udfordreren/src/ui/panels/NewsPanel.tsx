// Nyheder: hele listen (game.nyheder) med dato, ikon/farve pr. type og filterchips.
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import type { NewsItem } from '../../sim/types';
import { datoTekst, aarFor } from '../../sim/time';
import { Ikon, Panel, Tom, type IkonNavn } from '../components/kit';
import { synligeNyheder } from '../lib/shellHjaelp';

type Filter = 'alle' | NonNullable<NewsItem['kind']>;

const KIND: Record<NonNullable<NewsItem['kind']>, { navn: string; ikon: IkonNavn; farve: string }> = {
  firma: { navn: 'Firma', ikon: 'firma', farve: 'var(--color-gold)' },
  konkurrent: { navn: 'Konkurrent', ikon: 'lyn', farve: 'var(--color-warn)' },
  marked: { navn: 'Marked', ikon: 'kort', farve: 'var(--color-sky)' },
  verden: { navn: 'Verden', ikon: 'globus', farve: 'var(--color-violet)' },
};
const ANDET = { navn: 'Nyhed', ikon: 'nyhed' as IkonNavn, farve: 'var(--color-muted)' };

const FILTRE: { id: Filter; navn: string }[] = [
  { id: 'alle', navn: 'Alle' },
  { id: 'firma', navn: 'Firma' },
  { id: 'konkurrent', navn: 'Konkurrenter' },
  { id: 'marked', navn: 'Marked' },
  { id: 'verden', navn: 'Verden' },
];

export default function NewsPanel() {
  const nyheder = useGame((s) => s.game?.nyheder);
  const uge = useGame((s) => s.game?.uge ?? 0);
  // Mens en anmeldelse/galla afsløres, holdes ugens nyheder tilbage (ingen spoilere bag dialogen)
  const dialogAaben = useGame((s) => s.dialoger.length > 0);
  const [filter, setFilter] = useState<Filter>('alle');
  const alle = synligeNyheder(nyheder, uge, dialogAaben);
  const liste = filter === 'alle' ? alle : alle.filter((n) => n.kind === filter);
  const antal = (f: Filter) => (f === 'alle' ? alle.length : alle.filter((n) => n.kind === f).length);

  let sidsteAar: number | null = null;
  return (
    <Panel titel="Nyheder" ikon="nyhed" testId="panel-nyheder" hoejre={<span className="font-pixel text-xs text-muted">{alle.length}</span>}>
      <div className="shell-uden-scrollbar -mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3" role="radiogroup" aria-label="Filtrér nyheder">
        {FILTRE.map((f) => {
          const valgt = filter === f.id;
          const k = f.id === 'alle' ? null : KIND[f.id];
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={valgt}
              data-testid={`nyhedsfilter-${f.id}`}
              onClick={() => setFilter(f.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-bold ${
                valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:text-ink'
              }`}
            >
              {k && <Ikon navn={k.ikon} farve={valgt ? 'var(--color-line)' : k.farve} indre={valgt ? 'var(--color-gold)' : 'var(--color-line)'} str={14} />}
              {f.navn}
              <span className={`tal font-pixel text-[0.65rem] ${valgt ? 'text-line/70' : 'text-dim'}`}>{antal(f.id)}</span>
            </button>
          );
        })}
      </div>
      {liste.length === 0 ? (
        <Tom>{filter === 'alle' ? 'Ingen nyheder endnu. Branchen venter på jeres første træk.' : 'Ingen nyheder i denne kategori endnu.'}</Tom>
      ) : (
        <ol className="flex flex-col gap-1.5" data-testid="nyhedsliste">
          {liste.flatMap((n, i) => {
            const k = n.kind ? KIND[n.kind] : ANDET;
            const aar = aarFor(n.uge);
            const nytAar = aar !== sidsteAar;
            sidsteAar = aar;
            const ud = [];
            if (nytAar)
              ud.push(
                <li key={`aar-${aar}-${i}`} className="mt-1 flex items-center gap-2 font-pixel text-xs font-black text-dim first:mt-0" aria-hidden>
                  <span>{aar}</span>
                  <span className="h-0.5 flex-1 bg-line" />
                </li>,
              );
            ud.push(
              <li key={`${n.uge}-${i}`} className="flex gap-2.5 rounded-md border-2 border-line bg-bg2 p-2" data-testid="nyhed">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-line" style={{ background: k.farve }} title={k.navn}>
                  <Ikon navn={k.ikon} farve="var(--color-line)" indre={k.farve} str={14} titel={k.navn} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-pixel text-[0.65rem] font-bold uppercase tracking-wide">
                    <span style={{ color: k.farve }}>{k.navn}</span>
                    <span className="tal text-dim">{datoTekst(n.uge)}</span>
                  </div>
                  <p className="text-sm leading-snug text-ink">{n.tekst}</p>
                </div>
              </li>,
            );
            return ud;
          })}
        </ol>
      )}
    </Panel>
  );
}
