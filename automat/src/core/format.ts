// Danish number/money formatting. Money is integer øre.
const nf = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const MINUS = '−';
export function fmtKr(ore: number, unit = true): string {
  const s = nf.format(Math.abs(ore) / 100);
  return (ore < 0 ? MINUS : '') + s + (unit ? ' kr' : '');
}
export function fmtSignedKr(ore: number): string {
  if (ore === 0) return '±' + fmtKr(0);
  return (ore > 0 ? '+' : MINUS) + fmtKr(Math.abs(ore));
}
export const fmtInt = (n: number) => nf0.format(n);
export const fmt1 = (n: number) => nf1.format(n);
export const fmtX = (x: number) => (x >= 100 ? nf0.format(x) : nf1.format(x)).replace(/,0$/, '') + '×';
export function fmtPct(p: number, digits = 2): string {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(p * 100) + ' %';
}
export function fmtOdds(rate: number): string {
  return '1:' + nf0.format(Math.round(1 / rate));
}
