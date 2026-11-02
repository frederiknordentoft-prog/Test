/** Danish number formatting. Decimal comma, dot thousands, hard space before %. */
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const kr = (v: number): string => `${nf0.format(Math.round(v))} kr`;
export const int = (v: number): string => nf0.format(Math.round(v));
export const odds = (decimal: number): string => nf2.format(decimal);
export const pct = (p: number): string => `${nf0.format(Math.round(p * 100))} %`;
export const minute = (m: number): string => (m > 90 ? `90+${Math.ceil(m - 90)}'` : `${Math.floor(m)}'`);
