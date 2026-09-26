// Formattering af tal på dansk.
/** Hårdt mellemrum: beløb og enhed brydes aldrig over to linjer (fx "800 t. / kr." i en smal knap) */
const NB = '\u00a0';

export function mio(v: number): string {
  const a = Math.abs(v);
  const tegn = v < 0 ? '−' : '';
  if (a >= 1000) return `${tegn}${(a / 1000).toFixed(1).replace('.', ',')}${NB}mia.${NB}kr.`;
  if (a >= 100) return `${tegn}${Math.round(a)}${NB}mio.${NB}kr.`;
  if (a >= 1) return `${tegn}${a.toFixed(1).replace('.', ',')}${NB}mio.${NB}kr.`;
  return `${tegn}${Math.round(a * 1000).toLocaleString('da-DK')}${NB}t.${NB}kr.`;
}

/** Kort: 1,2 mio / 350 t */
export function mioKort(v: number): string {
  const a = Math.abs(v);
  const tegn = v < 0 ? '−' : '';
  if (a >= 1000) return `${tegn}${(a / 1000).toFixed(1).replace('.', ',')}${NB}mia`;
  if (a >= 10) return `${tegn}${Math.round(a)}${NB}mio`;
  if (a >= 1) return `${tegn}${a.toFixed(1).replace('.', ',')}${NB}mio`;
  return `${tegn}${Math.round(a * 1000)}${NB}t`;
}

/** "12 uger" med hårdt mellemrum (til knaptekster) */
export function ugerNb(n: number): string {
  return `${n}${NB}uge${n === 1 ? '' : 'r'}`;
}

export function heltal(v: number): string {
  return Math.round(v).toLocaleString('da-DK');
}

export function pct(v: number, dec = 0): string {
  return `${(v * 100).toFixed(dec).replace('.', ',')} %`;
}

export function fortegn(v: number, dec = 0): string {
  const s = v.toFixed(dec).replace('.', ',');
  return v > 0 ? `+${s}` : v < 0 ? s.replace('-', '−') : s;
}
