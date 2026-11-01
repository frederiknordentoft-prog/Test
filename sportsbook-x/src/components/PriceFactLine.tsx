import { factLine } from '../odds/factline';
import type { Market } from '../data/catalog';

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export function PriceFactLine({ market }: { market: Market }) {
  if (market.layout === 'ladder') {
    return (
      <div className="factline" role="note">
        <span>Normaliseret til <b className="num">100 %</b></span>
        <span>Margin <b className="num">{Math.round(market.margin * 100)} %</b></span>
        <span>"Andet" er ikke handelbar</span>
      </div>
    );
  }
  const { impliedPct, marginPct } = factLine(market.selections.map((s) => s.odds));
  return (
    <div className="factline" role="note">
      <span>Samlet implicit <b className="num">{fmt(impliedPct)} %</b></span>
      <span>Margin <b className="num">{fmt(marginPct)} %</b></span>
      <span>Beregnet fra de viste odds</span>
    </div>
  );
}
