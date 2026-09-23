// ============================================================
// NORDLYS · math configuration. Re-exports the tuned values from config.generated.ts
// (written by `node sim/tune.ts` / `node sim/run.ts` — do not hand-edit the generated file).
// ============================================================
import { GENERATED_CONFIG, GENERATED_REPORT } from './config.generated.ts';

export interface MathConfig {
  cols: number; rows: number; stormCols: number; stormRows: number;
  weights: number[];            // base weights per Sym 0..7 (no SUN)
  stormWeights: number[];
  pSun: number; pSunStorm: number;
  paytable: number[][];         // [sym 0..6][bucket 0..7] × stake, buckets: 5,6,7,8,9-10,11-12,13-15,16+
  payScale: number; stormPayScale: number;
  K: number;                    // charge to Kp 9
  baseMarkCap: number;          // 32
  stormMarkCap: number;         // 128
  stormSpins: number;           // 10
  stormStartMarks: number;      // 6
  retriggerSpins: number;       // 3
  maxStormSpins: number;        // 20
  guaranteeX: number;           // 30
  maxWinX: number;              // 10000
  sunPayX: number;              // 3
  sunCharge: number;            // 150
  stakesOre: number[];          // [50,100,200,400,600,1000,2000,5000,10000]
  defaultStakeOre: number;      // 200
  modelHash: string;
}

export interface MathReport {
  rtp: number; rtpMin: number; meterShare: number; hitRate: number; netWinRate: number; ldwShareOfHits: number;
  stormRate: number;            // storms per paid spin (A+B)
  routeARate: number; routeBRate: number; avgSpinsToKp9: number;
  stormMeanX: number; stormP10X: number; stormP50X: number; stormP90X: number; stormP99X: number;
  guaranteeUseRate: number; baseSdX: number; blendedSdX: number;
  perStormSpinRtp: number;      // ≈ 20 (=2000 %)
  baseSpinRtp: number;          // base-only RTP incl. suns (≈ 0.81)
  kpMedianSpins: number[];      // median spins to reach Kp 1..9
  spinsSimulated: number; stormsSimulated: number; variants: { rtp: number; payScale: number; stormPayScale: number }[];
  // ---- extras (not in the minimal contract, safe to ignore) ----
  rtpCi95: number;              // ± half-width (fraction) of the 95 % CI on rtp
  clusterRtp: number;           // base cluster wins only
  sunRtp: number;               // 3-sun pays
  perkRtp: number;              // "Ladet spin" contribution
  stormARtp: number; stormBRtp: number;
  avgChargePerSpin: number;
  kpMeanSpins: number[];        // mean spins to reach Kp 1..9
  minWinX: number;              // smallest possible single-cluster win (× stake)
  capHitRate: number;           // storms hitting the max-win cap
  guaranteeCostShare: number;   // guarantee EV / storm EV
  baseP99X: number; blendedP99X: number;
  // ---- Terningen (dice meta-game; status only, no effect on any value above) ----
  diceRate: number;             // dice per PAID spin, incl. its Ladede spin and storm spins
  diceRateBase: number;         // same, base + Ladet spin dice only
  diceStormShare: number;       // share of dice from storm spins
  diceP1: number;               // P(a paid spin yields ≥ 1 die)
  diceFirstMedian: number;      // ceil(ln 0,5 / ln(1 − diceP1)) paid spins
  dice1948Spins: number; dice1948SpinsP5: number; dice1948SpinsP95: number;   // paid spins to 1948 dice
  dice1948LossX: number; dice1948LossP5X: number; dice1948LossP95X: number;   // net loss over the journey, × stake
  dice1948LossShare: number;    // share of journeys ending with a net loss
  diceJourneys: number;         // journeys simulated (fresh players, meter 0, constant stake)
  modelHash: string;
  generatedAt: string;
}

export const CONFIG: MathConfig = GENERATED_CONFIG;
export const REPORT: MathReport = GENERATED_REPORT;
