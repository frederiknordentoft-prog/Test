// Navne til medarbejdere og produkter [D]. Ingen rigtige firmanavne her.
import type { ProductTypeId, ThemeId } from '../sim/types';

export const FORNAVNE = [
  'Anders', 'Mette', 'Kasper', 'Line', 'Rasmus', 'Camilla', 'Mikkel', 'Sara', 'Nikolaj', 'Julie', 'Frederik', 'Ida',
  'Christian', 'Emma', 'Simon', 'Laura', 'Emil', 'Freja', 'Oliver', 'Maja', 'Jakob', 'Signe', 'Mathias', 'Nanna',
  'Ahmad', 'Yasmin', 'Tobias', 'Cecilie', 'Magnus', 'Astrid', 'Jeppe', 'Katrine', 'Lukas', 'Amalie', 'Viktor', 'Rikke',
  'Omar', 'Helene', 'Søren', 'Birgitte', 'Thomas', 'Pernille', 'Morten', 'Louise', 'Henrik', 'Tine', 'Bo', 'Aya',
];
export const EFTERNAVNE = [
  'Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen', 'Sørensen', 'Rasmussen', 'Jørgensen',
  'Petersen', 'Madsen', 'Kristensen', 'Olsen', 'Thomsen', 'Poulsen', 'Johansen', 'Møller', 'Mortensen', 'Knudsen',
  'Mikkelsen', 'Dahl', 'Bach', 'Holm', 'Lund', 'Berg', 'Kjær', 'Vestergaard', 'Østergaard', 'Ali', 'Nguyen', 'Khan',
];

/** Byggesten til forslag til produktnavne */
export const TEMA_ORD: Record<ThemeId, string[]> = {
  fodbold: ['Stadion', 'Hattrick', 'Straffespark', 'Kampdag', 'Superliga'],
  haandbold: ['Kontra', 'Hurtig Midte', 'Stregspil', 'Håndbold'],
  tennis: ['Grand Slam', 'Ace', 'Tiebreak', 'Centercourt'],
  esport: ['Headshot', 'Respawn', 'GG', 'Arena'],
  formel: ['Pitstop', 'Pole', 'Chikane', 'Grand Prix'],
  eventyr: ['Klokketårnet', 'Dragehulen', 'Skatteøen', 'Troldeskov'],
  nordisk: ['Nordlys', 'Fjord', 'Hygge', 'Skjold'],
  retro: ['Arkade', 'Neon', 'Kassettebånd', 'Pixel'],
  jul: ['Nissebanden', 'Julestjernen', 'Pakkeleg', 'Risalamande'],
  rigdom: ['Guldkronen', 'Diamant', 'Skatkammer', 'Millionær'],
  popkultur: ['Primetime', 'Superstar', 'Premiere', 'Rødløber'],
  natur: ['Skovsø', 'Vildmark', 'Havørn', 'Lyngheden'],
  mytologi: ['Valhal', 'Thors Hammer', 'Yggdrasil', 'Asgård'],
  'sci-fi': ['Nebula', 'Kvantespring', 'Orbit', 'Robotia'],
};
export const TYPE_ORD: Record<ProductTypeId, string[]> = {
  prematch: ['Odds', 'Kupon', 'Tips'],
  livebetting: ['Live', 'Direkte', 'Puls'],
  betBuilder: ['Byg Selv', 'Kombi', 'Mix'],
  esport: ['Esport', 'Liga', 'Clash'],
  eventKontrakter: ['Udfald', 'Forudsig', 'Markedet'],
  slotsAggregator: ['Spillehal', 'Kasino', 'Hjul'],
  egneSlots: ['Original', 'Studio', 'Hjul'],
  livekasino: ['Salonen', 'Bordet', 'Live'],
  jackpotNetvaerk: ['Jackpot', 'Puljen', 'Kæmpepot'],
  aiSlots: ['AI', 'Generator', 'Uendelig'],
};
