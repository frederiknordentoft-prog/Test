// Lydstyrke pr. kanal (0-1) fra indstillingerne. Ældre gemte indstillinger har ingen volumen — så bruges standarden.
export type LydKanal = 'lyd' | 'musik';

/** Standard: effekterne som hidtil, musikken lavt i baggrunden */
export const STANDARD_VOLUMEN: Record<LydKanal, number> = { lyd: 1, musik: 0.5 };

export function kanalVolumen(v: unknown, kanal: LydKanal): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : STANDARD_VOLUMEN[kanal];
  return Math.max(0, Math.min(1, n));
}

/** Øret hører logaritmisk: skyderen går gennem en kvadratisk kurve, så de lave trin kan bruges */
export function volumenTilGain(v: number): number {
  return v * v;
}
