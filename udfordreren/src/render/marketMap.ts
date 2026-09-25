// Markedskortet (spec 6.7): et proceduralt pixelkort på 320×180 (nearest-neighbour) over Nord- og Vesteuropa med et
// indsat kort over Nordamerika (Ontario og USA). Hvert af de 9 markeder er en region i flagets farver med et statusmærke
// (ikon + farve) og spillerens andel. Norge er monopol (gråskraveret). En lille "offshore-ø" står ude i Atlanten.
// Terrænet bygges én gang pr. status (ImageData). Markering, puls og bølger tegnes oven på i et let rAF-loop (~11 fps),
// som står helt stille ved reduceret bevægelse (så tegnes der kun, når noget ændrer sig).
import type { MarketId } from '../sim/types';
import { MARKETS, MARKET_IDS } from '../data/markets';
import { T } from './palette';
import { tegnTekst, tekstBredde } from './font';

export const KORT_W = 320;
export const KORT_H = 180;

export type KortStatus = 'lukket' | 'monopol' | 'aaben' | 'ansoegt' | 'aktiv' | 'suspenderet' | 'inddraget';
export type KortMarked = { status: KortStatus; andel: number; ny: boolean; graa: boolean };
export type KortData = { markeder: Record<MarketId, KortMarked>; valgt: MarketId; offshoreAktiv: boolean };
export type KortKlik = MarketId | 'offshore';

// ---------- Geometri (grove kystlinjer i længde/bredde, projiceret til kortets pixels) ----------

type Pkt = [number, number];
type Proj = (lon: number, lat: number) => Pkt;

const EU: Proj = (lon, lat) => [118 + (lon + 9) * 4.82, 2 + (71.5 - lat) * 7.18];
const NA: Proj = (lon, lat) => [7 + (lon + 126) * 1.672, 97 + (57 - lat) * 2.33];
/** Indsat kort (Nordamerika) og titelfeltet oppe til venstre */
const INDSAT = { x: 4, y: 86, w: 108, h: 90 };
const OE = { x: 30, y: 52, w: 30, h: 16 }; // offshore-øen

const SOE = 0;
const LAND = 1;
const INDSOE = 2;
const OEN = 4;
const MARKED0 = 10;
const markedKode = (m: MarketId) => MARKED0 + MARKET_IDS.indexOf(m);
const kodeMarked = (k: number): MarketId | null => (k >= MARKED0 && k < MARKED0 + MARKET_IDS.length ? MARKET_IDS[k - MARKED0] : null);

// Delte grænser, så nabolande slutter tæt (ingen huller)
const B_NO_SE: Pkt[] = [[11.4, 59.05], [11.8, 59.6], [12.5, 60.3], [12.3, 61.0], [12.8, 61.5], [12.2, 62.4], [12.0, 63.0], [12.2, 63.9], [13.7, 64.5], [14.0, 65.0], [14.5, 65.9], [15.5, 66.5], [16.5, 67.5], [17.9, 67.95], [18.0, 68.5], [20.55, 69.06]];
const B_NO_FI: Pkt[] = [[20.55, 69.06], [21.6, 69.28], [22.4, 68.75], [23.9, 68.8], [24.9, 68.6], [25.8, 69.0], [26.0, 69.7], [27.9, 70.08], [28.4, 69.8], [28.9, 69.05]];
const B_SE_FI: Pkt[] = [[20.55, 69.06], [21.1, 68.5], [22.4, 68.2], [23.4, 67.9], [23.7, 67.0], [23.6, 66.3], [24.15, 65.85]];
const B_NO_RU: Pkt[] = [[28.9, 69.05], [29.3, 69.4], [30.95, 69.78]];
const B_FI_RU: Pkt[] = [[28.9, 69.05], [28.7, 68.5], [29.9, 67.7], [29.1, 66.9], [30.0, 65.7], [29.7, 64.8], [30.5, 64.2], [31.5, 63.0], [31.0, 62.4], [29.3, 61.3], [27.8, 60.55]];
const B_DK_DE: Pkt[] = [[8.6, 54.9], [9.4, 54.83], [9.9, 54.8]];
const B_DE_NL: Pkt[] = [[7.2, 53.25], [7.05, 52.6], [6.75, 52.45], [7.05, 52.25], [6.75, 51.95], [5.95, 51.8], [6.2, 51.35], [5.95, 51.0], [6.0, 50.75]];
const B_US_ON: Pkt[] = [[-95.15, 49.0], [-89.6, 48.0], [-84.5, 46.5], [-82.4, 43.0], [-83.1, 42.1], [-79.0, 42.9], [-76.3, 44.2], [-74.7, 45.0]];

const rev = (p: Pkt[]) => [...p].reverse();

type Poly = { kode: number; proj: Proj; pts: Pkt[]; hoved?: boolean };

function polygoner(): Poly[] {
  const k = markedKode;
  return [
    // Kontinentet (Frankrig, Benelux-resten, Centraleuropa, Polen, Baltikum, Rusland) — neutralt land
    {
      kode: LAND, proj: EU, pts: [
        [-2.4, 46.5], [-2.4, 47.0], [-3.5, 47.7], [-4.4, 47.9], [-4.8, 48.35], [-4.5, 48.65], [-3.0, 48.8], [-1.9, 48.7], [-1.9, 49.7], [-1.2, 49.35], [0.1, 49.45], [1.2, 49.95], [1.6, 50.5], [1.9, 51.0], [2.5, 51.1], [3.35, 51.35],
        [4.2, 52.0], [4.7, 53.0], [6.0, 53.5], [8.0, 53.6], [8.7, 53.9], [8.9, 54.3], [8.6, 54.9], [9.9, 54.8], [10.2, 54.4], [11.0, 54.4], [10.9, 54.0], [12.1, 54.2], [13.4, 54.5], [14.2, 53.95],
        [16.0, 54.25], [17.5, 54.8], [18.6, 54.4], [19.6, 54.4], [20.0, 54.9], [21.1, 55.7], [21.0, 56.5], [21.6, 57.5], [22.6, 57.75], [23.5, 57.0], [24.1, 57.0], [24.4, 58.2], [23.5, 58.6], [23.4, 59.2], [24.75, 59.45], [26.0, 59.6], [28.0, 59.45], [30.2, 59.95],
        ...B_FI_RU.slice().reverse(), ...B_NO_RU.slice(1), [32.8, 69.9], [32.8, 46.5],
      ],
    },
    // Irland (neutralt) og øerne
    {
      kode: LAND, proj: EU, pts: [
        [-6.0, 52.15], [-6.05, 53.0], [-6.2, 53.35], [-6.1, 54.0], [-5.5, 54.3], [-5.9, 55.1], [-7.3, 55.35], [-8.3, 55.2], [-8.7, 54.6], [-9.9, 54.3], [-10.1, 53.9], [-9.9, 53.4], [-9.4, 52.6], [-10.4, 52.15], [-10.2, 51.8], [-9.8, 51.5], [-8.5, 51.65], [-7.8, 51.95], [-7.0, 52.15],
      ],
    },
    // Storbritannien
    {
      kode: k('uk'), proj: EU, hoved: true, pts: [
        [-5.7, 50.05], [-5.2, 49.96], [-4.2, 50.35], [-3.64, 50.22], [-3.4, 50.6], [-2.4, 50.6], [-1.9, 50.7], [-1.1, 50.75], [0.2, 50.75], [1.0, 50.95], [1.4, 51.2], [0.9, 51.45], [1.3, 51.85], [1.75, 52.1], [1.75, 52.6], [1.4, 52.95], [0.4, 52.95], [0.2, 52.8], [0.35, 53.2], [0.1, 53.55],
        [-0.1, 54.1], [-0.6, 54.5], [-1.2, 54.65], [-1.5, 55.1], [-1.7, 55.6], [-2.1, 55.9], [-2.6, 56.05], [-2.7, 56.35], [-2.4, 56.7], [-2.05, 57.15], [-1.8, 57.5], [-2.3, 57.7], [-3.2, 57.7], [-4.2, 57.5], [-3.7, 57.85], [-3.3, 58.0], [-3.05, 58.45], [-3.2, 58.65], [-4.0, 58.6], [-5.0, 58.6],
        [-5.3, 58.2], [-5.4, 57.9], [-5.7, 57.6], [-5.8, 57.2], [-5.6, 56.8], [-6.2, 56.7], [-5.6, 56.4], [-5.6, 55.8], [-5.75, 55.3], [-5.3, 55.8], [-4.9, 55.7], [-4.7, 55.4], [-5.1, 55.0], [-5.0, 54.65], [-4.4, 54.7], [-3.6, 54.9], [-3.3, 54.9], [-3.6, 54.5], [-3.2, 54.1], [-3.0, 53.75], [-3.0, 53.4],
        [-3.4, 53.35], [-4.1, 53.25], [-4.6, 53.3], [-4.5, 53.0], [-4.75, 52.8], [-4.1, 52.6], [-4.1, 52.3], [-4.7, 52.1], [-5.3, 51.9], [-5.1, 51.7], [-4.1, 51.55], [-3.3, 51.4], [-2.7, 51.55], [-3.0, 51.2], [-4.2, 51.2], [-4.5, 51.0], [-4.8, 50.6], [-5.1, 50.35],
      ],
    },
    { kode: k('uk'), proj: EU, pts: [[-5.45, 54.3], [-5.9, 55.1], [-6.2, 55.2], [-7.3, 55.25], [-7.5, 54.9], [-8.1, 54.6], [-7.6, 54.1], [-6.8, 54.05], [-6.1, 54.05]] }, // Nordirland
    { kode: k('uk'), proj: EU, pts: [[-3.4, 58.85], [-2.7, 59.25], [-2.4, 59.1], [-2.9, 58.75]] }, // Orkney
    { kode: k('uk'), proj: EU, pts: [[-1.3, 59.85], [-1.0, 60.5], [-0.8, 60.75], [-1.5, 60.5], [-1.35, 60.1]] }, // Shetland
    // Holland
    {
      kode: k('nl'), proj: EU, hoved: true, pts: [
        [7.2, 53.25], [6.9, 53.45], [6.2, 53.45], [5.2, 53.35], [4.75, 52.95], [4.6, 52.45], [4.25, 52.1], [4.05, 51.95], [3.6, 51.7], [3.45, 51.55], [3.35, 51.37], [3.95, 51.25], [4.5, 51.45], [5.1, 51.4], [5.65, 51.1], [5.7, 50.75], ...rev(B_DE_NL),
      ],
    },
    // Tyskland
    {
      kode: k('de'), proj: EU, hoved: true, pts: [
        ...B_DK_DE, [10.2, 54.4], [10.8, 54.3], [11.1, 54.45], [10.9, 54.0], [11.5, 54.0], [12.1, 54.18], [12.5, 54.45], [13.4, 54.65], [13.7, 54.3], [14.2, 53.95], [14.4, 53.3], [14.6, 52.6], [14.7, 52.0], [15.0, 51.1], [14.3, 51.05], [13.4, 50.65], [12.1, 50.3], [12.5, 49.8], [13.0, 49.3], [13.8, 48.8],
        [13.45, 48.57], [12.9, 47.7], [11.5, 47.5], [10.5, 47.45], [9.6, 47.55], [8.5, 47.65], [7.6, 47.6], [7.6, 48.0], [7.8, 48.6], [8.2, 48.97], [7.0, 49.15], [6.4, 49.45], [6.4, 49.8], [6.1, 50.15], [6.4, 50.3], ...rev(B_DE_NL),
        [7.0, 53.6], [8.0, 53.7], [8.5, 53.55], [8.7, 53.87], [9.0, 53.9], [8.9, 54.3], [8.6, 54.5], [8.8, 54.8],
      ],
    },
    // Danmark
    {
      kode: k('dk'), proj: EU, hoved: true, pts: [
        [8.6, 54.9], [8.5, 55.1], [8.6, 55.45], [8.45, 55.47], [8.08, 55.56], [8.15, 55.95], [8.15, 56.3], [8.2, 56.7], [8.6, 57.1], [9.4, 57.15], [9.95, 57.6], [10.6, 57.75], [10.55, 57.45], [10.3, 57.05], [10.35, 56.7], [10.95, 56.45], [10.65, 56.15], [10.2, 56.15], [10.0, 55.85], [9.7, 55.6], [9.75, 55.5],
        [9.5, 55.45], [9.6, 55.2], [9.45, 55.05], [9.8, 54.95], ...rev(B_DK_DE),
      ],
    },
    { kode: k('dk'), proj: EU, pts: [[9.75, 55.45], [10.4, 55.6], [10.75, 55.4], [10.75, 55.1], [10.2, 55.05], [9.85, 55.25]] }, // Fyn
    { kode: k('dk'), proj: EU, pts: [[12.6, 56.03], [12.3, 56.12], [11.85, 55.97], [11.3, 55.97], [11.1, 55.68], [11.25, 55.35], [11.75, 55.15], [11.95, 55.0], [12.45, 55.28], [12.25, 55.45], [12.6, 55.68]] }, // Sjælland
    { kode: k('dk'), proj: EU, pts: [[11.0, 54.85], [11.75, 54.95], [12.1, 54.75], [11.95, 54.55], [11.4, 54.65], [11.0, 54.75]] }, // Lolland-Falster
    { kode: k('dk'), proj: EU, pts: [[14.7, 55.25], [15.15, 55.15], [15.05, 54.98], [14.7, 55.05]] }, // Bornholm
    // Norge
    {
      kode: k('no'), proj: EU, hoved: true, pts: [
        [11.4, 59.05], [10.9, 59.2], [10.75, 59.9], [10.45, 59.5], [10.4, 59.2], [10.0, 59.0], [9.4, 58.85], [8.77, 58.46], [8.0, 58.1], [7.05, 57.98], [6.0, 58.45], [5.55, 58.95], [5.25, 59.4], [5.0, 60.4], [4.9, 61.2], [5.1, 62.1], [6.1, 62.5], [7.7, 63.1], [8.6, 63.5], [9.8, 64.0],
        [10.8, 64.6], [11.2, 64.9], [12.2, 65.8], [12.6, 66.3], [13.5, 66.9], [14.4, 67.3], [15.3, 68.0], [16.0, 68.4], [16.2, 69.0], [17.8, 69.6], [18.9, 69.8], [19.9, 70.1], [21.5, 70.3], [23.5, 70.6], [24.9, 71.0], [25.8, 71.15], [27.5, 71.05], [29.5, 70.7], [31.1, 70.4], [29.7, 70.1], [30.05, 69.75],
        ...rev(B_NO_RU), ...rev(B_NO_FI).slice(1), ...rev(B_NO_SE).slice(1),
      ],
    },
    { kode: k('no'), proj: EU, pts: [[12.9, 67.8], [13.6, 68.05], [14.8, 68.3], [15.3, 68.55], [14.2, 68.35], [13.2, 68.05]] }, // Lofoten
    // Sverige
    {
      kode: k('se'), proj: EU, hoved: true, pts: [
        ...B_NO_SE, ...B_SE_FI.slice(1), [22.15, 65.55], [21.5, 65.2], [21.2, 64.75], [20.4, 63.75], [18.8, 63.2], [18.0, 62.6], [17.4, 62.4], [17.2, 61.7], [17.2, 60.7], [18.3, 60.4], [18.9, 60.0], [19.0, 59.8], [18.3, 59.35], [18.0, 59.0], [17.9, 58.9], [17.0, 58.6], [16.5, 58.5], [16.65, 57.75], [16.35, 56.65],
        [15.8, 56.15], [15.6, 56.15], [14.7, 56.15], [14.3, 55.9], [14.35, 55.55], [13.8, 55.4], [13.15, 55.35], [12.95, 55.6], [12.8, 55.87], [12.7, 56.05], [12.45, 56.3], [12.85, 56.65], [12.25, 57.1], [11.85, 57.7], [11.6, 58.3], [11.2, 58.9],
      ],
    },
    { kode: k('se'), proj: EU, pts: [[18.15, 57.1], [18.35, 57.6], [18.8, 57.95], [19.2, 57.9], [18.8, 57.4], [18.35, 56.9]] }, // Gotland
    { kode: k('se'), proj: EU, pts: [[16.4, 56.2], [16.95, 57.35], [17.15, 57.3], [16.6, 56.2]] }, // Öland
    // Finland
    {
      kode: k('fi'), proj: EU, hoved: true, pts: [
        ...rev(B_SE_FI), ...B_NO_FI.slice(1), ...B_FI_RU.slice(1), [26.9, 60.45], [25.0, 60.15], [23.5, 59.95], [22.95, 59.8], [22.4, 60.1], [21.6, 60.5], [21.4, 61.1], [21.5, 61.6], [21.2, 62.2], [21.1, 63.0], [21.5, 63.1], [22.4, 63.5], [23.1, 63.85], [24.3, 64.5], [25.4, 65.0], [25.2, 65.5], [24.5, 65.75],
      ],
    },
    { kode: k('fi'), proj: EU, pts: [[19.6, 60.1], [20.3, 60.4], [20.4, 60.05], [19.9, 59.95]] }, // Åland
    { kode: INDSOE, proj: EU, pts: [[5.05, 52.55], [5.2, 53.05], [5.45, 52.9], [5.8, 52.8], [5.8, 52.5], [5.4, 52.35]] }, // IJsselmeer

    // ---- Nordamerika (indsat) ----
    {
      kode: LAND, proj: NA, pts: [ // Canada og Mexico (neutralt)
        [-127, 48.2], [-127, 58], [-64, 58], [-64, 44.5], [-67, 44.5], [-71, 45], [-80, 42], [-90, 46], [-95, 48.8], [-123, 48.8],
      ],
    },
    {
      kode: LAND, proj: NA, pts: [
        [-117.1, 32.5], [-114.8, 32.5], [-111.0, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.9, 30.6], [-103.3, 29.0], [-101.4, 29.8], [-99.2, 26.6], [-97.2, 25.95], [-97.7, 23.0], [-110.0, 23.0], [-112.3, 24.8], [-114.2, 28.0], [-116.0, 30.5],
      ],
    },
    { kode: INDSOE, proj: NA, pts: [[-114.7, 31.6], [-112.8, 30.0], [-109.2, 25.8], [-106.4, 23.2], [-109.4, 23.2], [-110.8, 24.6], [-112.9, 28.0], [-114.3, 30.6]] }, // Californiske Golf
    { kode: INDSOE, proj: NA, pts: [[-92.4, 57.5], [-88.5, 56.9], [-85, 55.3], [-82.3, 55.1], [-82.3, 52.9], [-80.6, 51.3], [-79.3, 51.6], [-78.7, 52.5], [-79.0, 54.3], [-77.0, 55.8], [-76.6, 57.5]] }, // Hudson Bay
    { kode: INDSOE, proj: NA, pts: [[-64, 50.2], [-69.5, 48.6], [-71.2, 46.9], [-68.5, 48.1], [-64, 48.9]] }, // St. Lawrence
    // Ontario
    {
      kode: k('on'), proj: NA, hoved: true, pts: [
        [-95.15, 49.0], [-95.15, 52.8], [-89.0, 56.85], [-88.0, 56.9], [-85.0, 55.3], [-82.3, 55.1], [-82.3, 52.9], [-80.6, 51.3], [-79.5, 51.5], [-79.5, 47.5], [-79.0, 46.3], [-76.0, 45.4], [-74.3, 45.3], ...rev(B_US_ON).slice(0, -1),
      ],
    },
    // USA
    {
      kode: k('us'), proj: NA, hoved: true, pts: [
        [-124.7, 48.4], [-123.0, 49.0], ...B_US_ON, [-71.5, 45.0], [-70.0, 46.7], [-69.2, 47.45], [-67.8, 47.1], [-67.8, 45.7], [-67.0, 44.8], [-68.8, 44.3], [-70.2, 43.6], [-70.7, 42.7], [-70.0, 41.8], [-71.4, 41.4], [-73.8, 40.6], [-74.0, 40.0], [-74.9, 38.9], [-75.4, 38.4], [-76.0, 37.0],
        [-75.5, 35.2], [-77.9, 33.9], [-79.2, 33.2], [-81.0, 32.0], [-81.4, 30.4], [-80.6, 28.4], [-80.1, 26.5], [-80.4, 25.2], [-81.1, 25.1], [-81.8, 26.4], [-82.6, 27.8], [-83.0, 29.0], [-84.0, 30.0], [-85.4, 29.7], [-87.4, 30.3], [-89.4, 30.2], [-89.2, 29.2], [-90.5, 29.1], [-93.8, 29.7], [-94.8, 29.3],
        [-97.2, 27.7], [-97.2, 25.95], [-99.2, 26.6], [-101.4, 29.8], [-103.3, 29.0], [-104.9, 30.6], [-106.5, 31.8], [-108.2, 31.3], [-111.0, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.4, 34.0], [-120.6, 34.6], [-121.9, 36.6], [-122.5, 37.8], [-123.8, 39.8], [-124.4, 40.4], [-124.2, 42.0], [-124.0, 46.2],
      ],
    },
    // De store søer
    { kode: INDSOE, proj: NA, pts: [[-92.1, 46.8], [-89.5, 48.2], [-86.5, 48.8], [-84.6, 47.9], [-84.5, 46.5], [-87.5, 46.4]] },
    { kode: INDSOE, proj: NA, pts: [[-87.9, 42.2], [-87.2, 41.6], [-86.3, 42.3], [-85.5, 45.8], [-84.9, 45.9], [-86.9, 45.4]] },
    { kode: INDSOE, proj: NA, pts: [[-84.5, 45.9], [-83.4, 46.1], [-80.5, 45.8], [-79.7, 44.6], [-81.7, 43.3], [-82.5, 43.0], [-83.4, 44.0]] },
    { kode: INDSOE, proj: NA, pts: [[-83.4, 41.7], [-81.0, 42.2], [-78.9, 42.9], [-79.2, 42.6], [-81.5, 41.5]] },
    { kode: INDSOE, proj: NA, pts: [[-79.8, 43.3], [-78.0, 43.9], [-76.2, 44.2], [-76.2, 43.5], [-78.0, 43.3]] },
  ];
}

// ---------- Farver (RGB-tal, så terrænet kan bygges hurtigt) ----------

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const gange = (a: Rgb, f: number): Rgb => [a[0] * f, a[1] * f, a[2] * f];
const graa = (a: Rgb): Rgb => {
  const l = a[0] * 0.3 + a[1] * 0.55 + a[2] * 0.15;
  return [l, l, l];
};

const C = {
  hav: hex('#121935'),
  havPrik: hex('#151d3c'),
  havKyst1: hex('#233363'),
  havKyst2: hex('#1a264a'),
  indsatHav: hex('#131b37'),
  land: hex('#2b3150'),
  land2: hex('#30375a'),
  soe: hex('#1d2a52'),
  hvid: hex('#f2efe6'),
  gul: hex('#fecc00'),
  roed: hex('#c8102e'),
  skravGrund: hex('#454a62'),
  skravLinje: hex('#7c81a3'),
  warn: hex(T.warn),
  bad: hex('#9e2b36'),
  inddraget: hex('#3a2330'),
};

type Boks = { x0: number; y0: number; w: number; h: number };

function nordisk(x: number, y: number, b: Boks, grund: Rgb, kors: Rgb, indre: Rgb | null): Rgb {
  const cx = b.x0 + b.w * 0.37;
  const cy = b.y0 + b.h * 0.5;
  const t = Math.max(1.5, Math.min(b.w, b.h) * 0.075);
  const dx = Math.abs(x + 0.5 - cx);
  const dy = Math.abs(y + 0.5 - cy);
  if (indre && (dx < t * 0.55 || dy < t * 0.55)) return indre;
  if (dx < t || dy < t) return kors;
  return grund;
}

const FLAG = {
  dk: [hex('#c8102e'), hex('#f4f2ec')],
  se: [hex('#006aa7'), hex('#fecc00')],
  fi: [hex('#eef0f4'), hex('#1d4a8c')],
  no: [hex('#ba0c2f'), hex('#f4f2ec'), hex('#00205b')],
  de: [hex('#26262e'), hex('#dd0000'), hex('#ffce00')],
  nl: [hex('#ae1c28'), hex('#f4f2ec'), hex('#21468b')],
  uk: [hex('#1a3a8f'), hex('#f4f2ec'), hex('#c8102e')],
  on: [hex('#d52b1e'), hex('#f4f2ec')],
  us: [hex('#b22234'), hex('#f4f2ec'), hex('#3c3b6e')],
} as const;

function flagFarve(m: MarketId, x: number, y: number, b: Boks): Rgb {
  const u = (x + 0.5 - b.x0) / Math.max(1, b.w);
  const v = (y + 0.5 - b.y0) / Math.max(1, b.h);
  switch (m) {
    case 'dk':
      return nordisk(x, y, b, FLAG.dk[0], FLAG.dk[1], null);
    case 'se':
      return nordisk(x, y, b, FLAG.se[0], FLAG.se[1], null);
    case 'fi':
      return nordisk(x, y, b, FLAG.fi[0], FLAG.fi[1], null);
    case 'no':
      return nordisk(x, y, b, FLAG.no[0], FLAG.no[1], FLAG.no[2]);
    case 'de':
      return v < 1 / 3 ? FLAG.de[0] : v < 2 / 3 ? FLAG.de[1] : FLAG.de[2];
    case 'nl':
      return v < 1 / 3 ? FLAG.nl[0] : v < 2 / 3 ? FLAG.nl[1] : FLAG.nl[2];
    case 'uk': {
      const s = Math.min(b.w, b.h);
      const d1 = Math.abs(u - v) * s;
      const d2 = Math.abs(u + v - 1) * s;
      const cx = Math.abs(x + 0.5 - (b.x0 + b.w * 0.5));
      const cy = Math.abs(y + 0.5 - (b.y0 + b.h * 0.55));
      if (cx < 2 || cy < 2) return FLAG.uk[2];
      if (cx < 3.5 || cy < 3.5) return FLAG.uk[1];
      if (d1 < 1.6 || d2 < 1.6) return d1 < 0.6 || d2 < 0.6 ? FLAG.uk[2] : FLAG.uk[1];
      return FLAG.uk[0];
    }
    case 'on': {
      if (u < 0.26 || u > 0.74) return FLAG.on[0];
      const dx = Math.abs(x + 0.5 - (b.x0 + b.w * 0.5));
      const dy = Math.abs(y + 0.5 - (b.y0 + b.h * 0.56));
      return dx + dy < 4.5 || (dx < 1 && dy < 6) ? FLAG.on[0] : FLAG.on[1];
    }
    case 'us': {
      if (u < 0.42 && v < 0.54) return x % 3 === 1 && y % 3 === 1 ? FLAG.us[1] : FLAG.us[2];
      return Math.floor(v * 13) % 2 === 0 ? FLAG.us[0] : FLAG.us[1];
    }
  }
}

function statusFarve(c: Rgb, st: KortStatus, x: number, y: number, graaBrand: boolean): Rgb {
  switch (st) {
    case 'aktiv':
      return c;
    case 'aaben':
    case 'ansoegt':
      return mix(c, C.land, 0.38);
    case 'lukket': {
      const d = mix(mix(c, graa(c), 0.5), C.land, 0.58);
      return (x + y) % 2 === 0 ? d : gange(d, 0.93);
    }
    case 'monopol':
      return (x + y) % 4 === 0 ? (graaBrand ? mix(C.skravLinje, C.warn, 0.45) : C.skravLinje) : C.skravGrund;
    case 'suspenderet':
      return (x + y) % 6 < 2 ? mix(c, C.warn, 0.75) : mix(c, C.land, 0.35);
    case 'inddraget':
      return (x - y + 600) % 5 === 0 ? C.bad : mix(graa(c), C.inddraget, 0.65);
  }
}

// ---------- Pixel-ikoner til statusmærker (8×8) ----------

const IKON: Record<string, string[]> = {
  flueben: ['........', '.......#', '......##', '#....##.', '##..##..', '.####...', '..##....', '........'],
  ur: ['..####..', '.#....#.', '#...#..#', '#...#..#', '#...##.#', '#......#', '.#....#.', '..####..'],
  noegle: ['..####..', '.##..##.', '.##..##.', '..####..', '...##...', '...###..', '...##...', '...###..'],
  laas: ['..####..', '.#....#.', '.#....#.', '########', '###..###', '###..###', '########', '........'],
  pause: ['........', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '.##..##.', '........'],
  kryds: ['#......#', '##....##', '.##..##.', '..####..', '..####..', '.##..##.', '##....##', '#......#'],
};

const STATUS_IKON: Record<KortStatus, keyof typeof IKON> = {
  aktiv: 'flueben',
  ansoegt: 'ur',
  aaben: 'noegle',
  lukket: 'laas',
  monopol: 'laas',
  suspenderet: 'pause',
  inddraget: 'kryds',
};
const STATUS_FARVE: Record<KortStatus, string> = {
  aktiv: T.good,
  ansoegt: T.warn,
  aaben: T.sky,
  lukket: T.dim,
  monopol: '#8d91ad',
  suspenderet: T.warn,
  inddraget: T.bad,
};
const STATUS_KORT: Record<KortStatus, string> = {
  aktiv: 'AKTIV',
  ansoegt: 'ANSØGT',
  aaben: 'ÅBEN',
  lukket: 'LUKKET',
  monopol: 'MONOPOL',
  suspenderet: 'SUSPENDERET',
  inddraget: 'INDDRAGET',
};

function tegnIkon(ctx: CanvasRenderingContext2D, navn: keyof typeof IKON, x: number, y: number, s: number, farve: string): void {
  ctx.fillStyle = farve;
  const rows = IKON[navn];
  for (let r = 0; r < 8; r++) {
    const row = rows[r];
    let c = 0;
    while (c < 8) {
      if (row[c] === '#') {
        let l = 1;
        while (c + l < 8 && row[c + l] === '#') l++;
        ctx.fillRect(x + c * s, y + r * s, l * s, s);
        c += l;
      } else c++;
    }
  }
}

/** Mærker, hvis etiket står til venstre (så den ikke dækker landet) */
const ETIKET_VENSTRE = new Set<MarketId>(['dk']);

/** Hvor stregen fra et mærke ude i havet rammer landet (ellers regionens tyngdepunkt) */
const ANKER: Partial<Record<MarketId, Pkt>> = { no: EU(8.6, 61.3), dk: EU(9.3, 56.2), nl: EU(5.4, 52.3) };

/** Mærkernes midtpunkter (logiske pixels). NL og DK står ude i Nordsøen med en streg ind til landet. */
const MAERKE: Record<MarketId, Pkt> = {
  uk: [151, 133],
  nl: [172, 121],
  dk: [190, 104],
  de: [213, 154],
  no: [184, 60],
  se: [238, 79],
  fi: [289, 62],
  on: [77, 114],
  us: [52, 143],
};

/** På smalle skærme er mærkerne dobbelt så store: flyt de tætte (UK, NL, DK), så de ikke overlapper */
const MAERKE_STOR: Partial<Record<MarketId, Pkt>> = {
  uk: [143, 129],
  nl: [170, 144],
  dk: [187, 101],
  de: [214, 158],
};

// ---------- Rendereren ----------

type Region = { boks: Boks; midt: Pkt; omrids: Int16Array; antal: number };

function lavCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d');
  if (!x) throw new Error('Canvas 2D understøttes ikke');
  x.imageSmoothingEnabled = false;
  return x;
}

/** Grundkortet (regioner pr. pixel) bygges én gang pr. side-load */
let GRUND: { grid: Uint8Array; afstand: Uint8Array; regioner: Record<MarketId, Region>; boelger: Int16Array } | null = null;

function bygGrund(): NonNullable<typeof GRUND> {
  const W = KORT_W;
  const H = KORT_H;
  const grid = new Uint8Array(W * H);
  const hovedBoks = {} as Record<MarketId, Boks>;
  let indsatRyddet = false;
  for (const p of polygoner()) {
    // Før Nordamerika: ryd det indsatte felt til hav (Europas hav fortsætter ellers ind under rammen)
    if (p.proj === NA && !indsatRyddet) {
      indsatRyddet = true;
      for (let y = INDSAT.y; y < INDSAT.y + INDSAT.h; y++) grid.fill(SOE, y * W + INDSAT.x, y * W + INDSAT.x + INDSAT.w);
    }
    const pts = p.pts.map(([lo, la]) => p.proj(lo, la));
    const klip = p.proj === NA ? { x0: INDSAT.x + 1, y0: INDSAT.y + 9, x1: INDSAT.x + INDSAT.w - 1, y1: INDSAT.y + INDSAT.h - 1 } : { x0: 0, y0: 0, x1: W, y1: H };
    const n = fyld(grid, pts, p.kode, klip);
    if (n === 0) {
      // Små øer skal kunne ses: mindst én pixel
      const cx = Math.round(pts.reduce((a, q) => a + q[0], 0) / pts.length - 0.5);
      const cy = Math.round(pts.reduce((a, q) => a + q[1], 0) / pts.length - 0.5);
      if (cx >= 0 && cx < W && cy >= 0 && cy < H) grid[cy * W + cx] = p.kode;
    }
    const m = kodeMarked(p.kode);
    if (m && p.hoved) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [x, y] of pts) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      hovedBoks[m] = { x0, y0, w: x1 - x0, h: y1 - y0 };
    }
  }
  return efterbehandl(grid, hovedBoks);
}

function fyld(grid: Uint8Array, pts: Pkt[], kode: number, k: { x0: number; y0: number; x1: number; y1: number }): number {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(k.y0, Math.floor(minY));
  const y1 = Math.min(k.y1 - 1, Math.ceil(maxY));
  const xs: number[] = [];
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i][1];
      const yj = pts[j][1];
      if (yi > yc !== yj > yc) xs.push(pts[i][0] + ((yc - yi) / (yj - yi)) * (pts[j][0] - pts[i][0]));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const a = Math.max(k.x0, Math.ceil(xs[q] - 0.5));
      const b = Math.min(k.x1 - 1, Math.ceil(xs[q + 1] - 0.5) - 1);
      for (let x = a; x <= b; x++) {
        grid[y * KORT_W + x] = kode;
        n++;
      }
    }
  }
  return n;
}

function efterbehandl(grid: Uint8Array, hovedBoks: Record<MarketId, Boks>): NonNullable<typeof GRUND> {
  const W = KORT_W;
  const H = KORT_H;
  const vand = (k: number) => k === SOE || k === INDSOE;
  // Afstand til land (til kystlys i havet), op til 4
  const afstand = new Uint8Array(W * H).fill(9);
  let front: number[] = [];
  for (let i = 0; i < W * H; i++) if (!vand(grid[i])) {
    afstand[i] = 0;
    front.push(i);
  }
  for (let d = 1; d <= 4; d++) {
    const ny: number[] = [];
    for (const i of front) {
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny2 = y + dy;
        if (nx < 0 || ny2 < 0 || nx >= W || ny2 >= H) continue;
        const j = ny2 * W + nx;
        if (afstand[j] > d) {
          afstand[j] = d;
          ny.push(j);
        }
      }
    }
    front = ny;
  }
  // Regioner: midtpunkt, antal og omrids (pixels lige udenfor regionen)
  const regioner = {} as Record<MarketId, Region>;
  for (const m of MARKET_IDS) {
    const kode = markedKode(m);
    let sx = 0;
    let sy = 0;
    let n = 0;
    const omrids: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (grid[i] === kode) {
          sx += x;
          sy += y;
          n++;
          continue;
        }
        const nabo = (x > 0 && grid[i - 1] === kode) || (x < W - 1 && grid[i + 1] === kode) || (y > 0 && grid[i - W] === kode) || (y < H - 1 && grid[i + W] === kode);
        if (nabo) omrids.push(x, y);
      }
    }
    regioner[m] = { boks: hovedBoks[m] ?? { x0: 0, y0: 0, w: 1, h: 1 }, midt: n ? [sx / n, sy / n] : MAERKE[m], omrids: Int16Array.from(omrids), antal: n };
  }
  // Bølger: små streger i åbent hav
  const boelger: number[] = [];
  let seed = 7;
  for (let t = 0; t < 400 && boelger.length < 72; t++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const x = seed % (W - 6);
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const y = seed % H;
    const i = y * W + x;
    if (grid[i] !== SOE || afstand[i] < 4 || afstand[i + 3] < 4) continue;
    if (x >= INDSAT.x - 2 && x <= INDSAT.x + INDSAT.w + 2 && y >= INDSAT.y - 2) continue;
    if (x < 112 && y < 34) continue; // titelfeltet
    if (x >= OE.x - 4 && x <= OE.x + OE.w + 4 && y >= OE.y - 6 && y <= OE.y + OE.h + 10) continue;
    boelger.push(x, y);
  }
  return { grid, afstand, regioner, boelger: Int16Array.from(boelger) };
}

function grund(): NonNullable<typeof GRUND> {
  if (!GRUND) GRUND = bygGrund();
  return GRUND;
}

export class MarkedKortRenderer {
  private ctx: CanvasRenderingContext2D;
  private terraen = lavCanvas(KORT_W, KORT_H);
  private terraenNoegle = '';
  private raf = 0;
  private koerer = false;
  private ro: ResizeObserver | null = null;
  private data: KortData | null = null;
  private reduceret = false;
  private hover: KortKlik | null = null;
  private skitse = true;
  private sidst = 0;
  private skala = 1; // mærke- og tekstskala (2 på smalle skærme, så det kan læses)
  private cssPrPx = 1;
  private start0 = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    private boks: HTMLElement,
    private onKlik: (k: KortKlik) => void,
  ) {
    canvas.width = KORT_W;
    canvas.height = KORT_H;
    this.ctx = ctx2d(canvas);
  }

  start(): void {
    if (this.koerer) return;
    this.koerer = true;
    this.ro = new ResizeObserver(() => this.tilpas());
    this.ro.observe(this.boks);
    this.tilpas();
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('click', this.onClickEv);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.koerer = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('click', this.onClickEv);
  }

  saetData(d: KortData): void {
    this.data = d;
    this.skitse = true;
  }

  saetReduceret(r: boolean): void {
    this.reduceret = r;
    this.skitse = true;
  }

  // ---------- Størrelse: 16:9, heltalsskalering når muligt ----------
  private tilpas(): void {
    const r = this.boks.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.min((r.width * dpr) / KORT_W, (r.height * dpr) / KORT_H);
    const hel = Math.floor(s);
    const skala = hel >= 2 && hel / s >= 0.9 ? hel : s;
    const cssW = Math.round(KORT_W * skala) / dpr;
    const cssH = Math.round(KORT_H * skala) / dpr;
    const st = this.canvas.style;
    st.width = `${cssW}px`;
    st.height = `${cssH}px`;
    st.left = `${Math.round(((r.width - cssW) / 2) * dpr) / dpr}px`;
    st.top = `${Math.round(((r.height - cssH) / 2) * dpr) / dpr}px`;
    this.cssPrPx = cssW / KORT_W;
    const ny = this.cssPrPx < 1.45 ? 2 : 1;
    if (ny !== this.skala) this.skala = ny;
    this.skitse = true;
  }

  // ---------- Input ----------
  private logisk(e: PointerEvent | MouseEvent): Pkt {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * KORT_W, ((e.clientY - r.top) / r.height) * KORT_H];
  }

  private maerkeMidt(m: MarketId): Pkt {
    return (this.skala === 2 ? MAERKE_STOR[m] : undefined) ?? MAERKE[m];
  }

  private maerkeRekt(m: MarketId): { x: number; y: number; w: number; h: number } {
    const b = 10 * this.skala;
    const [cx, cy] = this.maerkeMidt(m);
    return { x: Math.round(cx - b / 2), y: Math.round(cy - b / 2), w: b, h: b };
  }

  private ramt(lx: number, ly: number): KortKlik | null {
    for (const m of MARKET_IDS) {
      const r = this.maerkeRekt(m);
      if (lx >= r.x - 2 && lx <= r.x + r.w + 2 && ly >= r.y - 2 && ly <= r.y + r.h + 2) return m;
    }
    if (lx >= OE.x - 3 && lx <= OE.x + OE.w + 3 && ly >= OE.y - 8 && ly <= OE.y + OE.h + 10) return 'offshore';
    const g = grund().grid;
    const x = Math.floor(lx);
    const y = Math.floor(ly);
    // Tolerance til fingre: kig op til 3 px væk efter det nærmeste marked
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= KORT_W || ny >= KORT_H) continue;
          const m = kodeMarked(g[ny * KORT_W + nx]);
          if (m) return m;
        }
      }
    }
    return null;
  }

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const [lx, ly] = this.logisk(e);
    const h = this.ramt(lx, ly);
    if (h !== this.hover) {
      this.hover = h;
      this.canvas.style.cursor = h ? 'pointer' : 'default';
      this.skitse = true;
    }
  };

  private readonly onLeave = () => {
    if (this.hover !== null) {
      this.hover = null;
      this.skitse = true;
    }
  };

  private readonly onClickEv = (e: MouseEvent) => {
    const [lx, ly] = this.logisk(e);
    const h = this.ramt(lx, ly);
    if (h) this.onKlik(h);
  };

  // ---------- Loop ----------
  private readonly frame = (t: number) => {
    if (!this.koerer) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.data) return;
    const anim = !this.reduceret;
    if (!this.skitse && (!anim || t - this.sidst < 90)) return;
    this.sidst = t;
    this.skitse = false;
    this.tegn(anim ? t - this.start0 : 0);
  };

  // ---------- Terræn (bygges, når status ændrer sig) ----------
  private bygTerraen(d: KortData): void {
    const noegle = MARKET_IDS.map((m) => `${d.markeder[m].status}${d.markeder[m].graa ? 'g' : ''}`).join(',') + (d.offshoreAktiv ? '|o' : '');
    if (noegle === this.terraenNoegle) return;
    this.terraenNoegle = noegle;
    const { grid, afstand, regioner } = grund();
    const W = KORT_W;
    const H = KORT_H;
    const img = new ImageData(W, H);
    const px = img.data;
    const erLand = (k: number) => k !== SOE && k !== INDSOE;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const k = grid[i];
        let c: Rgb;
        const iIndsat = x >= INDSAT.x && x < INDSAT.x + INDSAT.w && y >= INDSAT.y && y < INDSAT.y + INDSAT.h;
        if (k === SOE || k === INDSOE) {
          const a = afstand[i];
          const bund = k === INDSOE ? C.soe : iIndsat ? C.indsatHav : C.hav;
          c = a === 1 ? C.havKyst1 : a === 2 ? mix(C.havKyst2, bund, 0.2) : (x * 7 + y * 13) % 17 === 0 ? C.havPrik : bund;
          if (k === INDSOE && a === 1) c = mix(C.havKyst1, C.soe, 0.4);
        } else if (k === LAND || k === OEN) {
          c = (x * 5 + y * 11) % 7 === 0 ? C.land2 : C.land;
        } else {
          const m = kodeMarked(k)!;
          const st = d.markeder[m];
          c = statusFarve(flagFarve(m, x, y, regioner[m].boks), st.status, x, y, st.graa);
        }
        // Kyster og grænser: 1 px mørkere kant
        if (erLand(k)) {
          const hoejre = x < W - 1 ? grid[i + 1] : k;
          const under = y < H - 1 ? grid[i + W] : k;
          const venstre = x > 0 ? grid[i - 1] : k;
          const over = y > 0 ? grid[i - W] : k;
          const kyst = !erLand(hoejre) || !erLand(under) || !erLand(venstre) || !erLand(over);
          if (kyst) c = gange(c, 0.72);
          else if ((hoejre !== k && erLand(hoejre)) || (under !== k && erLand(under))) c = gange(c, 0.5);
        }
        const o = i * 4;
        px[o] = c[0];
        px[o + 1] = c[1];
        px[o + 2] = c[2];
        px[o + 3] = 255;
      }
    }
    const tctx = ctx2d(this.terraen);
    tctx.putImageData(img, 0, 0);
    // Rammen om Nordamerika
    tctx.fillStyle = T.line;
    tctx.fillRect(INDSAT.x - 1, INDSAT.y - 1, INDSAT.w + 2, 1);
    tctx.fillRect(INDSAT.x - 1, INDSAT.y + INDSAT.h, INDSAT.w + 2, 1);
    tctx.fillRect(INDSAT.x - 1, INDSAT.y - 1, 1, INDSAT.h + 2);
    tctx.fillRect(INDSAT.x + INDSAT.w, INDSAT.y - 1, 1, INDSAT.h + 2);
    tctx.fillStyle = T.hi;
    tctx.fillRect(INDSAT.x, INDSAT.y, INDSAT.w, 1);
    tctx.fillRect(INDSAT.x, INDSAT.y, 1, INDSAT.h);
    tctx.fillStyle = '#1b2240';
    tctx.fillRect(INDSAT.x + 1, INDSAT.y + 1, INDSAT.w - 1, 8);
    tegnTekst(tctx, 'NORDAMERIKA', INDSAT.x + 3, INDSAT.y + 2, T.muted);
    this.tegnOe(tctx, d.offshoreAktiv);
  }

  /** Den lille offshore-ø: palmer på en sandbanke (med sort flag, når jeres brand kører) */
  private tegnOe(c: CanvasRenderingContext2D, aktiv: boolean): void {
    const { x, y, w, h } = OE;
    c.fillStyle = '#233363';
    c.fillRect(x - 1, y + h - 5, w + 2, 4);
    c.fillStyle = '#c9b27a';
    c.fillRect(x + 2, y + h - 6, w - 4, 3);
    c.fillRect(x + 4, y + h - 7, w - 8, 1);
    c.fillStyle = '#e3cf96';
    c.fillRect(x + 6, y + h - 7, w - 14, 1);
    // Palme
    c.fillStyle = '#7a5a36';
    c.fillRect(x + 9, y + 3, 1, h - 9);
    c.fillRect(x + 10, y + 2, 1, 2);
    c.fillStyle = '#3f9a5a';
    c.fillRect(x + 6, y + 1, 4, 1);
    c.fillRect(x + 11, y + 1, 4, 1);
    c.fillRect(x + 5, y + 2, 2, 1);
    c.fillRect(x + 14, y + 2, 2, 1);
    c.fillRect(x + 8, y, 5, 1);
    // Lille hytte / flagstang
    c.fillStyle = '#5a4a3a';
    c.fillRect(x + 18, y + h - 10, 5, 3);
    c.fillStyle = '#8a6a4a';
    c.fillRect(x + 17, y + h - 11, 7, 1);
    if (aktiv) {
      c.fillStyle = '#d8d8d8';
      c.fillRect(x + 25, y + 1, 1, h - 7);
      c.fillStyle = '#15151c';
      c.fillRect(x + 26, y + 1, 5, 4);
      c.fillStyle = '#e8e8e8';
      c.fillRect(x + 28, y + 2, 1, 1);
    }
  }

  // ---------- Tegning pr. frame ----------
  private tegn(t: number): void {
    const d = this.data;
    if (!d) return;
    this.bygTerraen(d);
    const ctx = this.ctx;
    const { regioner, boelger } = grund();
    ctx.clearRect(0, 0, KORT_W, KORT_H);
    ctx.drawImage(this.terraen, 0, 0);

    // Bølger (skifter lidt frem og tilbage)
    const fase = this.reduceret ? 0 : Math.floor(t / 700) % 4;
    ctx.fillStyle = '#1c2850';
    for (let i = 0; i < boelger.length; i += 2) {
      const skub = (fase + i) % 4 < 2 ? 0 : 1;
      ctx.fillRect(boelger[i] + skub, boelger[i + 1], 3, 1);
    }

    // Omrids: hover (hvidt) og valgt (guld, "marcherende" prikker)
    if (this.hover && this.hover !== 'offshore' && this.hover !== d.valgt) this.tegnOmrids(regioner[this.hover].omrids, 'rgba(243,239,226,0.75)', null, 0);
    const trin = this.reduceret ? 0 : Math.floor(t / 110);
    this.tegnOmrids(regioner[d.valgt].omrids, T.gold, '#8a6d12', trin);

    // Streger fra mærker ude i havet ind til landet
    for (const m of ['nl', 'dk', 'no'] as MarketId[]) this.tegnStreg(this.maerkeMidt(m), ANKER[m] ?? regioner[m].midt, m === d.valgt);

    // Puls på nyåbnede markeder (en firkantet ring, der vokser og falmer)
    if (!this.reduceret) {
      const p = (t % 1600) / 1600;
      for (const m of MARKET_IDS) {
        if (!d.markeder[m].ny) continue;
        const r = this.maerkeRekt(m);
        const u = Math.round((2 + p * 9) * this.skala);
        ctx.globalAlpha = 1 - p;
        this.ring(r.x - u, r.y - u, r.w + 2 * u, r.h + 2 * u, this.skala, T.sky);
        ctx.globalAlpha = 1;
      }
    }

    // Mærker (valgt og hover til sidst, så de ligger øverst)
    const orden = MARKET_IDS.filter((m) => m !== d.valgt && m !== this.hover);
    if (this.hover && this.hover !== 'offshore' && this.hover !== d.valgt) orden.push(this.hover);
    orden.push(d.valgt);
    for (const m of orden) this.tegnMaerke(m, d.markeder[m], m === d.valgt, m === this.hover);

    // Offshore-øens etiket
    this.tegnOeEtiket(d.offshoreAktiv, this.hover === 'offshore');

    // Overskrift: valgt marked
    this.tegnOverskrift(d);
  }

  private tegnOmrids(o: Int16Array, farve: string, farve2: string | null, trin: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = farve;
    for (let i = 0; i < o.length; i += 2) {
      if (farve2 && (o[i] + o[i + 1] + trin) % 4 >= 2) continue;
      ctx.fillRect(o[i], o[i + 1], 1, 1);
    }
    if (farve2) {
      ctx.fillStyle = farve2;
      for (let i = 0; i < o.length; i += 2) if ((o[i] + o[i + 1] + trin) % 4 >= 2) ctx.fillRect(o[i], o[i + 1], 1, 1);
    }
  }

  private tegnStreg(fra: Pkt, til: Pkt, valgt: boolean): void {
    const ctx = this.ctx;
    const [x0, y0] = fra;
    const [x1, y1] = til;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.fillStyle = valgt ? T.gold : 'rgba(162,166,196,0.75)';
    for (let i = 0; i <= n; i += 2) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private ring(x: number, y: number, w: number, h: number, s: number, farve: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = farve;
    ctx.fillRect(x, y, w, s);
    ctx.fillRect(x, y + h - s, w, s);
    ctx.fillRect(x, y, s, h);
    ctx.fillRect(x + w - s, y, s, h);
  }

  private tegnMaerke(m: MarketId, km: KortMarked, valgt: boolean, hover: boolean): void {
    const ctx = this.ctx;
    const s = this.skala;
    const r = this.maerkeRekt(m);
    const farve = STATUS_FARVE[km.status];
    const bjaelke = km.status === 'aktiv' || km.status === 'suspenderet' || km.andel >= 0.0005;
    // Samlet boks: mærke + (evt.) andelsbjælke, med mørk kant og en skygge nedenunder
    const bx = r.x - s;
    const by = r.y - s;
    const bw = r.w + 2 * s;
    const bh = r.h + 2 * s + (bjaelke ? 3 * s : 0);
    ctx.fillStyle = 'rgba(11,12,22,0.55)';
    ctx.fillRect(bx + s, by + s, bw, bh);
    ctx.fillStyle = T.line;
    ctx.fillRect(bx, by, bw, bh);
    if (valgt || hover) this.ring(bx - s, by - s, bw + 2 * s, bh + 2 * s, s, valgt ? T.gold : T.ink);
    ctx.fillStyle = farve;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    tegnIkon(ctx, STATUS_IKON[km.status], r.x + s, r.y + s, s, T.line);
    // Andelsbjælke (fuld ved 25 %)
    if (bjaelke) {
      ctx.fillStyle = '#3a3f5c';
      ctx.fillRect(r.x, r.y + r.h + 2 * s, r.w, s);
      ctx.fillStyle = T.gold;
      const fyld = km.andel > 0 ? Math.max(s, Math.round(Math.min(1, km.andel / 0.25) * r.w)) : 0;
      ctx.fillRect(r.x, r.y + r.h + 2 * s, fyld, s);
    }

    // Etiket: kode + andel (til højre for mærket; til venstre, hvis der ikke er plads). På smalle skærme kun for valgt/hover.
    if (!(s === 1 || valgt || hover)) return;
    const kode = MARKETS[m].kort;
    const andelTekst = km.andel >= 0.0005 ? `${Math.round(km.andel * 1000) / 10}%`.replace('.', ',') : '';
    const tw = tekstBredde(kode, s) + (andelTekst ? tekstBredde(' ', s) + s + tekstBredde(andelTekst, s) : 0);
    const th = 5 * s;
    const venstre = bx - 3 * s - tw;
    const hoejre = bx + bw + 3 * s;
    let tx = ETIKET_VENSTRE.has(m) ? venstre : hoejre;
    if (tx + tw + 2 * s > KORT_W) tx = venstre;
    if (tx - 2 * s < 0) tx = hoejre;
    const ty = r.y + Math.round((r.h - th) / 2);
    ctx.fillStyle = 'rgba(11,12,22,0.85)';
    ctx.fillRect(tx - 2 * s, ty - 2 * s, tw + 4 * s, th + 4 * s);
    const kw = tegnTekst(ctx, kode, tx, ty, valgt ? T.gold : T.ink, s);
    if (andelTekst) tegnTekst(ctx, andelTekst, tx + kw + tekstBredde(' ', s) + s, ty, T.gold, s);
  }

  private tegnOeEtiket(aktiv: boolean, hover: boolean): void {
    const ctx = this.ctx;
    const s = this.skala;
    const tekst = aktiv ? (s === 1 ? 'JERES GRÅ BRAND' : 'GRÅT BRAND') : 'OFFSHORE';
    const tw = tekstBredde(tekst, s);
    const tx = Math.max(2 * s, Math.round(OE.x + OE.w / 2 - tw / 2));
    const ty = OE.y + OE.h + 2;
    ctx.fillStyle = 'rgba(11,12,22,0.7)';
    ctx.fillRect(tx - s, ty - s, tw + 2 * s, 5 * s + 2 * s);
    tegnTekst(ctx, tekst, tx, ty, aktiv ? T.warn : hover ? T.ink : T.dim, s);
  }

  private tegnOverskrift(d: KortData): void {
    const ctx = this.ctx;
    const m = d.valgt;
    const km = d.markeder[m];
    const navn = MARKETS[m].navn.toUpperCase();
    const s2 = 2;
    tegnTekst(ctx, navn, 7, 7, T.line, s2);
    tegnTekst(ctx, navn, 6, 6, T.gold, s2);
    const s = this.skala;
    const linje = km.andel >= 0.0005 ? `${STATUS_KORT[km.status]} · ${`${Math.round(km.andel * 1000) / 10}`.replace('.', ',')}%` : STATUS_KORT[km.status];
    tegnIkon(ctx, STATUS_IKON[km.status], 6, 20, s, STATUS_FARVE[km.status]);
    tegnTekst(ctx, linje, 6 + 10 * s, 20 + Math.round((8 * s - 5 * s) / 2), STATUS_FARVE[km.status], s);
  }
}
