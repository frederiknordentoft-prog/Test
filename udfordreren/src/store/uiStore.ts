// UI-tilstand, der ikke hører til simulationen: valgt fane, brugeråbnede dialoger, valgt projekt m.m.
import { create } from 'zustand';

/** Brugeråbnede dialoger. Tilføj nye typer her og i src/ui/dialogs/registry.tsx. */
export type UiDialog =
  | { kind: 'nytProdukt'; efterfoelgerAf?: string }
  | { kind: 'tildel'; projectId: string }
  | { kind: 'gemIndlaes' }
  | { kind: 'indstillinger' }
  | { kind: 'debug' }
  | { kind: 'produkt'; productId: string }
  | { kind: 'medarbejder'; staffId: string };

export type PanelId = 'projekter' | 'personale' | 'kontrakter' | 'hitliste' | 'produkter' | 'marked' | 'kombinationer' | 'firma' | 'nyheder';

type UiStore = {
  panel: PanelId;
  dialog: UiDialog | null;
  /** Knuds råd, som spilleren har lukket (id → spiluge). De vender tilbage efter et stykke tid, hvis de stadig gælder. */
  afvisteTips: Record<string, number>;
  setPanel(p: PanelId): void;
  aabn(d: UiDialog): void;
  luk(): void;
  afvisTip(id: string, uge: number): void;
};

export const useUi = create<UiStore>((set) => ({
  panel: 'projekter',
  dialog: null,
  afvisteTips: {},
  setPanel: (panel) => set({ panel }),
  aabn: (dialog) => set({ dialog }),
  luk: () => set({ dialog: null }),
  afvisTip: (id, uge) => set((s) => ({ afvisteTips: { ...s.afvisteTips, [id]: uge } })),
}));

export const erDebug = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
};
