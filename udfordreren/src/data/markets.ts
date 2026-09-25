// Markeder som konsolkort (spec 7.2). Uge-tal regnes fra uge 0 = jan. 2012.
// [F] = fakta, [A] = afledt, [D] = designestimat.
import type { MarketId, Vertical } from '../sim/types';
import { ugeFor } from '../sim/time';

export type MarketDef = {
  id: MarketId;
  navn: string;
  kort: string;
  tilsyn: string;
  /** Uge hvor markedet åbner for licenser; null = lukket */
  aabnerUge: number | null;
  afgiftModel: 'bsi' | 'indsats';
  /** Afgift pr. vertikal som trin [uge, sats] */
  afgift: Record<Vertical, [number, number][]>;
  /** Strenghed 0-5 som trin [uge, niveau] */
  strenghed: [number, number][];
  kanaliseringMaal: number;
  cacFaktor: number;
  licensGebyr: number; // mio. kr.
  licensUger: number;
  /** ARPU pr. aktiv kunde pr. år i kr. [D] */
  arpu: Record<Vertical, number>;
  /** Basis-offshoreandel før formlen i 7.8 (fase 3) [D] */
  basisOffshore: Record<Vertical, number>;
  farver: [string, string, string];
  beskrivelse: string;
  /** Kun monopolmarkeder, der kan åbne i et verdensscenarie (Norge) */
  beskrivelseAaben?: string;
};

export const MARKETS: Record<MarketId, MarketDef> = {
  dk: {
    id: 'dk', navn: 'Danmark', kort: 'DK', tilsyn: 'Spillemyndigheden', aabnerUge: 0, afgiftModel: 'bsi',
    afgift: {
      betting: [[0, 0.2], [ugeFor(2021, 0), 0.28]], // [F] 20 % → 28 % (2021-01)
      kasino: [[0, 0.2], [ugeFor(2021, 0), 0.28]],
    },
    strenghed: [[0, 2], [ugeFor(2021, 0), 3], [ugeFor(2026, 6), 4], [ugeFor(2027, 0), 4.2]], // [F] Spilpakke 1: 2026-07, dele 2027-01
    kanaliseringMaal: 0.9, cacFaktor: 1.0, licensGebyr: 0.5, licensUger: 12, // [D] gebyr/tid
    arpu: { betting: 2500, kasino: 7000 }, // [D]
    basisOffshore: { betting: 0.04, kasino: 0.13 }, // [D] kalibreret til ~9 % samlet [F: 91,5 % kanalisering 2024]
    farver: ['#c8102e', '#ffffff', '#c8102e'],
    beskrivelse: 'Liberaliseret 1. januar 2012. Lotteri forbliver statsmonopol.',
  },
  uk: {
    id: 'uk', navn: 'Storbritannien', kort: 'UK', tilsyn: 'UKGC', aabnerUge: 0, afgiftModel: 'bsi',
    afgift: {
      kasino: [[0, 0.15], [ugeFor(2019, 3), 0.21], [ugeFor(2026, 3), 0.4]], // [F/A] RGD 15 % (2014) → 21 % (2019) → 40 % (2026-04)
      betting: [[0, 0.15], [ugeFor(2027, 3), 0.25]], // [F/A] fjern-betting 15 % → 25 % (2027-04)
    },
    strenghed: [[0, 2], [ugeFor(2019, 3), 3], [ugeFor(2025, 3), 4], [ugeFor(2026, 3), 4.5]], // [F]
    kanaliseringMaal: 0.95, cacFaktor: 1.6, licensGebyr: 1.5, licensUger: 26,
    arpu: { betting: 2200, kasino: 6000 },
    basisOffshore: { betting: 0.02, kasino: 0.07 },
    farver: ['#012169', '#ffffff', '#c8102e'],
    beskrivelse: 'Europas største marked. Afgiften på fjernspil stiger kraftigt i 2026.',
  },
  se: {
    id: 'se', navn: 'Sverige', kort: 'SE', tilsyn: 'Spelinspektionen', aabnerUge: ugeFor(2019, 0), afgiftModel: 'bsi',
    afgift: {
      betting: [[0, 0.18], [ugeFor(2024, 6), 0.22]], // [F] 18 % → 22 % (2024-07)
      kasino: [[0, 0.18], [ugeFor(2024, 6), 0.22]],
    },
    strenghed: [[0, 3], [ugeFor(2026, 0), 3.5]], // [F] kreditforbud 2026
    kanaliseringMaal: 0.9, cacFaktor: 1.2, licensGebyr: 0.8, licensUger: 20,
    arpu: { betting: 2400, kasino: 6500 },
    basisOffshore: { betting: 0.03, kasino: 0.17 }, // [F] betting 96 %, kasino 81 %
    farver: ['#006aa7', '#fecc00', '#006aa7'],
    beskrivelse: 'Åbnede i 2019. Kasino lækker markant mere til offshore end betting.',
  },
  de: {
    id: 'de', navn: 'Tyskland', kort: 'DE', tilsyn: 'GGL', aabnerUge: ugeFor(2021, 6), afgiftModel: 'indsats',
    afgift: {
      betting: [[0, 0.053]], // [F] 5,3 % af indsats
      kasino: [[0, 0.053]],
    },
    strenghed: [[0, 5]], // [F] €1.000/md., €1/spin, 5-sek.-pause
    kanaliseringMaal: 0.8, cacFaktor: 1.3, licensGebyr: 2, licensUger: 40,
    arpu: { betting: 2500, kasino: 5000 },
    basisOffshore: { betting: 0.08, kasino: 0.3 },
    farver: ['#000000', '#dd0000', '#ffce00'],
    beskrivelse: 'Indsatsafgift på 5,3 % og månedsgrænse på €1.000. Kasino giver dårlig BSI.',
  },
  nl: {
    id: 'nl', navn: 'Holland', kort: 'NL', tilsyn: 'Ksa', aabnerUge: ugeFor(2021, 9), afgiftModel: 'bsi',
    afgift: {
      betting: [[0, 0.29], [ugeFor(2024, 0), 0.305], [ugeFor(2025, 0), 0.342], [ugeFor(2026, 0), 0.378]], // [F]
      kasino: [[0, 0.29], [ugeFor(2024, 0), 0.305], [ugeFor(2025, 0), 0.342], [ugeFor(2026, 0), 0.378]],
    },
    strenghed: [[0, 3], [ugeFor(2023, 6), 4], [ugeFor(2024, 9), 4.5]], // [F] reklameforbud 2023, grænser 2024-10
    kanaliseringMaal: 0.8, cacFaktor: 1.4, licensGebyr: 1.5, licensUger: 30,
    arpu: { betting: 2500, kasino: 7000 },
    basisOffshore: { betting: 0.2, kasino: 0.45 },
    farver: ['#ae1c28', '#ffffff', '#21468b'],
    beskrivelse: 'Åbnede i oktober 2021. Europas højeste afgift fra 2026.',
  },
  on: {
    id: 'on', navn: 'Ontario', kort: 'ON', tilsyn: 'AGCO', aabnerUge: ugeFor(2022, 3), afgiftModel: 'bsi',
    afgift: { betting: [[0, 0.2]], kasino: [[0, 0.2]] }, // [F] 20 %
    strenghed: [[0, 2.5]], // [D]
    kanaliseringMaal: 0.86, cacFaktor: 1.5, licensGebyr: 1, licensUger: 26,
    arpu: { betting: 3000, kasino: 8000 },
    basisOffshore: { betting: 0.06, kasino: 0.16 },
    farver: ['#d52b1e', '#ffffff', '#d52b1e'],
    beskrivelse: 'Åben model med 20 % til provinsen.',
  },
  us: {
    id: 'us', navn: 'USA', kort: 'US', tilsyn: 'Delstaternes tilsyn', aabnerUge: ugeFor(2018, 5), afgiftModel: 'bsi',
    afgift: {
      betting: [[0, 0.15], [ugeFor(2025, 6), 0.2], [ugeFor(2026, 0), 0.25]], // [F/A] gennemsnit 15 % → 25 %; NY 51 %
      kasino: [[0, 0.15], [ugeFor(2025, 6), 0.2], [ugeFor(2026, 0), 0.25]],
    },
    strenghed: [[0, 2], [ugeFor(2025, 0), 3]], // [D]
    kanaliseringMaal: 0.8, cacFaktor: 3.0, licensGebyr: 5, licensUger: 40,
    arpu: { betting: 3500, kasino: 9000 },
    basisOffshore: { betting: 0.15, kasino: 0.3 },
    farver: ['#3c3b6e', '#ffffff', '#b22234'],
    beskrivelse: 'Delstater åbner i bølger. Duopol og høje afgifter.',
  },
  fi: {
    id: 'fi', navn: 'Finland', kort: 'FI', tilsyn: 'Lupa- ja valvontavirasto', aabnerUge: ugeFor(2027, 6), afgiftModel: 'bsi',
    afgift: { betting: [[0, 0.22]], kasino: [[0, 0.22]] }, // [F] 22 %
    strenghed: [[0, 3.5]], // [F] nationalt register, affiliate-forbud
    kanaliseringMaal: 0.9, cacFaktor: 1.1, licensGebyr: 0.2, licensUger: 26, // [F/A] €29.000
    arpu: { betting: 2200, kasino: 6000 },
    basisOffshore: { betting: 0.2, kasino: 0.5 },
    farver: ['#ffffff', '#002f6c', '#ffffff'],
    beskrivelse: 'Åbner 1. juli 2027 med 22 % og forbud mod affiliate.',
  },
  no: {
    id: 'no', navn: 'Norge', kort: 'NO', tilsyn: 'Lotteritilsynet', aabnerUge: null, afgiftModel: 'bsi',
    // Tallene gælder først, hvis monopolet afskaffes (verdensvurderingen "Norge åbner", 25 %) [D: nordisk licensregime som i se/dk]
    afgift: { betting: [[0, 0.22]], kasino: [[0, 0.22]] },
    strenghed: [[0, 4]], // [F] betalingsblokering 2010, DNS 2025; [D] strengt nyt regime efter en åbning
    kanaliseringMaal: 0.9, cacFaktor: 1.2, licensGebyr: 1.2, licensUger: 26,
    arpu: { betting: 2500, kasino: 7000 },
    basisOffshore: { betting: 1, kasino: 1 },
    farver: ['#ba0c2f', '#ffffff', '#00205b'],
    beskrivelse: 'Monopol. Kan kun spilles gråt via et offshore-brand.',
    beskrivelseAaben: 'Monopolet er afskaffet. Spillet er i årevis foregået på udenlandske sider; nu kan det hentes hjem med en licens. Reglerne er nye, og tilsynet er strengt.',
  },
};

export const MARKET_IDS = Object.keys(MARKETS) as MarketId[];
