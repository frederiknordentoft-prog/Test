import { impliedSum } from '../odds/model';
import type { Market } from '../data/catalog';

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
  const sum = impliedSum(market.selections.map((s) => s.odds)) * 100;
  const margin = sum - 100;
  return (
    <div className="factline" role="note">
      <span>Samlet implicit <b className="num">{sum.toFixed(1).replace('.', ',')} %</b></span>
      <span>Margin <b className="num">{margin.toFixed(1).replace('.', ',')} %</b></span>
      <span>Beregnet fra uafrundede værdier</span>
    </div>
  );
}
