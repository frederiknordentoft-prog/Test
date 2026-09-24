// Branchegallaen i december (spec 6.15). Belønninger er [D].
export type GalaCategory = { id: string; navn: string; beskrivelse: string };

export const GALA_CATEGORIES: GalaCategory[] = [
  { id: 'produkt', navn: 'Årets produkt', beskrivelse: 'Højeste anmeldelse blandt årets lanceringer i Danmark.' },
  { id: 'innovation', navn: 'Årets innovation', beskrivelse: 'Nye kombinationer, nye features og originalitet.' },
  { id: 'ansvarlig', navn: 'Årets ansvarlige operatør', beskrivelse: 'Høj gennemsnitlig tilsynstillid og tryghed.' },
  { id: 'udfordrer', navn: 'Årets udfordrer', beskrivelse: 'Stærkest kundevækst blandt de private aktører.' },
  { id: 'platform', navn: 'Årets platform', beskrivelse: 'Bedste platformkvalitet i branchen.' },
];

export const GALA_UGE_I_AAR = 50; // [D] midt i december
export const GALA_BELOENNING = { hype: 10, indsigt: 8, omdoemme: 3, vaerdiLoeft: 0.03 };
