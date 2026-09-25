// Rene hjælpere til shell-sporet (titel, gem/indlæs, slutskærm, mentor). Ingen React.
import type { GameState, LiveProduct, NewsItem } from '../../sim/types';
import { spillerKunderTotal, kanalTilgaengelig } from '../../sim/customers';
import { lanceringsStatus } from '../../sim/projects';
import { UGER_PR_AAR } from '../../sim/time';
import { naesteRunde } from '../../sim/investors';
import { kontorKrav, naesteKontor } from '../../sim/office';
import { opgaverFor, pladser } from '../../sim/staff';
import { CHANNEL_IDS } from '../../data/acquisition';
import { KONKURS_UGER } from '../../data/costs';
import { FASE_NAVN } from './devHjaelp';
import { kassenRaekker } from './firmaHjaelp';

/** Hent en fil i browseren (data-URL + a[download]) */
export function hentFil(filnavn: string, indhold: string, type = 'application/json'): void {
  const a = document.createElement('a');
  a.href = `data:${type};charset=utf-8,${encodeURIComponent(indhold)}`;
  a.download = filnavn;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slug(tekst: string): string {
  return (
    tekst
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'spil'
  );
}

/** "i dag 14:05", "i går 09:12" eller "3. feb. 14:05" */
export function gemtTekst(ms: number, nu = Date.now()): string {
  const d = new Date(ms);
  const tid = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const idag = new Date(nu);
  const samme = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (samme(d, idag)) return `i dag ${tid}`;
  const igaar = new Date(nu - 86400000);
  if (samme(d, igaar)) return `i går ${tid}`;
  const mdr = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];
  return `${d.getDate()}. ${mdr[d.getMonth()]} ${d.getFullYear() !== idag.getFullYear() ? d.getFullYear() + ' ' : ''}${tid}`;
}

export type Opsummering = {
  aar: number;
  uger: number;
  lanceringer: number;
  bedste40: number;
  bedsteProdukt: LiveProduct | null;
  guldkuponer: number;
  hallOfFame: number;
  gallapriser: number;
  topKunder: number;
  bedstePlaceringDk: number | null;
  kapital: number;
  vaerdi: number;
};

export function opsummering(s: GameState): Opsummering {
  const mine = s.produkter.filter((p) => p.ejer === 'spiller');
  const bedsteProdukt = mine.reduce<LiveProduct | null>((b, p) => (!b || p.total40 > b.total40 ? p : b), null);
  const placeringer = mine.map((p) => p.bedstePlacering.dk).filter((x): x is number => typeof x === 'number');
  return {
    aar: Math.floor(s.uge / UGER_PR_AAR),
    uger: s.uge % UGER_PR_AAR,
    lanceringer: mine.length,
    bedste40: bedsteProdukt?.total40 ?? 0,
    bedsteProdukt,
    guldkuponer: mine.filter((p) => p.guldkupon).length,
    hallOfFame: mine.filter((p) => p.hallOfFame).length,
    gallapriser: s.galla.reduce((a, g) => a + g.vundet.length, 0),
    topKunder: Math.max(spillerKunderTotal(s), ...s.historik.map((h) => h.kunder), 0),
    bedstePlaceringDk: placeringer.length ? Math.min(...placeringer) : null,
    kapital: s.kapital,
    vaerdi: s.slut?.vaerdi ?? s.investorer.vaerdiansaettelse,
  };
}

export function varighedTekst(aar: number, uger: number): string {
  const a = aar === 1 ? '1 år' : `${aar} år`;
  const u = uger === 1 ? '1 uge' : `${uger} uger`;
  if (aar === 0) return u;
  if (uger === 0) return a;
  return `${a} og ${u}`;
}

export type MentorTrin =
  | { trin: 1; licensUger: number }
  | { trin: 2; del: 'start'; optaget: AlleOptaget | null }
  | { trin: 2; del: 'faser'; projectId: string; tomFase: boolean; faseNavn: string; optaget: AlleOptaget | null }
  | { trin: 3; projectId: string; kanLancere: boolean; grund?: string };

/** "Mads", "Mads og Sofie", "Mads, Sofie og Ali" */
export function navneListe(navne: readonly string[]): string {
  if (navne.length <= 1) return navne[0] ?? '';
  return `${navne.slice(0, -1).join(', ')} og ${navne[navne.length - 1]}`;
}

export type AlleOptaget = { navne: string; uger: number };

/** Er hele holdet bundet på kontraktopgaver? Så står et nyt projekt stille, til den første er tilbage. */
export function alleOptaget(s: GameState): AlleOptaget | null {
  if (s.staff.length === 0) return null;
  const rest = new Map<string, number>();
  for (const c of s.kontraktopgaver) for (const id of c.staff) rest.set(id, Math.max(rest.get(id) ?? 0, c.resterendeUger));
  if (!s.staff.every((m) => rest.has(m.id))) return null;
  return { navne: navneListe(s.staff.map((m) => m.navn.split(' ')[0])), uger: Math.max(1, Math.min(...rest.values())) };
}


/** Mentorens trin ud fra spillets tilstand (spec 6.1) */
export function mentorTrin(s: GameState): MentorTrin {
  const klar = s.projekter.find((p) => p.klar);
  if (klar) {
    const st = lanceringsStatus(s, klar);
    return { trin: 3, projectId: klar.id, kanLancere: st.ok, grund: st.grund };
  }
  const p = s.projekter[0];
  const optaget = alleOptaget(s);
  if (p) return { trin: 2, del: 'faser', projectId: p.id, tomFase: p.faseTildeling[p.fase].length === 0, faseNavn: FASE_NAVN[p.fase] ?? p.fase, optaget };
  if (s.milepaele.foersteKontrakt !== undefined || s.kontraktopgaver.length > 0) return { trin: 2, del: 'start', optaget };
  const lic = s.markeder.dk.vertikaler[s.startVertikal];
  return { trin: 1, licensUger: lic.status === 'aktiv' ? 0 : Math.max(0, (lic.klarUge ?? 0) - s.uge) };
}

/** Uger til licensen er klar (0 = klar) */
export function licensUgerTilbage(s: GameState): number {
  const lic = s.markeder.dk.vertikaler[s.startVertikal];
  if (lic.status === 'aktiv') return 0;
  return Math.max(0, (lic.klarUge ?? 0) - s.uge);
}

// ---------- Knuds råd efter tutorialen ----------

/** Giver det mening at flytte nu? Kravene er opfyldt, kontoret er fuldt, og der er penge til overs efter flytningen. */
export function kontorKlar(s: GameState): boolean {
  const n = naesteKontor(s);
  if (!n || !kontorKrav(s).ok) return false;
  return s.staff.length >= pladser(s) && s.kapital >= n.pris * 1.5 + 0.3;
}

export type KnudMaal = 'kontrakter' | 'marked' | 'firma' | 'nytProdukt';
export type KnudTip = { id: string; titel: string; tekst: string; knap: string; maal: KnudMaal };

/** Et kort råd fra mentoren ud fra spillets tilstand (vigtigste først). null = intet at sige lige nu. */
export function knudTip(s: GameState): KnudTip | null {
  if (s.slut) return null;
  // negativUger nulstilles først ved næste step: efter en runde er kassen positiv igen med det samme
  if (s.negativUger > 0 && s.kapital < 0) {
    return {
      id: 'minus',
      titel: `Kassen er i minus — ${s.negativUger}/${KONKURS_UGER} uger`,
      tekst: `Efter ${KONKURS_UGER} uger i træk i minus lukker banken for jer. Tag en kontraktopgave, skru ned for marketing — eller rejs en runde under Firma.`,
      knap: 'Vis opgaver',
      maal: 'kontrakter',
    };
  }
  const kasse = kassenRaekker(s);
  if (kasse && kasse.uger < 12) {
    return {
      id: 'kasse',
      titel: `Kassen rækker kun ~${kasse.uger} uger`,
      tekst: 'Der går flere penge ud, end der kommer ind. Kontraktopgaver giver hurtige penge; marketing på jeres produkter giver kunder og BSI på sigt.',
      knap: 'Vis opgaver',
      maal: 'kontrakter',
    };
  }
  const opg = opgaverFor(s);
  const ledige = s.staff.filter((m) => opg[m.id]?.type === 'ledig');
  if (ledige.length > 0 && !s.projekter.some((p) => !p.klar)) {
    return {
      id: 'ledige',
      titel: `${navneListe(ledige.slice(0, 3).map((m) => m.navn.split(' ')[0]))}${ledige.length > 3 ? ' m.fl.' : ''} har ikke noget at lave`,
      tekst: 'Start et nyt produkt — eller tag en kontraktopgave, mens I tænker over det næste.',
      knap: 'Nyt produkt',
      maal: 'nytProdukt',
    };
  }
  if (naesteRunde(s).ok) {
    return {
      id: `runde-${s.investorer.runde}`,
      titel: 'Investorerne banker på!',
      tekst: 'I opfylder kravene til næste investeringsrunde. Rejs den under Firma, og få luft i kassen.',
      knap: 'Til Firma',
      maal: 'firma',
    };
  }
  const naeste = naesteKontor(s);
  if (naeste && kontorKlar(s)) {
    return {
      id: `kontor-${s.kontor}`,
      titel: 'Tid til at flytte?',
      tekst: `I har råd til ${naeste.navn.toLowerCase()} med plads til ${naeste.pladser}. Flere pladser giver flere folk og flere projekter ad gangen.`,
      knap: 'Til Firma',
      maal: 'firma',
    };
  }
  const harProdukt = s.produkter.some((p) => p.ejer === 'spiller' && p.aktiv);
  const marketing = CHANNEL_IDS.reduce((a, k) => a + (kanalTilgaengelig(s, k) ? (s.marketingMix[k] ?? 0) : 0), 0);
  if (harProdukt && marketing <= 0 && s.markeder.dk.licens === 'aktiv') {
    return {
      id: 'marketing',
      titel: 'Sådan får I flere kunder',
      tekst: 'Et godt produkt trækker nogle kunder af sig selv, men marketing køber flere: hver kanal har en pris pr. ny kunde (CAC). Start småt under Marked, og hold øje med "≈ kunder/uge".',
      knap: 'Til Marked',
      maal: 'marked',
    };
  }
  return null;
}

/** Nyheder, der må vises nu: mens en dialog er åben (anmeldelse, galla …), holdes ugens nyheder tilbage,
 *  så tickeren ikke røber scoren eller vinderen, før dialogen har afsløret dem. */
export function synligeNyheder(nyheder: readonly NewsItem[] | undefined, uge: number, dialogAaben: boolean): NewsItem[] {
  const alle = Array.isArray(nyheder) ? nyheder : [];
  return dialogAaben ? alle.filter((n) => n.uge < uge) : [...alle];
}
