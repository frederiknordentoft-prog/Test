import { create } from "zustand";
import type { EventMarker, Frame } from "../api/types";

export interface HistoryPoint {
  tick: number;
  price_index: number;
  systemic_risk: number;
  mean_sentiment: number;
  mean_stress: number;
  mean_leverage: number;
  liquidity_index: number;
  credit_tightness: number;
  bankruptcies_total: number;
  margin_calls_total: number;
  wealth_gini: number;
  employment_index: number;
  forced_volume_share: number;
  volume: number;
  spread: number;
  [assetPrice: string]: number; // p_<assetId> series
}

interface SimState {
  runId: string | null;
  label: string;
  status: string;
  tick: number;
  ticksTarget: number;
  assetIds: string[];
  history: HistoryPoint[];
  events: EventMarker[];
  lastFrame: Frame | null;
  setRun: (runId: string, label: string) => void;
  applyFrame: (f: Frame) => void;
  setEvents: (e: EventMarker[]) => void;
  clear: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  runId: null,
  label: "",
  status: "created",
  tick: 0,
  ticksTarget: 0,
  assetIds: [],
  history: [],
  events: [],
  lastFrame: null,

  setRun: (runId, label) =>
    set({ runId, label, history: [], events: [], tick: 0, status: "created", lastFrame: null }),

  applyFrame: (f) => {
    const s = get();
    const assetIds = Object.keys(f.prices);
    const point: HistoryPoint = {
      tick: f.tick,
      price_index: f.metrics.price_index ?? 100,
      systemic_risk: f.metrics.systemic_risk ?? 0,
      mean_sentiment: f.metrics.mean_sentiment ?? 0,
      mean_stress: f.metrics.mean_stress ?? 0,
      mean_leverage: f.metrics.mean_leverage ?? 0,
      liquidity_index: f.metrics.liquidity_index ?? 1,
      credit_tightness: f.metrics.credit_tightness ?? 0,
      bankruptcies_total: f.metrics.bankruptcies_total ?? 0,
      margin_calls_total: f.metrics.margin_calls_total ?? 0,
      wealth_gini: f.metrics.wealth_gini ?? 0,
      employment_index: f.metrics.employment_index ?? 1,
      forced_volume_share: f.metrics.forced_volume_share ?? 0,
      volume: Object.values(f.volume).reduce((a, b) => a + b, 0),
      spread: assetIds.length
        ? Object.values(f.spread).reduce((a, b) => a + b, 0) / assetIds.length
        : 0,
    };
    for (const [aid, p] of Object.entries(f.prices)) point[`p_${aid}`] = p;
    for (const [aid, fv] of Object.entries(f.fundamentals)) point[`f_${aid}`] = fv;

    let history = s.history;
    const last = history[history.length - 1];
    if (!last || f.tick > last.tick) history = [...history, point];
    else if (f.tick === last.tick) history = [...history.slice(0, -1), point];
    if (history.length > 3000) history = history.slice(-3000);

    set({
      lastFrame: f,
      status: f.status,
      tick: f.tick,
      ticksTarget: f.ticks_target,
      assetIds,
      history,
      events: f.new_events.length ? [...s.events, ...f.new_events] : s.events,
    });
  },

  setEvents: (e) => set({ events: e }),
  clear: () =>
    set({ runId: null, history: [], events: [], tick: 0, status: "created", lastFrame: null }),
}));
