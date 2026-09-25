// Historiske konkurrenttiltag (spec 7.5) med parodinavne. Aflyses pænt, hvis spilleren har ændret verden
// (fx selv har købt målet). Arkiv-id'er peger på Arkivet (fase 6).
import { ugeFor } from '../sim/time';

export type KonkurrentEventDef = {
  id: string;
  uge: number;
  tekst: string;
  arkivId?: string;
  /** Opkøb: `maal` bliver ejet af `ejer` (en konkurrent eller en ekstern aktør) */
  opkoeb?: { maal: string; ejer: string; ejerErStat?: boolean };
  flag?: string;
  presMarked?: { marked: 'dk' | 'se' | 'uk'; pres: number };
  /** Kræver at disse konkurrenter findes og ikke er ejet af spilleren */
  kraever?: string[];
};

export const KONKURRENT_EVENTS: KonkurrentEventDef[] = [
  { id: 'kombiUdskilles', uge: ugeFor(2014, 5), tekst: 'Kombi udskilles fra Unibit som B2B-sportsbookleverandør. Turnkey-sportsbooks kan nu købes.', arkivId: 'a16', flag: 'kombiB2B', kraever: ['unibit'] },
  { id: 'flitterStjerne', uge: ugeFor(2020, 4), tekst: 'Flitter og Stjernegruppen fusionerer til branchens største koncern.', arkivId: 'a15', kraever: ['flitter'] },
  { id: 'revoNetend', uge: ugeFor(2020, 11), tekst: 'Revo Live køber spilstudiet NetEnd og samler live-kasino og slots under ét tag.', arkivId: 'a15' },
  { id: 'mgnEntrain', uge: ugeFor(2021, 0), tekst: 'BetMGN\'s bud på Entrain bliver afvist.', kraever: ['entrain'] },
  { id: 'dqEntrain', uge: ugeFor(2021, 9), tekst: 'DraftQueens trækker sit bud på Entrain.', kraever: ['entrain'] },
  { id: 'hull777', uge: ugeFor(2022, 6), tekst: 'Konkurrenten 777 køber William Hull.', arkivId: 'a15', opkoeb: { maal: 'williamHull', ejer: '777' }, kraever: ['williamHull'] },
  { id: 'mgnLion', uge: ugeFor(2022, 8), tekst: 'BetMGN køber LionVegas.', arkivId: 'a15', opkoeb: { maal: 'lionVegas', ejer: 'betMgn' }, kraever: ['lionVegas', 'betMgn'] },
  { id: 'entrainBettown', uge: ugeFor(2023, 2), tekst: 'Entrain køber BetTown og flere mindre brands.', kraever: ['entrain'] },
  { id: 'unibitNorge', uge: ugeFor(2023, 5), tekst: 'Unibit beordres ud af Norge.', arkivId: 'a11', kraever: ['unibit'] },
  { id: 'usProgressiv', uge: ugeFor(2024, 6), tekst: 'En progressiv afgift efter Illinois-modellen breder sig i USA.' },
  { id: 'fljKinfolk', uge: ugeFor(2024, 9), tekst: 'Et fransk statslotteri køber Kinfolk Group, som ejer Unibit.', arkivId: 'a15', opkoeb: { maal: 'unibit', ejer: 'Et fransk statslotteri', ejerErStat: true }, kraever: ['unibit'] },
  { id: 'dkB2b', uge: ugeFor(2025, 0), tekst: 'Danmark indfører B2B-licens for spilleverandører.', arkivId: 'a2', flag: 'dkB2bLicens' },
  { id: 'flitterFunduel', uge: ugeFor(2025, 2), tekst: 'Flitter ejer nu 100 % af FunDuel.', arkivId: 'a15', opkoeb: { maal: 'funDuel', ejer: 'flitter' }, kraever: ['funDuel', 'flitter'] },
  { id: 'spnScoop', uge: ugeFor(2025, 11), tekst: 'SPN Bet lukker og relanceres som theScoop Bet.', arkivId: 'a13', kraever: ['betMgn'] },
  { id: 'kalsheeSag', uge: ugeFor(2026, 7), tekst: 'Kalshee-sagen splitter to føderale appeldomstole. Sagen peger mod højesteret.', arkivId: 'a14', kraever: ['kalshee'] },
  { id: 'seValg', uge: ugeFor(2026, 8), tekst: 'Valgkamp i Sverige med debat om spilafgiften.', presMarked: { marked: 'se', pres: 1 } },
  { id: 'fiB2b', uge: ugeFor(2028, 0), tekst: 'Finland kræver licens af B2B-leverandører.', arkivId: 'a10', flag: 'fiB2bLicens' },
];

/** Store sponsorater, der kommer i auktion (R7). Superligaen 2025 er historisk: appFirst byder højest [F]. */
export const SPONSORATER: { id: string; navn: string; marked: 'dk' | 'uk' | 'se'; uge: number; varighedUger: number; mindstebud: number; arkivId?: string }[] = [
  { id: 'ligaDk1', navn: 'Superligaen', marked: 'dk', uge: ugeFor(2015, 5), varighedUger: 156, mindstebud: 1.5 },
  { id: 'ligaSe1', navn: 'Allsvenskan', marked: 'se', uge: ugeFor(2020, 2), varighedUger: 156, mindstebud: 2 },
  { id: 'ligaUk1', navn: 'En Premier League-klub', marked: 'uk', uge: ugeFor(2018, 6), varighedUger: 104, mindstebud: 6 },
  { id: 'ligaDk2', navn: 'Superligaen', marked: 'dk', uge: ugeFor(2019, 5), varighedUger: 156, mindstebud: 2 },
  { id: 'ligaDk3', navn: 'Superligaen', marked: 'dk', uge: ugeFor(2025, 5), varighedUger: 156, mindstebud: 3, arkivId: 'a4' },
  { id: 'ligaUk2', navn: 'En Premier League-klub', marked: 'uk', uge: ugeFor(2023, 6), varighedUger: 104, mindstebud: 8 },
  { id: 'ligaSe2', navn: 'Allsvenskan', marked: 'se', uge: ugeFor(2029, 2), varighedUger: 156, mindstebud: 3 },
  { id: 'ligaDk4', navn: 'Superligaen', marked: 'dk', uge: ugeFor(2031, 5), varighedUger: 156, mindstebud: 4 },
];
