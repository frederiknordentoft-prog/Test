// Små beskeder fra PWA-laget: klar til offline, ny version hentet, og "gem virker ikke her" (privat vindue).
// Monteres ved siden af <App/> i main.tsx, så de ses både på titelskærmen og i spillet.
// Placering: nederst til venstre på brede skærme (spillets egne toasts ligger til højre), over fanebjælken på mobil.
// Mens en dialog er åben, venter beskederne (de må ikke dække dialogens knapper; Gem og indlæs viser selv lagringsadvarslen).
import { useEffect, useState } from 'react';
import { PWA_BESKED, usePwa, type PwaBesked } from '../lib/pwa';
import { Ikon, type IkonNavn } from './kit';

const STIL: Record<PwaBesked['kind'], { ikon: IkonNavn; bg: string }> = {
  offline: { ikon: 'flueben', bg: 'var(--color-good)' },
  opdatering: { ikon: 'download', bg: 'var(--color-cyan)' },
  lagring: { ikon: 'advarsel', bg: 'var(--color-warn)' },
};

function Kort({ b }: { b: PwaBesked }) {
  const luk = usePwa((s) => s.luk);
  const { tekst, varigMs } = PWA_BESKED[b.kind];
  useEffect(() => {
    if (varigMs === null) return;
    const t = setTimeout(() => luk(b.id), varigMs);
    return () => clearTimeout(t);
  }, [b.id, varigMs, luk]);
  const s = STIL[b.kind];
  return (
    <div
      className="anim-glid pointer-events-auto flex w-full items-center gap-2 rounded-md border-2 border-line py-0.5 pr-0.5 pl-3 text-left text-sm font-bold text-line pixel-skygge bred:w-auto bred:max-w-[min(420px,calc(100vw-24px))]"
      style={{ background: s.bg }}
      role={b.kind === 'lagring' ? 'alert' : 'status'}
      data-testid={`pwa-${b.kind}`}
    >
      <Ikon navn={s.ikon} farve="var(--color-line)" indre={s.bg} str={16} className="shrink-0" />
      <span className="min-w-0 flex-1 py-1.5 leading-snug">{tekst}</span>
      <button
        type="button"
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded"
        onClick={() => luk(b.id)}
        aria-label="Luk besked"
        data-testid={`pwa-${b.kind}-luk`}
      >
        <Ikon navn="kryds" farve="var(--color-line)" str={12} />
      </button>
    </div>
  );
}

const modalFindes = (): boolean => document.querySelector('[aria-modal="true"]') !== null;

/** Er en modal dialog åben? (kigger kun efter tilføjede/fjernede elementer, ikke hver tekstændring) */
function useModalAaben(): boolean {
  const [aaben, setAaben] = useState(modalFindes);
  useEffect(() => {
    const obs = new MutationObserver(() => setAaben(modalFindes()));
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return aaben;
}

function Liste({ beskeder }: { beskeder: PwaBesked[] }) {
  const modal = useModalAaben();
  if (modal) return null;
  return (
    <div
      className="pointer-events-none fixed right-3 bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 z-[65] flex flex-col items-stretch gap-2 bred:right-auto bred:bottom-[max(12px,env(safe-area-inset-bottom))] bred:left-[max(12px,env(safe-area-inset-left))] bred:items-start"
      aria-live="polite"
      data-testid="pwa-beskeder"
    >
      {beskeder.map((b) => (
        <Kort key={b.id} b={b} />
      ))}
    </div>
  );
}

export default function PwaBeskeder() {
  const beskeder = usePwa((s) => s.beskeder);
  return beskeder.length === 0 ? null : <Liste beskeder={beskeder} />;
}
