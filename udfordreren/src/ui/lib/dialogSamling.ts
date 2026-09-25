// Dialog-tempo med mange markeder: samler ugens signaler, før de kommer i dialogkøen (kaldes af gameStore.behandl).
// - Top 10 og nr. 1: højst én fejring pr. produkt pr. uge (med en række pr. marked). Top 10 droppes, hvor produktet
//   samtidig er nr. 1. Kun første Top 10 nogensinde, produktets første nr. 1 og nr. 1/top 3 på hjemmemarkedet giver
//   en dialog — resten bliver én samlet toast pr. produkt.
// - Påbud/bonuskrig (R8/R1), sanktioner og regler af samme slags samles i én dialog med en række pr. marked.
// - En regel, der træder i kraft efter et varsel, er en nyhed og en toast — medmindre den ændrer jeres egne valg
//   (loft over bonus/VIP, lukker en kanal, I bruger, eller kræver en risikoagent, I ikke har).
// Rene funktioner: ingen store, ingen mutation.
import type { GameState, MarketId, Signal } from '../../sim/types';
import { aabnerDialog } from '../../sim/signals';
import { effektivBonus, effektivVip, regelEffekt } from '../../sim/selectors';
import { MARKETS } from '../../data/markets';
import { REGLER } from '../../data/regulationTimeline';

export type SamletDialog = { signal: Signal; gruppe?: Signal[] };
export type SamletToast = { tekst: string; kind: 'info' | 'godt' | 'skidt' };
export type Samling = {
  /** Dialoger i den rækkefølge, deres første signal kom i */
  dialoger: SamletDialog[];
  /** Samlede toasts (Top 10/nr. 1 uden dialog, regler i kraft efter varsel) */
  toasts: SamletToast[];
  /** Signaler, der er foldet ind i en toast: ingen egen toast og ingen auto-pause */
  stille: Set<Signal>;
};

/** "a, b og c" */
export function listeTekst(dele: string[]): string {
  if (dele.length <= 1) return dele[0] ?? '';
  return `${dele.slice(0, -1).join(', ')} og ${dele[dele.length - 1]}`;
}

/** Spillerens hjemmemarked (hvor fejringerne altid får en dialog) */
export function hjemmemarked(g: GameState): MarketId {
  return g.mode === 'usa2018' ? 'us' : 'dk';
}

type Milepael = Extract<Signal, { k: 'top10' | 'nr1' }>;
const erMilepael = (s: Signal): s is Milepael => s.k === 'top10' || s.k === 'nr1';
const placering = (s: Milepael) => (s.k === 'nr1' ? 1 : s.placering);

/** Sortér et produkts milepæle: hjemmemarkedet først, så nr. 1 før Top 10, så bedste placering */
export function sorterMilepaele(gruppe: Signal[], hjem: MarketId): Milepael[] {
  return gruppe.filter(erMilepael).sort((a, b) => {
    if ((a.marked === hjem) !== (b.marked === hjem)) return a.marked === hjem ? -1 : 1;
    if ((a.k === 'nr1') !== (b.k === 'nr1')) return a.k === 'nr1' ? -1 : 1;
    return placering(a) - placering(b);
  });
}

/** Ændrer reglen spillerens egne valg i markedet (fra før til nu)? Så får den en dialog, selv efter et varsel. */
export function regelRammerValg(foer: GameState, ny: GameState, m: MarketId, regelId: string): boolean {
  const r = REGLER[regelId];
  if (!r) return true;
  if (effektivBonus(ny, m) < effektivBonus(foer, m)) return true;
  if (effektivVip(ny, m) < effektivVip(foer, m)) return true;
  const lukketFoer = regelEffekt(foer, m).lukket;
  if (regelEffekt(ny, m).lukket.some((k) => !lukketFoer.includes(k) && (ny.marketingMix[k] ?? 0) > 0)) return true;
  if (r.effekt.kraeverRisikoAgent && !ny.agenter.some((a) => a.funktion === 'risiko')) return true;
  return false;
}

function milepaelToast(g: GameState, gruppe: Milepael[]): SamletToast {
  const navn = g.produkter.find((p) => p.id === gruppe[0].productId)?.navn ?? 'Jeres produkt';
  const nr1 = gruppe.filter((s) => s.k === 'nr1').map((s) => MARKETS[s.marked].kort);
  const top = gruppe.filter((s): s is Extract<Signal, { k: 'top10' }> => s.k === 'top10').map((s) => `${MARKETS[s.marked].kort} (nr. ${s.placering})`);
  const dele: string[] = [];
  if (nr1.length) dele.push(`nr. 1 i ${listeTekst(nr1)}`);
  if (top.length) dele.push(`${nr1.length ? 'Top 10' : 'ind på Top 10'} i ${listeTekst(top)}`);
  return { tekst: `${navn}: ${dele.join(' · ')}!`, kind: 'godt' };
}

/**
 * Saml ugens signaler til dialoger og toasts.
 * @param foer spillets tilstand før steppet/handlingen (null ved et nyt spil)
 * @param ny tilstanden efter
 */
export function samlSignaler(foer: GameState | null, ny: GameState, sig: readonly Signal[]): Samling {
  const stille = new Set<Signal>();
  const toasts: SamletToast[] = [];
  const hjem = hjemmemarked(ny);

  // --- Top 10 og nr. 1: pr. produkt ---
  const nr1 = new Set(sig.filter((s) => s.k === 'nr1').map((s) => `${(s as Milepael).productId}:${(s as Milepael).marked}`));
  const milepaele = sig.filter(erMilepael);
  for (const s of milepaele) if (s.k === 'top10' && nr1.has(`${s.productId}:${s.marked}`)) stille.add(s);
  const prProdukt = new Map<string, Milepael[]>();
  for (const s of milepaele) {
    if (stille.has(s)) continue;
    const l = prProdukt.get(s.productId) ?? [];
    l.push(s);
    prProdukt.set(s.productId, l);
  }
  /** Første signal i hver gruppe → gruppen (dialogen står der, hvor gruppen begyndte) */
  const grupper = new Map<Signal, Signal[]>();
  for (const [productId, l] of prProdukt) {
    const foerProdukt = foer?.produkter.find((p) => p.id === productId);
    const harVaeretNr1 = !!foerProdukt && Object.values(foerProdukt.bedstePlacering).some((x) => x === 1);
    const vigtig = l.some(
      (s) =>
        (s.k === 'top10' && s.foersteGang) ||
        (s.k === 'nr1' && !harVaeretNr1) ||
        (s.marked === hjem && (s.k === 'nr1' || s.placering <= 3)),
    );
    if (vigtig) {
      const sorteret = sorterMilepaele(l, hjem);
      grupper.set(l[0], sorteret);
      for (const s of l) if (s !== l[0]) stille.add(s);
    } else {
      toasts.push(milepaelToast(ny, sorterMilepaele(l, hjem)));
      for (const s of l) stille.add(s);
    }
  }

  // --- Regler i kraft efter et varsel: nyhed + toast (medmindre de ændrer jeres valg) ---
  for (const s of sig) {
    if (s.k !== 'regel' || s.varsel || !foer) continue;
    const varslet = foer.planlagteRegler.some((p) => p.marked === s.marked && p.regelId === s.regelId && p.annonceret);
    if (!varslet || regelRammerValg(foer, ny, s.marked, s.regelId)) continue;
    const pp = s.regelId === 'afgiftsstigning' && s.pp !== undefined ? ` (+${s.pp} pp)` : '';
    toasts.push({ tekst: `${MARKETS[s.marked].navn}: ${REGLER[s.regelId]?.navn ?? 'en ny regel'}${pp} gælder nu.`, kind: 'info' });
    stille.add(s);
  }

  // --- Påbud/bonuskrig, sanktioner og regler af samme slags: én dialog ---
  const noegle = (s: Signal): string | null => {
    if (!aabnerDialog(s) || stille.has(s)) return null;
    if (s.k === 'reaktion') return `reaktion:${s.regel}`;
    if (s.k === 'sanktion') return 'sanktion';
    if (s.k === 'regel') return `regel:${s.varsel ? 'varsel' : 'ikraft'}`;
    return null;
  };
  const foersteAf = new Map<string, Signal>();
  for (const s of sig) {
    const n = noegle(s);
    if (!n) continue;
    const f = foersteAf.get(n);
    if (!f) {
      foersteAf.set(n, s);
      grupper.set(s, [s]);
    } else {
      grupper.get(f)!.push(s);
      stille.add(s);
    }
  }
  // Sanktioner: den alvorligste først
  for (const [f, l] of grupper) {
    if (f.k === 'sanktion' && l.length > 1) l.sort((a, b) => (b.k === 'sanktion' ? b.trin : 0) - (a.k === 'sanktion' ? a.trin : 0));
  }

  const dialoger: SamletDialog[] = [];
  for (const s of sig) {
    if (!aabnerDialog(s) && !grupper.has(s)) continue;
    if (stille.has(s)) continue;
    const g = grupper.get(s);
    if (g && g.length > 1) dialoger.push({ signal: g[0], gruppe: g });
    else if (g) dialoger.push({ signal: g[0] });
    else dialoger.push({ signal: s });
  }
  return { dialoger, toasts, stille };
}
