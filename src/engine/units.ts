// Lattice ↔ display unit mapping. Honest framing:
// - The tunnel is 2D; forces are per meter span ("N pr. meter dybde").
// - Tunnel height ≙ 0.5 m. Wind slider maps 1..30 m/s ↦ u_in ∈ [U_LAT_MIN, U_LAT_MAX].
// - Cd and Re are dimensionless and computed purely in lattice units — those are the
//   trustworthy numbers; the N/m display is a consistent physical framing of them.

export const TUNNEL_HEIGHT_M = 0.5;
export const WIND_MS_MIN = 1;
export const WIND_MS_MAX = 30;
export const U_LAT_MAX = 0.12; // stability hard cap
export const U_LAT_MIN = U_LAT_MAX * (WIND_MS_MIN / WIND_MS_MAX);
export const RHO_AIR = 1.225; // kg/m³
export const TAU0 = 0.51; // BGK relaxation floor
export const NU_LAT = (TAU0 - 0.5) / 3;

export function windSliderToMs(s: number): number {
  return WIND_MS_MIN + (WIND_MS_MAX - WIND_MS_MIN) * clamp01(s);
}

export function windMsToULat(ms: number): number {
  return U_LAT_MAX * (ms / WIND_MS_MAX);
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** dx in meters for a grid of h cells height. */
export function dxPhys(gridH: number): number {
  return TUNNEL_HEIGHT_M / gridH;
}

/** dt in seconds so lattice u_in matches the displayed physical speed. */
export function dtPhys(gridH: number, uLat: number, windMs: number): number {
  return (uLat * dxPhys(gridH)) / windMs;
}

/**
 * Convert a lattice force (per lattice unit span) to N per meter span.
 * F_phys = F_lat · ρ_phys/ρ_lat · dx³/dt² / dx_span  →  per-span: F_lat·ρ·dx²/dt² · (1/dx)·dx = F_lat·ρ·dx²/dt²...
 * In 2D LBM the force has units [ρ_lat · dx⁴/dt²] per dx of span → per meter span:
 * F_N_per_m = F_lat · RHO_AIR · (dx/dt)² · dx / dx = F_lat · RHO_AIR · (dx/dt)²
 * Simplest consistent route: Cd is exact, so display F = ½·ρ_air·v²·D_m·Cd with
 * D_m = frontal height in meters — same number, no unit gymnastics.
 */
export function forceToNewtonPerM(fLat: number, uLat: number, dLatCells: number, gridH: number, windMs: number): number {
  if (uLat <= 0 || dLatCells <= 0) return 0;
  const coeff = (2 * fLat) / (1 /*rho_lat*/ * uLat * uLat * dLatCells);
  const dM = dLatCells * dxPhys(gridH);
  return 0.5 * RHO_AIR * windMs * windMs * dM * coeff;
}

export function dragCoefficient(fxLat: number, uLat: number, dLatCells: number): number {
  if (uLat <= 0 || dLatCells <= 0) return 0;
  return (2 * fxLat) / (uLat * uLat * dLatCells);
}

export function reynolds(uLat: number, dLatCells: number, nuLat = NU_LAT): number {
  return (uLat * dLatCells) / nuLat;
}
