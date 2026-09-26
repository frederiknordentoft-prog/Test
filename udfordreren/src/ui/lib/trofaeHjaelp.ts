// Trofæhylden i kontoret: rene hjælpere til den lille oversigt (gallapriser, Guldkuponer, Hall of Fame og licenser).
import type { GameState, LicenseStatus, MarketId } from '../../sim/types';
import { GALA_CATEGORIES } from '../../data/galaCategories';
import { MARKETS } from '../../data/markets';

export type LicensLinje = { marked: MarketId; navn: string; farver: readonly string[]; status: Exclude<LicenseStatus, 'ingen'> };
export type ProduktLinje = { id: string; navn: string; total40: number };

export type TrofaeOversigt = {
  /** Kort, venlig opsummering øverst */
  tekst: string;
  priser: { aar: number; navne: string[] }[];
  priserIalt: number;
  /** De nyeste Guldkuponer (højst 6) */
  kuponer: ProduktLinje[];
  kuponerIalt: number;
  hof: ProduktLinje[];
  licenser: LicensLinje[];
};

const MAX_KUPONER = 6;

export function trofaeOversigt(g: GameState): TrofaeOversigt {
  const kategoriNavn = (id: string) => GALA_CATEGORIES.find((c) => c.id === id)?.navn ?? id;
  const priser = g.galla.filter((r) => r.vundet.length > 0).map((r) => ({ aar: r.aar, navne: r.vundet.map(kategoriNavn) })).reverse();
  const priserIalt = priser.reduce((a, p) => a + p.navne.length, 0);
  const egne = g.produkter.filter((p) => p.ejer === 'spiller');
  const linje = (p: (typeof egne)[number]): ProduktLinje => ({ id: p.id, navn: p.navn, total40: p.total40 });
  const alleKuponer = egne.filter((p) => p.guldkupon).sort((a, b) => b.lanceretUge - a.lanceretUge);
  const hof = egne.filter((p) => p.hallOfFame).sort((a, b) => b.total40 - a.total40).map(linje);
  const licenser: LicensLinje[] = [];
  for (const m of Object.keys(g.markeder) as MarketId[]) {
    const status = g.markeder[m].licens;
    if (status === 'ingen') continue;
    licenser.push({ marked: m, navn: MARKETS[m]?.navn ?? m, farver: MARKETS[m]?.farver ?? [], status });
  }
  const aktive = licenser.filter((l) => l.status === 'aktiv').length;
  const ialt = priserIalt + alleKuponer.length + hof.length;
  const tekst =
    ialt === 0
      ? 'Hylden er tom — endnu. Her ender gallapriser, Guldkuponer og Hall of Fame, og licenserne hænger på væggen.'
      : `${ialt} ${ialt === 1 ? 'trofæ' : 'trofæer'} og ${aktive} ${aktive === 1 ? 'aktiv licens' : 'aktive licenser'}. Støvkluden er fundet frem.`;
  return { tekst, priser, priserIalt, kuponer: alleKuponer.slice(0, MAX_KUPONER).map(linje), kuponerIalt: alleKuponer.length, hof, licenser };
}
