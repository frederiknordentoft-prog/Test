// De fire stiftere (spec 6.1). Stats er [D].
import type { Role, Stats } from '../sim/types';

export type FounderDef = { id: string; titel: string; navn: string; rolle: Role; stats: Stats; beskrivelse: string; udseende: number };

export const FOUNDERS: FounderDef[] = [
  {
    id: 'oddssaetteren', titel: 'Oddssætteren', navn: 'Mads Kragh', rolle: 'oddssaetter', udseende: 3,
    stats: { kreativitet: 16, teknik: 12, matematik: 30, salg: 10, ansvar: 16, udholdenhed: 20 },
    beskrivelse: 'Har lavet odds i baglokalet hos en bookmaker i ti år. Stærk i design af bettingprodukter.',
  },
  {
    id: 'udvikleren', titel: 'Udvikleren', navn: 'Sofie Lund', rolle: 'udvikler', udseende: 7,
    stats: { kreativitet: 14, teknik: 30, matematik: 16, salg: 6, ansvar: 12, udholdenhed: 22 },
    beskrivelse: 'Kan bygge en betalingsløsning på en weekend. Få fejl, stærk i teknikfasen.',
  },
  {
    id: 'kasinodesigneren', titel: 'Kasinodesigneren', navn: 'Jonas Friis', rolle: 'kasinodesigner', udseende: 11,
    stats: { kreativitet: 30, teknik: 14, matematik: 18, salg: 10, ansvar: 12, udholdenhed: 18 },
    beskrivelse: 'Tidligere spildesigner. Giver originale kasinoprodukter.',
  },
  {
    id: 'markedsfoereren', titel: 'Markedsføreren', navn: 'Amira Holm', rolle: 'marketing', udseende: 5,
    stats: { kreativitet: 20, teknik: 8, matematik: 10, salg: 30, ansvar: 14, udholdenhed: 20 },
    beskrivelse: 'Kender alle affiliates i branchen. Billigere kunder fra dag ét.',
  },
];

export const FOUNDER_LOEN = 0.008; // [D] mio. kr./uge ≈ 35.000 kr./md.
