/// <reference types="vite-plugin-pwa/vanillajs" />
// PWA og enhed (spec 4 og fase 8): service worker til offline og opdateringer, tjek af lokal lagring
// (Dexie i et privat vindue), temafarve pr. akt og vedvarende lagring på en installeret app.
// Beskederne vises af src/ui/components/PwaBeskeder.tsx — uafhængigt af spillets egne toasts, så de også ses på titelskærmen.
import { create } from 'zustand';
import { lagringVirker } from '../../store/persistence';
import { erInstalleret } from './enhed';

export type PwaBeskedKind = 'offline' | 'opdatering' | 'lagring';
export type PwaBesked = { id: number; kind: PwaBeskedKind };

/** Teksterne (korte og venlige). varigMs = null: bliver, til spilleren lukker den. */
export const PWA_BESKED: Record<PwaBeskedKind, { tekst: string; varigMs: number | null }> = {
  offline: { tekst: 'Klar til offline brug. Garagen virker nu også uden net.', varigMs: 7000 },
  opdatering: { tekst: 'Ny version klar — den bruges næste gang', varigMs: 12000 },
  lagring: {
    tekst: 'Browseren vil ikke gemme her (privat vindue?). Spil bare videre, og brug Eksportér under Gem og indlæs for at tage spillet med.',
    varigMs: null,
  },
};

type PwaStore = {
  beskeder: PwaBesked[];
  /** null = ikke tjekket endnu */
  lagringOk: boolean | null;
  vis(kind: PwaBeskedKind): void;
  luk(id: number): void;
};

let naesteId = 1;

export const usePwa = create<PwaStore>((set, get) => ({
  beskeder: [],
  lagringOk: null,
  vis(kind) {
    // Samme besked to gange (fx to opdateringer i én session): vis den kun én gang
    if (get().beskeder.some((b) => b.kind === kind)) return;
    set({ beskeder: [...get().beskeder, { id: naesteId++, kind }] });
  },
  luk(id) {
    set({ beskeder: get().beskeder.filter((b) => b.id !== id) });
  },
}));

/** Service workeren: kun i den normale produktionsbuild (ikke i dev og ikke i single-builden) */
function registrerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'single') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onOfflineReady: () => usePwa.getState().vis('offline'),
        // Ny version aktiveret i baggrunden: afbryd aldrig et spil med et reload — den nye version bruges næste gang
        onNeedReload: () => usePwa.getState().vis('opdatering'),
        onRegisteredSW: (_url, reg) => {
          if (!reg) return;
          // En app, der står åben i dagevis (fx på en iPad), kigger efter nye versioner hver time
          setInterval(() => {
            if (navigator.onLine && document.visibilityState === 'visible') void reg.update().catch(() => undefined);
          }, 60 * 60 * 1000);
        },
        onRegisterError: () => undefined, // spillet virker stadig online
      });
    })
    .catch(() => undefined);
}

/** Lokal lagring: virker den ikke, kører spillet videre uden gem og siger det én gang */
async function tjekLagring(): Promise<void> {
  const ok = await lagringVirker();
  usePwa.setState({ lagringOk: ok });
  if (!ok) {
    usePwa.getState().vis('lagring');
    return;
  }
  // Installeret app: bed om vedvarende lagring, så browseren ikke rydder de gemte spil (spørger ikke i en almindelig fane)
  if (erInstalleret()) void navigator.storage?.persist?.().catch(() => false);
}

/** <meta name="theme-color"> følger skallens baggrund pr. akt (statuslinje og titellinje på en installeret app) */
function foelgTemafarve(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta || typeof MutationObserver === 'undefined') return;
  const opdater = () => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
    if (/^#[0-9a-f]{3,8}$/i.test(bg) && meta.content !== bg) meta.content = bg;
  };
  new MutationObserver(opdater).observe(document.documentElement, { attributes: true, attributeFilter: ['data-akt'] });
  opdater();
}

let startet = false;
/** Kaldes én gang fra main.tsx */
export function startPwa(): void {
  if (startet || typeof window === 'undefined') return;
  startet = true;
  registrerServiceWorker();
  void tjekLagring();
  foelgTemafarve();
}
