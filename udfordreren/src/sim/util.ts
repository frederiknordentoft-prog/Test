// Små fælles hjælpere til sim-kernen.
import type { GameState, NewsItem, Signal } from './types';
import type { Rng } from './rng';
import { arkivId as arkivOpslag } from '../data/archive';

export type Ctx = { s: GameState; rng: Rng };

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const round2 = (v: number): number => Math.round(v * 100) / 100;
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function nyId(s: GameState, prefix: string): string {
  s.naesteId += 1;
  return `${prefix}${s.naesteId}`;
}

export function nyhed(s: GameState, tekst: string, kind?: NewsItem['kind'], arkivId?: string): void {
  const item: NewsItem = { uge: s.uge, tekst };
  if (kind) item.kind = kind;
  if (arkivId) {
    item.arkivId = arkivId;
    const a = arkivOpslag(arkivId);
    if (a && s.arkiv && !s.arkiv.includes(a)) s.arkiv.push(a);
  }
  s.nyheder.unshift(item);
  if (s.nyheder.length > 80) s.nyheder.length = 80;
}

export function signal(s: GameState, sig: Signal): void {
  s.signaler.push(sig);
}

export function afvis(s: GameState, tekst: string): false {
  s.signaler.push({ k: 'fejl', tekst });
  return false;
}

export function harFlag(s: GameState, flag: string): boolean {
  return s.flags.includes(flag);
}

export function saetFlag(s: GameState, flag: string): void {
  if (!s.flags.includes(flag)) s.flags.push(flag);
}

/** Betal en engangsudgift. Returnerer false (og signalerer), hvis der ikke er råd. */
export function betal(s: GameState, beloeb: number, hvad: string): boolean {
  if (beloeb <= 0) return true;
  if (s.kapital < beloeb) {
    afvis(s, `Ikke råd til ${hvad} (${fmtMio(beloeb)}).`);
    return false;
  }
  s.kapital -= beloeb;
  s.engangsUge += beloeb;
  return true;
}

export function fmtMio(v: number): string {
  const a = Math.abs(v);
  if (a >= 100) return `${Math.round(v)} mio. kr.`;
  if (a >= 1) return `${v.toFixed(1).replace('.', ',')} mio. kr.`;
  return `${Math.round(v * 1000).toLocaleString('da-DK')} t. kr.`;
}
