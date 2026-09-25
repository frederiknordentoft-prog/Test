// Fane-registeret. Rækkefølgen er rækkefølgen i fanebjælken.
import type { ComponentType } from 'react';
import type { IkonNavn } from '../components/kit';
import type { PanelId } from '../../store/uiStore';
import ProjectsPanel from './ProjectsPanel';
import StaffPanel from './StaffPanel';
import ContractsPanel from './ContractsPanel';
import ChartPanel from './ChartPanel';
import ProductsPanel from './ProductsPanel';
import MarketPanel from './MarketPanel';
import ComboBookPanel from './ComboBookPanel';
import CompanyPanel from './CompanyPanel';
import NewsPanel from './NewsPanel';
import AiLabPanel from './AiLabPanel';
import CompetitorPanel from './CompetitorPanel';
import PlatformPanel from './PlatformPanel';
import ArchivePanel from './ArchivePanel';
import TownPanel from './TownPanel';

/** Kerneloopet først, så verden omkring jer (marked, rivaler, platform, byen), så firmaet og til sidst opslagsværkerne.
 *  På mobil står de fem vigtigste fast i bunden, og resten ligger under "Mere" (se Fanebjaelke i GameScreen.tsx). */
export const PANELER: { id: PanelId; navn: string; ikon: IkonNavn; komponent: ComponentType }[] = [
  { id: 'projekter', navn: 'Projekter', ikon: 'produkt', komponent: ProjectsPanel },
  { id: 'personale', navn: 'Personale', ikon: 'folk', komponent: StaffPanel },
  { id: 'kontrakter', navn: 'Opgaver', ikon: 'kontrakt', komponent: ContractsPanel },
  { id: 'hitliste', navn: 'Top 10', ikon: 'hitliste', komponent: ChartPanel },
  { id: 'produkter', navn: 'Produkter', ikon: 'stjerne', komponent: ProductsPanel },
  { id: 'marked', navn: 'Marked', ikon: 'kort', komponent: MarketPanel },
  { id: 'konkurrenter', navn: 'Rivaler', ikon: 'svaerd', komponent: CompetitorPanel },
  { id: 'platform', navn: 'Platform', ikon: 'server', komponent: PlatformPanel },
  { id: 'by', navn: 'Byen', ikon: 'hus', komponent: TownPanel },
  { id: 'firma', navn: 'Firma', ikon: 'firma', komponent: CompanyPanel },
  // Låst med en teaser før 2026 (fanen viser en hængelås)
  { id: 'ailab', navn: 'AI-lab', ikon: 'chip', komponent: AiLabPanel },
  { id: 'kombinationer', navn: 'Kombibog', ikon: 'bog', komponent: ComboBookPanel },
  { id: 'nyheder', navn: 'Nyheder', ikon: 'nyhed', komponent: NewsPanel },
  // Skjules i fanebjælken, når Arkivet er slået fra (settings.arkiv)
  { id: 'arkiv', navn: 'Arkiv', ikon: 'arkiv', komponent: ArchivePanel },
];
