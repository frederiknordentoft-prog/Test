// Integration: alle paneler og signal-dialoger fra fase 1-6 er registreret, og fanebjælken kender dem alle.
import { describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import type { Signal } from '../../src/sim/types';
import type { PanelId, UiDialog } from '../../src/store/uiStore';
import { DIALOG_SIGNALER } from '../../src/sim/signals';

/** Typen tvinger listen til at matche PanelId præcis (et nyt PanelId uden en række her giver en typefejl) */
const ALLE_PANELER: Record<PanelId, true> = {
  projekter: true, personale: true, kontrakter: true, hitliste: true, produkter: true, marked: true, kombinationer: true, firma: true,
  nyheder: true, ailab: true, konkurrenter: true, platform: true, arkiv: true, by: true,
};
const ALLE_UI_DIALOGER: Record<UiDialog['kind'], true> = {
  nytProdukt: true, tildel: true, gemIndlaes: true, indstillinger: true, debug: true, produkt: true, medarbejder: true, arkiv: true,
};

type Registry = {
  SIGNAL_DIALOGER: Partial<Record<Signal['k'], ComponentType<unknown>>>;
  UI_DIALOGER: Record<string, ComponentType<unknown>>;
};
type Paneler = { PANELER: { id: PanelId; navn: string; ikon: string; komponent: ComponentType }[] };

// .tsx-filerne hentes dynamisk (tsconfig.node.json oversætter ikke JSX); vitest klarer dem selv
const hent = async <T,>(sti: string): Promise<T> => (await import(/* @vite-ignore */ sti)) as T;

describe('registrering af paneler og dialoger', () => {
  it('hver signal-dialog fra sim-kernen har en dialog i registeret', async () => {
    const { SIGNAL_DIALOGER } = await hent<Registry>('../../src/ui/dialogs/registry.tsx');
    const mangler = DIALOG_SIGNALER.filter((k) => !SIGNAL_DIALOGER[k]);
    expect(mangler).toEqual([]);
    for (const k of ['tilbud', 'sponsorAuktion', 'reaktion', 'aktSkift', 'verdensNyhed', 'slut'] as const) expect(SIGNAL_DIALOGER[k], k).toBeTruthy();
  });

  it('hver brugeråbnet dialog har en komponent', async () => {
    const { UI_DIALOGER } = await hent<Registry>('../../src/ui/dialogs/registry.tsx');
    expect(Object.keys(UI_DIALOGER).sort()).toEqual(Object.keys(ALLE_UI_DIALOGER).sort());
  });

  it('fanebjælken har præcis ét panel pr. PanelId', async () => {
    const { PANELER } = await hent<Paneler>('../../src/ui/panels/index.ts');
    const ids = PANELER.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(ALLE_PANELER).sort());
    for (const p of PANELER) {
      expect(p.navn.length, p.id).toBeGreaterThan(0);
      expect(typeof p.komponent, p.id).toBe('function');
    }
  });
});
