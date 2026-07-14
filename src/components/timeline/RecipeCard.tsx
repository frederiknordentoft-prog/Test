import { RECIPES, SIZE_LABELS, type Size } from '../../lib/schedule';
import { grams } from '../../lib/format';

export function RecipeCard({ size }: { size: Size }) {
  const r = RECIPES[size];
  const rows: Array<[string, string]> = [
    ['Aktiv surdej', grams(r.starter)],
    ['Vand', grams(r.water)],
    ['Mel', grams(r.flour)],
    ['Salt', grams(r.salt)],
  ];
  return (
    <section className="recipe" aria-label="Opskrift">
      <h2 className="recipe-title">
        <span aria-hidden="true">📋</span> Opskrift · {SIZE_LABELS[size]}
      </h2>
      <ul className="recipe-list">
        {rows.map(([label, amount]) => (
          <li key={label}>
            <span className="recipe-ing">{label}</span>
            <span className="recipe-amt">{amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
