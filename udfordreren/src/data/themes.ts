// Temaer. Årstal for tilgængelighed og sæsonbonus er [D].
import type { ThemeId } from '../sim/types';

export type ThemeDef = {
  id: ThemeId;
  navn: string;
  fraAar: number;
  sport: boolean;
  /** Sæsonbonus (0-baseret kvartal), fx jul i Q4 [D] */
  saesonKvartal?: number;
  farve: string;
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  fodbold: { id: 'fodbold', navn: 'Fodbold', fraAar: 2012, sport: true, farve: '#3c9d4e' },
  haandbold: { id: 'haandbold', navn: 'Håndbold', fraAar: 2012, sport: true, farve: '#d9534f' },
  tennis: { id: 'tennis', navn: 'Tennis', fraAar: 2012, sport: true, farve: '#c8d64b' },
  esport: { id: 'esport', navn: 'Esport', fraAar: 2014, sport: true, farve: '#8e5cd9' },
  formel: { id: 'formel', navn: 'Formel-løb', fraAar: 2012, sport: true, farve: '#e05a2b' },
  eventyr: { id: 'eventyr', navn: 'Eventyr', fraAar: 2012, sport: false, farve: '#6f8bd6' },
  nordisk: { id: 'nordisk', navn: 'Nordisk', fraAar: 2012, sport: false, farve: '#7fb6c9' },
  retro: { id: 'retro', navn: 'Retro', fraAar: 2012, sport: false, farve: '#d66fa6' },
  jul: { id: 'jul', navn: 'Jul', fraAar: 2012, sport: false, saesonKvartal: 3, farve: '#c23b3b' },
  rigdom: { id: 'rigdom', navn: 'Rigdom', fraAar: 2012, sport: false, farve: '#e6c23d' },
  popkultur: { id: 'popkultur', navn: 'Popkultur', fraAar: 2013, sport: false, farve: '#e86fd0' },
  natur: { id: 'natur', navn: 'Natur', fraAar: 2012, sport: false, farve: '#5fa85a' },
  mytologi: { id: 'mytologi', navn: 'Mytologi', fraAar: 2012, sport: false, farve: '#b08a4e' },
  'sci-fi': { id: 'sci-fi', navn: 'Sci-fi', fraAar: 2015, sport: false, farve: '#4ed6c8' },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
