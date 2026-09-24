// Formattering af tal på dansk.
export function mio(v: number): string {
  const a = Math.abs(v);
  const tegn = v < 0 ? '−' : '';
  if (a >= 1000) return `${tegn}${(a / 1000).toFixed(1).replace('.', ',')} mia. kr.`;
  if (a >= 100) return `${tegn}${Math.round(a)} mio. kr.`;
  if (a >= 1) return `${tegn}${a.toFixed(1).replace('.', ',')} mio. kr.`;
  return `${tegn}${Math.round(a * 1000).toLocaleString('da-DK')} t. kr.`;
}

/** Kort: 1,2 mio / 350 t */
export function mioKort(v: number): string {
  const a = Math.abs(v);
  const tegn = v < 0 ? '−' : '';
  if (a >= 1000) return `${tegn}${(a / 1000).toFixed(1).replace('.', ',')} mia`;
  if (a >= 10) return `${tegn}${Math.round(a)} mio`;
  if (a >= 1) return `${tegn}${a.toFixed(1).replace('.', ',')} mio`;
  return `${tegn}${Math.round(a * 1000)} t`;
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
