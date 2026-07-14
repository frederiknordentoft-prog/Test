import { useEffect, useReducer } from 'react';
import type { PlanInput, MilestoneId } from '../lib/schedule';
import { loadPlan, savePlan, clearPlan, type PersistedPlan } from '../lib/storage';

export interface PlanState {
  input: PlanInput | null; // null → show the wizard
  doneIds: MilestoneId[];
  createdAt: number;
}

export type PlanAction =
  | { type: 'create'; input: PlanInput }
  | { type: 'setFinish'; finishAt: number }
  | { type: 'delay'; id: MilestoneId; minutes: number }
  | { type: 'toggleDone'; id: MilestoneId }
  | { type: 'reset' };

function reducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'create':
      return { input: action.input, doneIds: [], createdAt: Date.now() };

    case 'setFinish': {
      if (!state.input) return state;
      // Re-target: recompute the whole plan cleanly for the new finish time.
      return { ...state, input: { ...state.input, finishAt: action.finishAt, delays: {} } };
    }

    case 'delay': {
      if (!state.input) return state;
      const prev = state.input.delays[action.id] ?? 0;
      // Delaying step k ≡ grow gap[k] AND push finishAt — a single backward
      // recompute then pins earlier steps and shifts k..end (incl. finish).
      return {
        ...state,
        input: {
          ...state.input,
          finishAt: state.input.finishAt + action.minutes * 60000,
          delays: { ...state.input.delays, [action.id]: prev + action.minutes },
        },
      };
    }

    case 'toggleDone': {
      const has = state.doneIds.includes(action.id);
      return {
        ...state,
        doneIds: has
          ? state.doneIds.filter((d) => d !== action.id)
          : [...state.doneIds, action.id],
      };
    }

    case 'reset':
      return { input: null, doneIds: [], createdAt: 0 };
  }
}

function init(): PlanState {
  const p = loadPlan();
  if (p) return { input: p.input, doneIds: p.doneIds, createdAt: p.createdAt };
  return { input: null, doneIds: [], createdAt: 0 };
}

export function usePlan() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    if (state.input) {
      const persisted: PersistedPlan = {
        v: 1,
        input: state.input,
        doneIds: state.doneIds,
        createdAt: state.createdAt || Date.now(),
      };
      savePlan(persisted);
    } else {
      clearPlan();
    }
  }, [state]);

  return { state, dispatch };
}
