// Branchegallaen i december (spec 6.15). Vinderen afgøres af årets resultater mod konkurrenterne.
import type { GameState, GalaResult } from './types';
import type { Rng } from './rng';
import { GALA_CATEGORIES, GALA_UGE_I_AAR, GALA_BELOENNING } from '../data/galaCategories';
import { PLATFORM_MODELS } from '../data/platforms';
import { aarFor, ugeIAar } from './time';
import { clamp, nyhed, signal } from './util';
import { spillerKunderTotal } from './customers';

export type GalaKandidat = { id: string; spiller: number; konkurrent: number; konkurrentNavn: string; nomineret: boolean };

/** Beregner spillerens og bedste konkurrents score i hver kategori */
export function galaScores(s: GameState, rng: Rng): GalaKandidat[] {
  const aar = aarFor(s.uge);
  const start = (aar - 2012) * 52;
  const dk = s.konkurrenter.filter((c) => c.tilstede && c.markeder.includes('dk'));
  const bedsteKonk = (fn: (c: (typeof dk)[number]) => number) => {
    let best = { navn: 'Danske Lykke', v: -Infinity };
    for (const c of dk) {
      const v = fn(c);
      if (v > best.v) best = { navn: c.navn, v };
    }
    return best;
  };
  const res: GalaKandidat[] = [];

  // Årets produkt: bedste anmeldelse blandt årets lanceringer i dk
  const konkProd = s.produkter.filter((p) => p.ejer !== 'spiller' && p.lanceretUge >= start && p.markeder.includes('dk'));
  const bedsteKP = konkProd.sort((a, b) => b.total40 - a.total40)[0];
  const kpScore = bedsteKP ? bedsteKP.total40 : 26 + rng.int(0, 4);
  const kpNavn = bedsteKP ? (s.konkurrenter.find((c) => c.id === bedsteKP.ejer)?.navn ?? 'En konkurrent') : 'Danske Lykke';
  res.push({ id: 'produkt', spiller: s.aarAkk.bedsteTotal40, konkurrent: kpScore, konkurrentNavn: kpNavn, nomineret: s.aarAkk.lanceringer > 0 });

  // Årets innovation
  const innov = 12 * s.aarAkk.nyeKombinationer + 10 * s.aarAkk.nyeFeatures;
  const ki = bedsteKonk((c) => 14 + 5 * c.innovation + rng.gauss() * 4);
  res.push({ id: 'innovation', spiller: innov, konkurrent: ki.v, konkurrentNavn: ki.navn, nomineret: innov > 0 });

  // Årets ansvarlige operatør: gennemsnitlig tilsynstillid
  const tillid = s.aarAkk.tillidUger > 0 ? s.aarAkk.tillidSum / s.aarAkk.tillidUger : 0;
  const ka = bedsteKonk((c) => 70 + 2 * c.compliance + rng.gauss() * 3);
  res.push({ id: 'ansvarlig', spiller: tillid, konkurrent: ka.v, konkurrentNavn: ka.navn, nomineret: tillid >= 72 });

  // Årets udfordrer: kundevækst blandt private aktører
  const nu = spillerKunderTotal(s);
  const vaekst = nu / Math.max(5000, s.aarAkk.startKunder) - 1;
  const ku = bedsteKonk((c) => (c.arketype === 'statsselskab' ? -1 : 0.25 + 0.08 * c.aggressivitet + rng.gauss() * 0.12));
  res.push({ id: 'udfordrer', spiller: vaekst, konkurrent: ku.v, konkurrentNavn: ku.navn, nomineret: nu >= 5000 });

  // Årets platform
  const pk = s.platforme.kontoplatform;
  const kvalitet = Math.min(pk.kvalitet, PLATFORM_MODELS[pk.model].kvalitetsloft);
  const kpl = bedsteKonk((c) => 50 + 5 * c.innovation + 0.8 * (aar - 2012) + rng.gauss() * 4);
  res.push({ id: 'platform', spiller: kvalitet, konkurrent: kpl.v, konkurrentNavn: kpl.navn, nomineret: pk.model !== 'whiteLabel' });
  return res;
}

export function ugentligGalla(s: GameState, rng: Rng): void {
  if (ugeIAar(s.uge) !== GALA_UGE_I_AAR) return;
  const aar = aarFor(s.uge);
  const scores = galaScores(s, rng);
  const vundet: string[] = [];
  const kategorier: GalaResult['kategorier'] = [];
  for (const k of GALA_CATEGORIES) {
    const sc = scores.find((x) => x.id === k.id);
    if (!sc) continue;
    const vinder = sc.nomineret && sc.spiller > sc.konkurrent;
    if (vinder) vundet.push(k.id);
    kategorier.push({ id: k.id, vinder: vinder ? s.firmaNavn : sc.konkurrentNavn, spillerNomineret: sc.nomineret });
  }
  s.galla.push({ aar, vundet, kategorier });
  if (vundet.length > 0) {
    s.hype = clamp(s.hype + GALA_BELOENNING.hype * vundet.length, 0, 100);
    s.indsigt += GALA_BELOENNING.indsigt * vundet.length;
    s.omdoemme = clamp(s.omdoemme + GALA_BELOENNING.omdoemme * vundet.length, 0, 100);
    s.investorer.vaerdiBonus += GALA_BELOENNING.vaerdiLoeft * vundet.length;
    if (s.milepaele.foersteGallapris === undefined) s.milepaele.foersteGallapris = s.uge;
    const navne = vundet.map((id) => GALA_CATEGORIES.find((c) => c.id === id)?.navn ?? id).join(', ');
    nyhed(s, `Branchegallaen ${aar}: ${s.firmaNavn} vinder ${navne}!`, 'firma');
  } else {
    nyhed(s, `Branchegallaen ${aar}: ${kategorier[0]?.vinder ?? 'Danske Lykke'} løb med Årets produkt.`, 'verden');
  }
  signal(s, { k: 'galla', aar, vundet });
}
