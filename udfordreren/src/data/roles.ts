// Roller, deres faseeffektivitet og rolleskift (spec 6.5). Alle tal er [D].
import type { Phase, Role, StatKey, Vertical } from '../sim/types';

export type RoleDef = {
  id: Role;
  navn: string;
  kort: string;
  primaer: StatKey;
  sekundaer: StatKey[];
  /** Multiplikator på point i hver fase */
  fase: Record<Phase, number>;
  /** Multiplikator på design/koncept-point pr. vertikal */
  vertikal: Record<Vertical, number>;
  /** Ugentlig basisløn på niveau 1 (mio. kr.) */
  basisLoen: number;
  fraAar: number;
  farve: string;
  passiv: string;
};

export const ROLES: Record<Role, RoleDef> = {
  oddssaetter: {
    id: 'oddssaetter', navn: 'Oddssætter', kort: 'Odds', primaer: 'matematik', sekundaer: ['kreativitet', 'ansvar'],
    fase: { koncept: 0.9, design: 1.25, teknik: 0.8, test: 0.95 }, vertikal: { betting: 1.25, kasino: 0.85 },
    basisLoen: 0.011, fraAar: 2012, farve: '#3fa7d6', passiv: 'Skarpere odds: +2 % betting-BSI pr. oddssætter (maks 10 %).',
  },
  udvikler: {
    id: 'udvikler', navn: 'Udvikler', kort: 'Dev', primaer: 'teknik', sekundaer: ['matematik', 'udholdenhed'],
    fase: { koncept: 0.7, design: 0.8, teknik: 1.35, test: 1.1 }, vertikal: { betting: 1, kasino: 1 },
    basisLoen: 0.012, fraAar: 2012, farve: '#5cc98a', passiv: 'Færre nedbrud: −5 % fejl i nye projekter pr. udvikler (maks 25 %).',
  },
  kasinodesigner: {
    id: 'kasinodesigner', navn: 'Kasinodesigner', kort: 'Kasino', primaer: 'kreativitet', sekundaer: ['matematik', 'teknik'],
    fase: { koncept: 1.2, design: 1.25, teknik: 0.8, test: 0.8 }, vertikal: { betting: 0.85, kasino: 1.25 },
    basisLoen: 0.011, fraAar: 2012, farve: '#e8a33d', passiv: 'Bedre lobby: +2 % kasino-BSI pr. kasinodesigner (maks 10 %).',
  },
  marketing: {
    id: 'marketing', navn: 'Marketing', kort: 'Mkt', primaer: 'salg', sekundaer: ['kreativitet', 'ansvar'],
    fase: { koncept: 1.1, design: 0.9, teknik: 0.5, test: 0.7 }, vertikal: { betting: 1, kasino: 1 },
    basisLoen: 0.01, fraAar: 2012, farve: '#d65ca8', passiv: 'Billigere kunder: −4 % CAC pr. marketingfolk (maks 20 %).',
  },
  compliance: {
    id: 'compliance', navn: 'Compliance', kort: 'Comp', primaer: 'ansvar', sekundaer: ['teknik', 'matematik'],
    fase: { koncept: 0.6, design: 0.8, teknik: 0.7, test: 1.3 }, vertikal: { betting: 1, kasino: 1 },
    basisLoen: 0.012, fraAar: 2012, farve: '#8a8fd6', passiv: 'Tilsynstillid +0,8 pr. kvartal pr. compliance-medarbejder (maks +3).',
  },
  analytiker: {
    id: 'analytiker', navn: 'Analytiker', kort: 'Data', primaer: 'matematik', sekundaer: ['teknik', 'ansvar'],
    fase: { koncept: 0.9, design: 1.1, teknik: 1.0, test: 1.0 }, vertikal: { betting: 1.05, kasino: 1.05 },
    basisLoen: 0.011, fraAar: 2012, farve: '#4ec2c2', passiv: '+1 indsigt pr. måned pr. analytiker.',
  },
  kundeservice: {
    id: 'kundeservice', navn: 'Kundeservice', kort: 'Service', primaer: 'ansvar', sekundaer: ['salg', 'udholdenhed'],
    fase: { koncept: 0.6, design: 0.6, teknik: 0.5, test: 1.1 }, vertikal: { betting: 1, kasino: 1 },
    basisLoen: 0.008, fraAar: 2012, farve: '#c9c35c', passiv: 'Gladere kunder: −3 % churn pr. kundeservicefolk (maks 15 %).',
  },
  aiIngenioer: {
    id: 'aiIngenioer', navn: 'AI-ingeniør', kort: 'AI', primaer: 'teknik', sekundaer: ['matematik', 'kreativitet'],
    fase: { koncept: 1.0, design: 1.1, teknik: 1.45, test: 1.2 }, vertikal: { betting: 1.1, kasino: 1.1 },
    basisLoen: 0.02, fraAar: 2026, farve: '#7cf0ff', passiv: 'Driver AI-agenterne (fra 2026).',
  },
};

export const ROLE_IDS = Object.keys(ROLES) as Role[];

/** Rolleskift ("job change") [D]. CRM-specialist er marketing med specialisering. */
export type RoleChange = { fra: Role; til: Role; niveau: number; fraAar: number; specialisering?: 'crm'; navn: string; tekst: string };
export const ROLE_CHANGES: RoleChange[] = [
  { fra: 'udvikler', til: 'aiIngenioer', niveau: 5, fraAar: 2026, navn: 'AI-ingeniør', tekst: 'Teknik bevares, og AI-agenter kan drives.' },
  { fra: 'analytiker', til: 'oddssaetter', niveau: 4, fraAar: 2012, navn: 'Oddssætter', tekst: 'Matematikken flytter over i odds.' },
  { fra: 'kundeservice', til: 'compliance', niveau: 4, fraAar: 2012, navn: 'Compliance', tekst: 'Kendskab til kunderne bliver til ansvarligt spil.' },
  { fra: 'marketing', til: 'marketing', niveau: 5, fraAar: 2012, specialisering: 'crm', navn: 'CRM-specialist', tekst: '+8 salg, +6 ansvar og lavere churn.' },
];

/** Hvor mange af de primære/sekundære stats stiger pr. niveau */
export const NIVEAU_VAEKST = { primaer: [3, 5] as const, sekundaer: [1, 3] as const, oevrige: [0, 1] as const };
/** xp til næste niveau: 80 + 60·(niveau−1) [D] */
export const xpTilNaeste = (niveau: number): number => 80 + 60 * (niveau - 1);
export const MAX_NIVEAU = 10;
/** Lønstigning pr. niveau [D] */
export const LOEN_PR_NIVEAU = 0.08;
