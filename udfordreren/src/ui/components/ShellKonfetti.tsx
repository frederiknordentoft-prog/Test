// Konfetti ved fejringer (Top 10 / nr. 1). Bruger renderens pixel-konfetti (src/render/particles.ts),
// som selv respekterer reduceret bevægelse. Komponenten tegner intet selv.
import { useEffect } from 'react';
import { konfetti } from '../../render/particles';

export function Konfetti({ antal = 140, regn = false }: { antal?: number; regn?: boolean }) {
  useEffect(() => {
    konfetti({ antal });
    if (regn) {
      const t = setTimeout(() => konfetti({ antal: Math.round(antal * 0.8), regn: true }), 450);
      return () => clearTimeout(t);
    }
  }, [antal, regn]);
  return null;
}
