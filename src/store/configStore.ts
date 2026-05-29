// ============================================================
// Tunable configuration store. Every economic / gameplay knob
// lives here and is editable live from the control panel.
// Persisted to localStorage so tuning survives reloads.
// ============================================================

import { create } from 'zustand';
import { DEFAULT_PAYTABLE, Paytable } from '../economy/paytable';
import { DEFAULT_JACKPOT_CONFIG, JackpotConfig, JackpotModel } from '../economy/jackpot';

export interface Config {
  stake: number;
  paytable: Paytable;
  solvableOnly: boolean;
  maxRounds: number; // 0 = unlimited
  undoPenalty: boolean; // undo costs a round
  jackpot: JackpotConfig;
  // solver budgets (nodes)
  genNodeBudget: number; // deal verification
  hintNodeBudget: number;
  benchNodeBudget: number; // optimal benchmark
  poolTarget: number;
}

export const DEFAULT_CONFIG: Config = {
  stake: 10,
  paytable: { ...DEFAULT_PAYTABLE },
  solvableOnly: true,
  maxRounds: 0,
  undoPenalty: false,
  jackpot: { ...DEFAULT_JACKPOT_CONFIG },
  genNodeBudget: 150_000,
  hintNodeBudget: 60_000,
  benchNodeBudget: 300_000,
  poolTarget: 24,
};

const STORAGE_KEY = 'kabale.config.v1';

function load(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Config>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        paytable: { ...DEFAULT_CONFIG.paytable, ...parsed.paytable },
        jackpot: { ...DEFAULT_CONFIG.jackpot, ...parsed.jackpot },
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

interface ConfigStore extends Config {
  set<K extends keyof Config>(key: K, value: Config[K]): void;
  setPaytable(bucket: keyof Paytable, value: number): void;
  setJackpot<K extends keyof JackpotConfig>(key: K, value: JackpotConfig[K]): void;
  setJackpotModel(model: JackpotModel): void;
  resetToDefaults(): void;
}

export const useConfig = create<ConfigStore>((set, get) => {
  const persist = () => {
    const { set: _s, setPaytable, setJackpot, setJackpotModel, resetToDefaults, ...cfg } = get();
    void _s;
    void setPaytable;
    void setJackpot;
    void setJackpotModel;
    void resetToDefaults;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
  };

  return {
    ...load(),
    set(key, value) {
      set({ [key]: value } as Partial<ConfigStore>);
      persist();
    },
    setPaytable(bucket, value) {
      set({ paytable: { ...get().paytable, [bucket]: value } });
      persist();
    },
    setJackpot(key, value) {
      set({ jackpot: { ...get().jackpot, [key]: value } });
      persist();
    },
    setJackpotModel(model) {
      set({ jackpot: { ...get().jackpot, model } });
      persist();
    },
    resetToDefaults() {
      set({ ...DEFAULT_CONFIG });
      persist();
    },
  };
});
