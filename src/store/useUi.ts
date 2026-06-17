// UI-state der ikke hører til datalaget: åbne modaler/editorer.

import { create } from 'zustand';
import type { Initiative, KeyResult, Level, Objective } from '../types/domain';

export type ObjectiveDraft = Partial<Objective> & { level: Level };
export type KrDraft = Partial<KeyResult> & { objectiveId: string };
export type InitiativeDraft = Partial<Initiative> & { keyResultId: string };

interface UiState {
  checkInKrId: string | null;
  objectiveEditor: ObjectiveDraft | null;
  krEditor: KrDraft | null;
  initiativeEditor: InitiativeDraft | null;
  alignKrId: string | null;

  openCheckIn: (krId: string) => void;
  closeCheckIn: () => void;
  openObjectiveEditor: (draft: ObjectiveDraft) => void;
  closeObjectiveEditor: () => void;
  openKrEditor: (draft: KrDraft) => void;
  closeKrEditor: () => void;
  openInitiativeEditor: (draft: InitiativeDraft) => void;
  closeInitiativeEditor: () => void;
  openAlign: (krId: string) => void;
  closeAlign: () => void;
}

export const useUi = create<UiState>((set) => ({
  checkInKrId: null,
  objectiveEditor: null,
  krEditor: null,
  initiativeEditor: null,
  alignKrId: null,

  openCheckIn: (krId) => set({ checkInKrId: krId }),
  closeCheckIn: () => set({ checkInKrId: null }),
  openObjectiveEditor: (draft) => set({ objectiveEditor: draft }),
  closeObjectiveEditor: () => set({ objectiveEditor: null }),
  openKrEditor: (draft) => set({ krEditor: draft }),
  closeKrEditor: () => set({ krEditor: null }),
  openInitiativeEditor: (draft) => set({ initiativeEditor: draft }),
  closeInitiativeEditor: () => set({ initiativeEditor: null }),
  openAlign: (krId) => set({ alignKrId: krId }),
  closeAlign: () => set({ alignKrId: null }),
}));
