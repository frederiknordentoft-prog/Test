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

export const PANELER: { id: PanelId; navn: string; ikon: IkonNavn; komponent: ComponentType }[] = [
  { id: 'projekter', navn: 'Projekter', ikon: 'produkt', komponent: ProjectsPanel },
  { id: 'personale', navn: 'Personale', ikon: 'folk', komponent: StaffPanel },
  { id: 'kontrakter', navn: 'Opgaver', ikon: 'kontrakt', komponent: ContractsPanel },
  { id: 'hitliste', navn: 'Top 10', ikon: 'hitliste', komponent: ChartPanel },
  { id: 'produkter', navn: 'Produkter', ikon: 'stjerne', komponent: ProductsPanel },
  { id: 'marked', navn: 'Marked', ikon: 'kort', komponent: MarketPanel },
  { id: 'kombinationer', navn: 'Kombibog', ikon: 'bog', komponent: ComboBookPanel },
  { id: 'firma', navn: 'Firma', ikon: 'firma', komponent: CompanyPanel },
  { id: 'nyheder', navn: 'Nyheder', ikon: 'nyhed', komponent: NewsPanel },
];
