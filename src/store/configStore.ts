// ============================================================
// Tunable configuration store. Every economic / gameplay knob
// lives here and is editable live from the control panel.
// Persisted to localStorage so tuning survives reloads.
// ============================================================

import { create } from 'zustand';
import { DEFAULT_PAYTABLE_SOLVABLE, DEFAULT_PAYTABLE_MIX, Paytable } from '../economy/paytable';
import { DEFAULT_PROGRESS } from '../economy/progress';
import { DEFAULT_JACKPOT_CONFIG, JackpotConfig, JackpotModel } from '../economy/jackpot';

export interface Config {
  stake: number;
  // Each mode keeps its own table; the active one is chosen by `solvableOnly`.
  paytableSolvable: Paytable;
  paytableMix: Paytable;
  solvableOnly: boolean;
  maxRounds: number; // 0 = unlimited
  undoPenalty: boolean; // undo costs a round
  // progress payout (unsolved games)
  progressThreshold: number;
  progressMax: number;
  progressExponent: number;
  jackpot: JackpotConfig;
  // solver budgets (nodes)
  genNodeBudget: number; // deal classification / verification
  hintNodeBudget: number;
  benchNodeBudget: number; // optimal benchmark (proven minRounds)
  poolTarget: number;
}

export const DEFAULT_CONFIG: Config = {
  stake: 10,
  paytableSolvable: { ...DEFAULT_PAYTABLE_SOLVABLE },
  paytableMix: { ...DEFAULT_PAYTABLE_MIX },
  solvableOnly: false, // default: natural mix
  maxRounds: 0,
  undoPenalty: false,
  progressThreshold: DEFAULT_PROGRESS.progressThreshold,
  progressMax: DEFAULT_PROGRESS.progressMax,
  progressExponent: DEFAULT_PROGRESS.progressExponent,
  jackpot: { ...DEFAULT_JACKPOT_CONFIG },
  genNodeBudget: 400_000,
  hintNodeBudget: 150_000,
  benchNodeBudget: 800_000,
  poolTarget: 16,
};

/** The paytable currently in effect, based on the active mode. */
export function activePaytable(c: {
  solvableOnly: boolean;
  paytableSolvable: Paytable;
  paytableMix: Paytable;
}): Paytable {
  return c.solvableOnly ? c.paytableSolvable : c.paytableMix;
}

const STORAGE_KEY = 'kabale.config.v2';

function load(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Config>;
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        paytableSolvable: { ...DEFAULT_CONFIG.paytableSolvable, ...parsed.paytableSolvable },
        paytableMix: { ...DEFAULT_CONFIG.paytableMix, ...parsed.paytableMix },
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
      // Edit the table for the currently active mode.
      const c = get();
      if (c.solvableOnly) {
        set({ paytableSolvable: { ...c.paytableSolvable, [bucket]: value } });
      } else {
        set({ paytableMix: { ...c.paytableMix, [bucket]: value } });
      }
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
