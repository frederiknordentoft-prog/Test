/** Danish money formatting. All amounts are integer øre. */

const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/** 123456 → "1.234,56 kr." */
export function formatKr(amount: number): string {
  return `${nf2.format(amount / 100)} kr.`;
}

/** 123400 → "1.234 kr." ; 123450 → "1.234,50 kr." */
export function formatKrShort(amount: number): string {
  return amount % 100 === 0 ? `${nf0.format(amount / 100)} kr.` : formatKr(amount);
}

/** 123456 → "1.234,56" */
export function formatAmount(amount: number): string {
  return nf2.format(amount / 100);
}

/** 12.5 → "12,5×" ; 3 → "3×" */
export function formatMultiple(x: number): string {
  const s = Number.isInteger(x) ? String(x) : x.toFixed(x < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '');
  return `${s.replace('.', ',')}×`;
}

/** 0.9612 → "96,12 %" */
export function formatPercent(x: number, digits = 2): string {
  return `${(x * 100).toFixed(digits).replace('.', ',')} %`;
}
