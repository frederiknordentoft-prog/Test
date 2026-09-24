// Finansiering og kvartalsmål (spec 6.13): runder, udvanding, stjerner og investorpres.
import type { FundingRound, GameState, QuarterGoal } from './types';
import type { Rng } from './rng';
import { ROUNDS, RUNDE_NAVN, VAERDI_MULTIPEL, STJERNE_VAERDI, PRES_EVENT_TAERSKEL, type RoundDef } from '../data/funding';
import { aarFor, kvartalFor, ugeIAar } from './time';
import { afvis, clamp, nyId, nyhed, signal } from './util';
import { aarligBsi } from './economy';
import { spillerKunderTotal } from './customers';
import { udloesEvent } from './events';

export function vaerdiansaettelse(s: GameState): number {
  const stjerneBonus = Math.min(0.3, s.investorer.stjerner * STJERNE_VAERDI);
  const v = (VAERDI_MULTIPEL * aarligBsi(s) + Math.max(0, s.kapital)) * (1 + stjerneBonus + s.investorer.vaerdiBonus);
  return Math.max(0.5, Math.round(v * 100) / 100);
}

export function antalLanceringer(s: GameState): number {
  return s.produkter.filter((p) => p.ejer === 'spiller').length;
}

export function naesteRunde(s: GameState): { def: RoundDef | null; ok: boolean; grunde: string[] } {
  const idx = ROUNDS.findIndex((r) => r.id === s.investorer.runde);
  const def = ROUNDS[idx + 1] ?? null;
  if (!def) return { def: null, ok: false, grunde: ['Alle runder er rejst.'] };
  const grunde: string[] = [];
  const bsi = aarligBsi(s);
  if (bsi < def.kravBsiAar) grunde.push(`Kræver en årlig BSI på ${def.kravBsiAar} mio. kr. (nu ${bsi.toFixed(1).replace('.', ',')})`);
  if (antalLanceringer(s) < def.kravLanceringer) grunde.push(`Kræver ${def.kravLanceringer} lancerede produkter`);
  if (s.investorer.rundeUge !== null && s.uge - s.investorer.rundeUge < def.minUgerSiden) {
    grunde.push(`Investorerne vil se ${def.minUgerSiden - (s.uge - s.investorer.rundeUge)} ugers mere fremdrift`);
  }
  return { def, ok: grunde.length === 0, grunde };
}

export function raiseRound(s: GameState): boolean {
  const n = naesteRunde(s);
  if (!n.def) return afvis(s, 'Der er ikke flere runder.');
  if (!n.ok) return afvis(s, n.grunde[0] ?? 'Investorerne er ikke overbeviste endnu.');
  const def = n.def;
  s.kapital += def.kapital;
  s.investorer.ejerandelStiftere = Math.round(s.investorer.ejerandelStiftere * (1 - def.udvanding) * 10000) / 10000;
  s.investorer.runde = def.id;
  s.investorer.rundeUge = s.uge;
  s.investorer.pres = Math.max(0, s.investorer.pres - 1);
  s.investorer.vaerdiansaettelse = vaerdiansaettelse(s);
  if (s.milepaele.foersteRunde === undefined) s.milepaele.foersteRunde = s.uge;
  signal(s, { k: 'runde', runde: def.id as FundingRound, kapital: def.kapital });
  nyhed(s, `${s.firmaNavn} henter ${def.kapital} mio. kr. i en ${def.navn.toLowerCase()}-runde. Stifterne ejer nu ${Math.round(s.investorer.ejerandelStiftere * 100)} %.`, 'firma');
  return true;
}

function vaekstkrav(s: GameState): number {
  const def = ROUNDS.find((r) => r.id === s.investorer.runde);
  return def ? def.vaekstkrav : 0;
}

function maalTekst(kind: QuarterGoal['kind'], maal: number): string {
  switch (kind) {
    case 'lancer': return maal === 1 ? 'Lancér et produkt' : `Lancér ${maal} produkter`;
    case 'kunder': return `Nå ${Math.round(maal).toLocaleString('da-DK')} kunder`;
    case 'bsi': return `Kvartals-BSI på ${maal.toFixed(1).replace('.', ',')} mio. kr.`;
    case 'top10': return 'Hav et produkt på Top 10 i Danmark';
    case 'tillid': return `Tilsynstillid på mindst ${Math.round(maal)} i Danmark`;
    case 'overskud': return 'Overskud i kvartalet';
    case 'anmeldelse': return `Lancér et produkt med mindst ${maal}/40`;
    case 'guldkupon': return 'Vind en Guldkupon';
    case 'kontrakt': return 'Tag jeres første kontraktopgave';
    case 'projekt': return 'Start jeres første produkt';
  }
}

export function lavMaal(s: GameState, kind: QuarterGoal['kind'], maal: number): QuarterGoal {
  return { id: nyId(s, 'g'), kind, maal, tekst: maalTekst(kind, maal), opfyldt: null };
}

/** Kvartalets start-mål i garagen (mentoren sætter dem) */
export function startMaal(s: GameState): QuarterGoal[] {
  return [lavMaal(s, 'kontrakt', 1), lavMaal(s, 'projekt', 1)];
}

export function evaluerMaal(s: GameState, g: QuarterGoal): boolean {
  const dk = s.markeder.dk;
  switch (g.kind) {
    case 'lancer': return s.kvartalAkk.lanceringer >= g.maal;
    case 'kunder': return spillerKunderTotal(s) >= g.maal;
    case 'bsi': return s.kvartalAkk.bsi >= g.maal;
    case 'top10': return dk.top10.some((e) => s.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller');
    case 'tillid': return dk.tilsynstillid >= g.maal;
    case 'overskud': return s.kvartalAkk.resultat >= 0;
    case 'anmeldelse': return s.kvartalAkk.bedsteTotal40 >= g.maal;
    case 'guldkupon': return s.kvartalAkk.bedsteTotal40 >= 32;
    case 'kontrakt': return s.milepaele.foersteKontrakt !== undefined;
    case 'projekt': return s.milepaele.foersteProjekt !== undefined;
  }
}

function nyeMaal(s: GameState, rng: Rng): QuarterGoal[] {
  const krav = vaekstkrav(s);
  const kunder = spillerKunderTotal(s);
  const forrigeBsi = s.kvartalAkk.bsi;
  const muligheder: QuarterGoal[] = [];
  if (antalLanceringer(s) === 0 || s.projekter.some((p) => p.fase === 'test' || p.fase === 'teknik')) muligheder.push(lavMaal(s, 'lancer', 1));
  if (kunder >= 200) muligheder.push(lavMaal(s, 'kunder', Math.max(500, Math.round((kunder * (1.08 + krav)) / 100) * 100)));
  if (forrigeBsi > 0.2) muligheder.push(lavMaal(s, 'bsi', Math.round(forrigeBsi * (1.05 + krav) * 10) / 10));
  const iTop10 = s.markeder.dk.top10.some((e) => s.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller');
  if (!iTop10 && antalLanceringer(s) > 0) muligheder.push(lavMaal(s, 'top10', 1));
  if (s.markeder.dk.tilsynstillid < 75) muligheder.push(lavMaal(s, 'tillid', Math.max(60, Math.round(s.markeder.dk.tilsynstillid + 2))));
  if (s.kvartalAkk.resultat < 0) muligheder.push(lavMaal(s, 'overskud', 0));
  if (s.projekter.length > 0) {
    const best = Math.max(20, ...s.produkter.filter((p) => p.ejer === 'spiller').map((p) => p.total40));
    muligheder.push(lavMaal(s, 'anmeldelse', Math.min(34, best + 1)));
  }
  if (s.milepaele.foersteGuldkupon === undefined && aarFor(s.uge) >= 2014 && s.projekter.length > 0) muligheder.push(lavMaal(s, 'guldkupon', 32));
  rng.shuffle(muligheder);
  const antal = s.investorer.runde === 'ingen' ? 2 : 3;
  const valgte: QuarterGoal[] = [];
  for (const g of muligheder) {
    if (valgte.some((x) => x.kind === g.kind)) continue;
    valgte.push(g);
    if (valgte.length >= antal) break;
  }
  if (valgte.length === 0) valgte.push(lavMaal(s, 'overskud', 0));
  return valgte;
}

/** Kvartalsmøde ved starten af hvert kvartal (uge 13, 26, 39, 0) */
export function kvartalsmoede(s: GameState, rng: Rng): void {
  if (s.uge === 0 || ugeIAar(s.uge) % 13 !== 0) return;
  // Evaluer det forrige kvartals mål
  let opfyldt = 0;
  for (const g of s.kvartalsmaal) {
    g.opfyldt = evaluerMaal(s, g);
    if (g.opfyldt) opfyldt++;
  }
  const ialt = s.kvartalsmaal.length;
  s.investorer.stjerner += opfyldt;
  if (s.investorer.runde !== 'ingen') {
    const mangler = ialt - opfyldt;
    s.investorer.pres = clamp(s.investorer.pres + mangler - (mangler === 0 ? 0.5 : 0), 0, 5);
  }
  const forrigeUge = s.uge - 1;
  s.historik.push({
    aar: aarFor(forrigeUge),
    kvartal: kvartalFor(forrigeUge) + 1,
    bsi: s.kvartalAkk.bsi,
    resultat: s.kvartalAkk.resultat,
    kapital: s.kapital,
    kunder: spillerKunderTotal(s),
    lanceringer: s.kvartalAkk.lanceringer,
    bedsteTotal40: s.kvartalAkk.bedsteTotal40,
    top10: s.markeder.dk.top10.some((e) => s.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller'),
  });
  if (s.historik.length > 100) s.historik.shift();
  s.investorer.vaerdiansaettelse = vaerdiansaettelse(s);
  signal(s, { k: 'kvartal', aar: aarFor(forrigeUge), kvartal: kvartalFor(forrigeUge) + 1, opfyldt, ialt });
  // Nye mål
  s.kvartalsmaal = nyeMaal(s, rng);
  s.kvartalAkk = { bsi: 0, resultat: 0, lanceringer: 0, bedsteTotal40: 0, startKunder: spillerKunderTotal(s), startBsi: 0 };
  if (s.investorer.runde !== 'ingen' && s.investorer.pres >= PRES_EVENT_TAERSKEL) {
    udloesEvent(s, 'investorPres', {});
  }
  if (opfyldt === ialt && ialt > 0) nyhed(s, `Kvartalsmødet: alle ${ialt} mål nået. ${RUNDE_NAVN[s.investorer.runde as FundingRound] ?? ''}`.trim(), 'firma');
}
