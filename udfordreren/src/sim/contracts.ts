// Kontraktopgaver (spec 6.6): 2-3 tilbud, der giver penge og indsigt, men binder folk i 2-6 uger.
import type { ContractOffer, GameState, Staff } from './types';
import type { Rng } from './rng';
import { CONTRACTS, KONTRAKT_EFTER_2016, KONTRAKT_TILBUD, KONTRAKT_ROLLE_BONUS } from '../data/contracts';
import { ROLES } from '../data/roles';
import { aarFor } from './time';
import { afvis, clamp, nyId, nyhed, signal } from './util';
import { forskningsEffekt } from './insight';
import { STANDARD_HOLD } from './projects';
import { PHASES } from './types';

export function lavTilbud(s: GameState, rng: Rng, efter2016: boolean): ContractOffer | null {
  const aar = aarFor(s.uge);
  const brugte = new Set(s.kontraktTilbud.map((t) => t.skabelonId));
  const mulige = CONTRACTS.filter((c) => c.fraAar <= aar && aar <= c.tilAar && !brugte.has(c.id));
  if (mulige.length === 0) return null;
  const t = rng.pick(mulige);
  const faktor = efter2016 ? KONTRAKT_EFTER_2016.betaling : 1;
  return {
    id: nyId(s, 'c'),
    skabelonId: t.id,
    navn: t.navn,
    kunde: rng.pick(t.kunder),
    rolle: t.rolle,
    stat: t.stat,
    uger: rng.int(t.uger[0], t.uger[1]),
    maxStaff: t.maxStaff,
    betaling: Math.round(rng.range(t.betaling[0], t.betaling[1]) * faktor * 1000) / 1000,
    indsigt: rng.int(t.indsigt[0], t.indsigt[1]),
    udloeberUge: s.uge + rng.int(KONTRAKT_TILBUD.levetid[0], KONTRAKT_TILBUD.levetid[1]),
  };
}

export function opfyldTilbud(s: GameState, rng: Rng): void {
  s.kontraktTilbud = s.kontraktTilbud.filter((t) => t.udloeberUge > s.uge);
  const efter2016 = aarFor(s.uge) >= 2016;
  const maal = efter2016 ? Math.min(KONTRAKT_EFTER_2016.antalMax, KONTRAKT_TILBUD.max) : KONTRAKT_TILBUD.max;
  let forsoeg = 0;
  while (s.kontraktTilbud.length < maal && forsoeg < 6) {
    forsoeg++;
    // Efter 2016 kommer der ikke nyt tilbud hver uge
    if (efter2016 && s.kontraktTilbud.length >= 1 && !rng.chance(0.35)) break;
    const t = lavTilbud(s, rng, efter2016);
    if (t) s.kontraktTilbud.push(t);
  }
}

/** Forventet betaling ud fra de valgte medarbejdere */
export function kontraktKvalitet(tilbud: ContractOffer, staff: Staff[]): number {
  if (staff.length === 0) return 0;
  const bedst = Math.max(...staff.map((m) => m.stats[tilbud.stat]));
  const rolle = staff.some((m) => m.rolle === tilbud.rolle) ? KONTRAKT_ROLLE_BONUS : 1;
  const ekstra = 1 + 0.35 * (staff.length - 1);
  return clamp((0.7 + bedst / 60) * rolle * ekstra, 0.5, 2.2);
}

export function takeContract(s: GameState, contractId: string, staffIds: string[]): boolean {
  const t = s.kontraktTilbud.find((x) => x.id === contractId);
  if (!t) return afvis(s, 'Opgaven er ikke længere tilgængelig.');
  const ids = [...new Set(staffIds)];
  if (ids.length === 0) return afvis(s, 'Vælg mindst én medarbejder.');
  if (ids.length > t.maxStaff) return afvis(s, `Opgaven kan højst bemandes med ${t.maxStaff}.`);
  const valgte = ids.map((id) => s.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
  if (valgte.length !== ids.length) return afvis(s, 'Ukendt medarbejder.');
  const iKontrakt = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
  if (valgte.some((m) => iKontrakt.has(m.id))) return afvis(s, 'Nogle af de valgte er allerede på en kontraktopgave.');
  // Tag dem ud af projekternes aktive fase
  for (const p of s.projekter) {
    if (p.klar) continue;
    p.faseTildeling[p.fase] = p.faseTildeling[p.fase].filter((id) => !ids.includes(id));
  }
  s.kontraktTilbud = s.kontraktTilbud.filter((x) => x.id !== contractId);
  s.kontraktopgaver.push({ id: t.id, resterendeUger: t.uger, staff: ids, tilbud: t });
  if (s.milepaele.foersteKontrakt === undefined) s.milepaele.foersteKontrakt = s.uge;
  return true;
}

/** Ugentlig fremdrift. Returnerer indtægten fra færdige opgaver og hvem der arbejdede. */
export function ugentligeKontrakter(s: GameState): { indtaegt: number; arbejdede: string[] } {
  let indtaegt = 0;
  const arbejdede: string[] = [];
  const faerdige: string[] = [];
  const eff = forskningsEffekt(s);
  for (const c of s.kontraktopgaver) {
    const staff = c.staff.map((id) => s.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
    if (staff.length === 0) {
      faerdige.push(c.id);
      nyhed(s, `Kontraktopgaven "${c.tilbud.navn}" blev opgivet — ingen til at lave den.`, 'firma');
      continue;
    }
    arbejdede.push(...staff.map((m) => m.id));
    c.resterendeUger -= 1;
    if (c.resterendeUger <= 0) {
      const q = kontraktKvalitet(c.tilbud, staff);
      const betaling = Math.round(c.tilbud.betaling * q * 1000) / 1000;
      const indsigt = Math.round(c.tilbud.indsigt * Math.min(1.5, q) * (1 + eff.indsigt));
      indtaegt += betaling;
      s.indsigt += indsigt;
      faerdige.push(c.id);
      signal(s, { k: 'kontraktFaerdig', contractId: c.id, navn: c.tilbud.navn, betaling, indsigt });
      nyhed(s, `Kontraktopgave leveret til ${c.tilbud.kunde}: +${Math.round(betaling * 1000)} t. kr. og ${indsigt} indsigt.`, 'firma');
    }
  }
  // Folk, der kommer hjem fra en opgave, hopper på det aktive projekt, hvis holdet har plads
  const hjemme = s.kontraktopgaver.filter((c) => faerdige.includes(c.id)).flatMap((c) => c.staff);
  s.kontraktopgaver = s.kontraktopgaver.filter((c) => !faerdige.includes(c.id));
  const stadigUde = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
  const projekt = s.projekter.find((p) => !p.klar);
  if (projekt) {
    for (const id of hjemme) {
      const m = s.staff.find((x) => x.id === id);
      if (!m || stadigUde.has(id) || m.energi < 30) continue;
      const iAndetProjekt = s.projekter.some((p) => p.id !== projekt.id && !p.klar && p.faseTildeling[p.fase].includes(id));
      if (iAndetProjekt) continue;
      let tilfoejet = false;
      for (const f of PHASES.slice(PHASES.indexOf(projekt.fase))) {
        const hold = projekt.faseTildeling[f];
        if (hold.length < STANDARD_HOLD && !hold.includes(id)) {
          hold.push(id);
          tilfoejet = true;
        }
      }
      if (tilfoejet) nyhed(s, `${m.navn} er tilbage fra opgaven og hjælper på ${projekt.navn}.`, 'firma');
    }
  }
  return { indtaegt, arbejdede };
}

export function rolleNavn(r: keyof typeof ROLES): string {
  return ROLES[r].navn;
}
