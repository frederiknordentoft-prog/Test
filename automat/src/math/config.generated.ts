// AUTO-GENERATED placeholder — overwritten by `node sim/tune.ts` and `node sim/run.ts`.
import type { MathConfig, MathReport } from './config.ts';

export const GENERATED_CONFIG: MathConfig = {
  cols: 6, rows: 6, stormCols: 8, stormRows: 8,
  weights: [26, 25, 23, 22, 10, 8, 6, 2.2],
  stormWeights: [26, 25, 23, 22, 10, 8, 6, 3],
  pSun: 0.069, pSunStorm: 0.06,
  paytable: [
    [0.3, 0.4, 0.5, 0.7, 1, 1.5, 3, 8],
    [0.3, 0.4, 0.5, 0.7, 1, 1.5, 3, 8],
    [0.4, 0.5, 0.6, 0.8, 1.2, 2, 4, 10],
    [0.4, 0.5, 0.7, 1, 1.5, 2.5, 5, 12],
    [0.6, 0.8, 1, 1.5, 2.5, 4, 10, 40],
    [0.8, 1, 1.5, 2, 3, 6, 15, 80],
    [1.5, 2, 3, 5, 8, 15, 40, 200],
  ],
  payScale: 2, stormPayScale: 1,
  K: 12000,
  baseMarkCap: 32, stormMarkCap: 128,
  stormSpins: 10, stormStartMarks: 6, retriggerSpins: 3, maxStormSpins: 20,
  guaranteeX: 30, maxWinX: 10000, sunPayX: 3, sunCharge: 150,
  stakesOre: [50, 100, 200, 400, 600, 1000, 2000, 5000, 10000],
  defaultStakeOre: 200,
  modelHash: 'untuned',
};

export const GENERATED_REPORT: MathReport = {
  rtp: 0.96, rtpMin: 0.865, meterShare: 0.093, hitRate: 0.44, netWinRate: 0.26, ldwShareOfHits: 0.4,
  stormRate: 1 / 1330, routeARate: 1 / 2200, routeBRate: 1 / 3300, avgSpinsToKp9: 2200,
  stormMeanX: 200, stormP10X: 20, stormP50X: 120, stormP90X: 450, stormP99X: 1500,
  guaranteeUseRate: 0.15, baseSdX: 3, blendedSdX: 12,
  perStormSpinRtp: 20, baseSpinRtp: 0.81,
  kpMedianSpins: [10, 30, 70, 140, 250, 420, 680, 1200, 2200],
  spinsSimulated: 0, stormsSimulated: 0, variants: [],
  rtpCi95: 0, clusterRtp: 0.79, sunRtp: 0.016, perkRtp: 0.001, stormARtp: 0.09, stormBRtp: 0.06,
  avgChargePerSpin: 5.5, kpMeanSpins: [10, 30, 70, 140, 250, 420, 680, 1200, 2200],
  minWinX: 0.6, capHitRate: 0, guaranteeCostShare: 0.01, baseP99X: 20, blendedP99X: 25,
  modelHash: 'untuned', generatedAt: 'placeholder',
};
