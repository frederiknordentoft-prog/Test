// Dialog-registre: signal-dialoger (fra sim-kernen) og brugeråbnede dialoger (fra uiStore).
import type { ComponentType } from 'react';
import type { Signal } from '../../sim/types';
import type { UiDialog } from '../../store/uiStore';
import ReviewDialog from './ReviewDialog';
import GalaDialog from './GalaDialog';
import QuarterDialog from './QuarterDialog';
import EventDialog from './EventDialog';
import ExpoDialog from './ExpoDialog';
import MilestoneDialog from './MilestoneDialog';
import FirmaMilepaelDialog from './FirmaMilepaelDialog';
import EndDialog from './EndDialog';
import NewProductDialog from './NewProductDialog';
import AssignDialog from './AssignDialog';
import SaveLoadDialog from './SaveLoadDialog';
import SettingsDialog from './SettingsDialog';
import DebugDialog from './DebugDialog';
import ProductDialog from './ProductDialog';
import StaffDialog from './StaffDialog';
import MarkedAabnerDialog from './MarkedAabnerDialog';
import RegelDialog from './RegelDialog';
import SanktionDialog from './SanktionDialog';
import AktSkiftDialog from './AktSkiftDialog';
import VerdensNyhedDialog from './VerdensNyhedDialog';
import TilbudDialog from './TilbudDialog';
import SponsorDialog from './SponsorDialog';
import ReaktionDialog from './ReaktionDialog';
import ArkivDialog from './ArkivDialog';

/** gruppe: flere signaler af samme slags fra samme uge (en række pr. marked) — signal er det første/vigtigste */
export type SignalDialogProps = { signal: Signal; gruppe?: Signal[]; onLuk: () => void };
export type UiDialogProps = { dialog: UiDialog; onLuk: () => void };

/** Signal-kind → dialog. 'messeVarsel' og 'messe' deler ExpoDialog; 'top10' og 'nr1' deler MilestoneDialog. */
export const SIGNAL_DIALOGER: Partial<Record<Signal['k'], ComponentType<SignalDialogProps>>> = {
  anmeldelse: ReviewDialog,
  galla: GalaDialog,
  kvartal: QuarterDialog,
  event: EventDialog,
  messeVarsel: ExpoDialog,
  messe: ExpoDialog,
  top10: MilestoneDialog,
  nr1: MilestoneDialog,
  slut: EndDialog,
  runde: FirmaMilepaelDialog,
  kontor: FirmaMilepaelDialog,
  // + fase 3 (tværs-sporet)
  markedAabner: MarkedAabnerDialog,
  regel: RegelDialog,
  sanktion: SanktionDialog,
  // + fase 4 (konkurrent-sporet)
  tilbud: TilbudDialog,
  sponsorAuktion: SponsorDialog,
  reaktion: ReaktionDialog,
  // + fase 5 (AI-sporet)
  aktSkift: AktSkiftDialog,
  verdensNyhed: VerdensNyhedDialog,
};

export const UI_DIALOGER: Record<UiDialog['kind'], ComponentType<UiDialogProps>> = {
  nytProdukt: NewProductDialog,
  tildel: AssignDialog,
  gemIndlaes: SaveLoadDialog,
  indstillinger: SettingsDialog,
  debug: DebugDialog,
  produkt: ProductDialog,
  medarbejder: StaffDialog,
  arkiv: ArkivDialog,
};
