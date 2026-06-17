// UI-state der ikke hører til datalaget: åbne modaler/editorer/paletter.

import { create } from 'zustand';
import type { Initiative, KeyResult, Level, Objective } from '../types/domain';

export type ObjectiveDraft = Partial<Objective> & { level: Level };
export type KrDraft = Partial<KeyResult> & { objectiveId: string };
export type InitiativeDraft = Partial<Initiative> & { keyResultId: string };

interface UiState {
  // Check-in (med kø-understøttelse til ugens check-in)
  checkInKrId: string | null;
  checkInQueue: string[];
  checkInQueuePos: number;

  objectiveEditor: ObjectiveDraft | null;
  krEditor: KrDraft | null;
  initiativeEditor: InitiativeDraft | null;
  alignKrId: string | null;
  commandOpen: boolean;
  cycleModalOpen: boolean;

  openCheckIn: (krId: string) => void;
  startCheckInQueue: (krIds: string[]) => void;
  nextCheckIn: () => void;
  closeCheckIn: () => void;

  openObjectiveEditor: (draft: ObjectiveDraft) => void;
  closeObjectiveEditor: () => void;
  openKrEditor: (draft: KrDraft) => void;
  closeKrEditor: () => void;
  openInitiativeEditor: (draft: InitiativeDraft) => void;
  closeInitiativeEditor: () => void;
  openAlign: (krId: string) => void;
  closeAlign: () => void;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;
  openCycleModal: () => void;
  closeCycleModal: () => void;
}

export const useUi = create<UiState>((set, get) => ({
  checkInKrId: null,
  checkInQueue: [],
  checkInQueuePos: 0,
  objectiveEditor: null,
  krEditor: null,
  initiativeEditor: null,
  alignKrId: null,
  commandOpen: false,
  cycleModalOpen: false,

  openCheckIn: (krId) => set({ checkInKrId: krId, checkInQueue: [krId], checkInQueuePos: 0 }),
  startCheckInQueue: (krIds) =>
    set({
      checkInQueue: krIds,
      checkInQueuePos: 0,
      checkInKrId: krIds[0] ?? null,
    }),
  nextCheckIn: () => {
    const { checkInQueue, checkInQueuePos } = get();
    const nextPos = checkInQueuePos + 1;
    if (nextPos < checkInQueue.length) {
      set({ checkInQueuePos: nextPos, checkInKrId: checkInQueue[nextPos] });
    } else {
      set({ checkInKrId: null, checkInQueue: [], checkInQueuePos: 0 });
    }
  },
  closeCheckIn: () => set({ checkInKrId: null, checkInQueue: [], checkInQueuePos: 0 }),

  openObjectiveEditor: (draft) => set({ objectiveEditor: draft }),
  closeObjectiveEditor: () => set({ objectiveEditor: null }),
  openKrEditor: (draft) => set({ krEditor: draft }),
  closeKrEditor: () => set({ krEditor: null }),
  openInitiativeEditor: (draft) => set({ initiativeEditor: draft }),
  closeInitiativeEditor: () => set({ initiativeEditor: null }),
  openAlign: (krId) => set({ alignKrId: krId }),
  closeAlign: () => set({ alignKrId: null }),
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
  openCycleModal: () => set({ cycleModalOpen: true }),
  closeCycleModal: () => set({ cycleModalOpen: false }),
}));
