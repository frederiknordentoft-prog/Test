// Hitlisten: "Ugens Top 10 — Danmark" med pile, "NY!", monogrammer og spillerens produkter fremhævet.
import { useState } from 'react';
import type { ChartEntry, GameState, LiveProduct, MarketId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Badge, Ikon, Monogram, Panel, Tom } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { ejerInfo } from '../../sim/competitors';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { ugeIAar, aarFor } from '../../sim/time';
import { mioKort } from '../format';
import { dkRangliste } from '../lib/firmaHjaelp';

function Bevaegelse({ e }: { e: ChartEntry }) {
  if (e.ny) {
    return (
      <Badge farve="var(--color-pink)" tekstFarve="var(--color-line)" className="anim-blink">
        NY!
      </Badge>
    );
  }
  if (e.forrige === null) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-[0.68rem] font-black text-sky" title="Tilbage på listen">
        <Ikon navn="op" farve="var(--color-sky)" str={12} /> IGEN
      </span>
    );
  }
  const d = e.forrige - e.placering;
  if (d > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-xs font-black text-good" title={`Op fra nr. ${e.forrige}`}>
        <Ikon navn="op" farve="var(--color-good)" str={12} titel={`Op ${d}`} />
        {d}
      </span>
    );
  }
  if (d < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-xs font-black text-bad" title={`Ned fra nr. ${e.forrige}`}>
        <Ikon navn="ned" farve="var(--color-bad)" str={12} titel={`Ned ${-d}`} />
        {-d}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-dim" title="Samme plads">
      <Ikon navn="streg" farve="var(--color-dim)" str={12} titel="Uændret" />
    </span>
  );
}

function Raekke({ e, p, g }: { e: ChartEntry; p: LiveProduct | undefined; g: GameState }) {
  if (!p) return null;
  const ejer = ejerInfo(g, p.ejer);
  const egen = p.ejer === 'spiller';
  const top3 = e.placering <= 3;
  return (
    <li
      data-testid={`top10-raekke-${e.placering}`}
      data-spiller={egen ? '1' : undefined}
      className={`grid min-h-12 grid-cols-[1.7rem_2.3rem_auto_1fr_auto] items-center gap-x-1.5 @md:grid-cols-[2.1rem_2.6rem_auto_1fr_auto] @md:gap-x-2 rounded-md border-2 px-1.5 py-1 ${
        egen ? 'border-gold bg-[color-mix(in_srgb,var(--color-gold)_14%,var(--color-bg2))] pixel-skygge' : 'border-line bg-bg2'
      }`}
    >
      <span className={`text-center font-pixel font-black tal ${top3 ? 'text-lg text-gold' : 'text-base text-ink'}`}>{e.placering}</span>
      <span className="flex justify-center">
        <Bevaegelse e={e} />
      </span>
      <span title={ejer.navn}>
        <Monogram tekst={ejer.monogram} farve={ejer.farve} str={28} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1">
          {egen && <Ikon navn="krone" farve="var(--color-gold)" indre="var(--color-line)" str={13} titel="Jeres produkt" className="shrink-0" />}
          <span className={`line-clamp-2 leading-tight font-bold break-words @md:truncate ${egen ? 'text-gold' : 'text-ink'}`}>{p.navn}</span>
          {p.version > 1 && <span className="shrink-0 font-pixel text-[0.65rem] font-black text-muted">{p.version}.0</span>}
        </span>
        <span className="block truncate text-xs text-muted">
          {PRODUCT_TYPES[p.typeId].navn} × {THEMES[p.themeId].navn}
          <span className="hidden @md:inline"> · {ejer.navn}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="tal block font-pixel text-sm font-bold text-gold">{mioKort(p.bsiPrUge.dk ?? 0)}</span>
        <span className="block text-[0.62rem] uppercase text-dim">BSI/uge</span>
      </span>
    </li>
  );
}

export default function ChartPanel() {
  const g = useGame((s) => s.game)!;
  const [marked] = useState<MarketId>('dk');
  const ms = g.markeder[marked];
  const liste = ms.top10;
  const rangliste = dkRangliste(g);
  const spillerIListe = liste.some((e) => g.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller');
  const bedsteUdenfor = rangliste.findIndex((p, i) => i >= 10 && p.ejer === 'spiller');
  const udenfor = bedsteUdenfor >= 0 ? rangliste[bedsteUdenfor] : undefined;
  const nr10 = rangliste[9];
  const harProdukter = g.produkter.some((p) => p.ejer === 'spiller' && p.aktiv);

  return (
    <Panel titel="Top 10" ikon="hitliste" testId="panel-hitliste" hoejre={<span className="font-pixel text-xs text-muted">Uge {ugeIAar(g.uge) + 1}, {aarFor(g.uge)}</span>}>
      <div className="@container flex flex-col gap-3">
        {/* Markedsvælger: kun Danmark er åbent i denne fase */}
        <div className="shell-uden-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Marked">
          {MARKET_IDS.map((id) => {
            const def = MARKETS[id];
            const aaben = id === 'dk';
            const valgt = id === marked;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={valgt}
                disabled={!aaben}
                data-testid={`hitliste-marked-${id}`}
                title={aaben ? def.navn : `${def.navn} åbner senere`}
                className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border-2 border-line px-2.5 font-pixel text-xs font-black uppercase ${
                  valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <FlagStribe farver={def.farver} className="h-3 w-5" />
                {aaben ? def.navn : def.kort}
                {!aaben && <Ikon navn="laas" farve="currentColor" str={10} />}
              </button>
            );
          })}
        </div>

        <div className="flex items-end justify-between gap-2">
          <h3 className="font-pixel text-base font-black uppercase tracking-wide text-ink">
            Ugens Top 10 <span className="text-gold">— {MARKETS[marked].navn}</span>
          </h3>
          <span className="hidden text-xs text-dim @md:inline">Sorteret efter BSI denne uge</span>
        </div>

        {liste.length === 0 ? (
          <Tom>Hitlisten er tom. Den første uge er ikke talt op endnu.</Tom>
        ) : (
          <ol className="flex flex-col gap-1" data-testid="top10">
            {liste.map((e) => (
              <Raekke key={e.productId} e={e} p={g.produkter.find((p) => p.id === e.productId)} g={g} />
            ))}
          </ol>
        )}

        {udenfor ? (
          <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-gold/60 bg-bg2 p-2 text-sm" data-testid="top10-udenfor">
            <Ikon navn="krone" farve="var(--color-gold)" indre="var(--color-line)" className="shrink-0" />
            <span className="min-w-0">
              Jeres bedste uden for listen: <b className="text-gold">{udenfor.navn}</b> som nr. <b className="tal">{bedsteUdenfor + 1}</b>.
              {nr10 && (
                <span className="text-muted"> Mangler {mioKort(Math.max(0, (nr10.bsiPrUge.dk ?? 0) - (udenfor.bsiPrUge.dk ?? 0)))} BSI/uge til nr. 10.</span>
              )}
            </span>
          </div>
        ) : (
          !spillerIListe && (
            <p className="flex items-center gap-1.5 text-sm text-muted" data-testid="top10-udenfor">
              <Ikon navn="spoergsmaal" farve="var(--color-dim)" str={14} className="shrink-0" />
              {harProdukter ? 'Jeres produkter har ikke nok aktivitet til at blive talt med endnu.' : 'Lancér jeres første produkt for at komme på listen.'}
            </p>
          )
        )}
        <p className="text-xs text-dim">Hitlisten opdateres hver uge. Friske produkter med god anmeldelse og mange kunder klatrer.</p>
      </div>
    </Panel>
  );
}
