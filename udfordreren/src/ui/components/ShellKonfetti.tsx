// Konfetti ved fejringer (Top 10 / nr. 1, slutskærmen …). Bruger renderens pixel-konfetti (src/render/particles.ts),
// som selv respekterer reduceret bevægelse. Komponenten tegner intet selv (kun et usynligt anker).
// Konfettien ligger over dialogen, så den må ikke skjule indholdet: på smalle skærme sprøjter den fra toppen (over
// titlen), og så snart spilleren ruller i dialogen, falmer den ud.
import { useEffect, useRef } from 'react';
import { fadeKonfetti, konfetti } from '../../render/particles';

/** Smal skærm (mobil portræt): dialogen fylder næsten hele skærmen */
function smalSkaerm(): boolean {
  try {
    return window.matchMedia('(max-width: 639px)').matches;
  } catch {
    return false;
  }
}

/** Nærmeste forfader, der kan rulle lodret (dialogens krop) */
function rulleForfader(el: Element | null): Element | null {
  for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if (o === 'auto' || o === 'scroll') return e;
  }
  return null;
}

export function Konfetti({ antal = 140, regn = false }: { antal?: number; regn?: boolean }) {
  const anker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const smal = smalSkaerm();
    // Mobil: færre stykker, sprøjtet fra toppen, så de hurtigt er forbi indholdet
    const n = smal ? Math.round(antal * 0.6) : antal;
    konfetti(smal ? { antal: n, y: 0.1, kraft: 0.8 } : { antal: n });
    let t: ReturnType<typeof setTimeout> | undefined;
    if (regn && !smal) t = setTimeout(() => konfetti({ antal: Math.round(antal * 0.8), regn: true }), 450);
    // Rul i dialogen (eller et tryk og træk på mobil): konfettien falmer ud, så teksten kan læses
    const rul = rulleForfader(anker.current);
    const falm = () => {
      fadeKonfetti();
      if (t) clearTimeout(t);
    };
    rul?.addEventListener('scroll', falm, { passive: true });
    if (smal) window.addEventListener('touchmove', falm, { passive: true });
    return () => {
      if (t) clearTimeout(t);
      rul?.removeEventListener('scroll', falm);
      window.removeEventListener('touchmove', falm);
    };
  }, [antal, regn]);
  return <span ref={anker} hidden aria-hidden />;
}
