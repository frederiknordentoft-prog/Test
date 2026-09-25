// Vandrette rækker med skjult scrollbar (pille-navigation, filtre): ton kanten ud, så man kan se, at der er mere.
// Bruges som callback-ref (`ref={rulleKant}`). React 19 kalder den returnerede oprydning, når elementet forsvinder.
// Ingen React-state: masken sættes direkte på elementet, når der rulles, eller størrelsen ændres.

const FADE = '28px';

function maske(el: HTMLElement): string {
  const venstre = el.scrollLeft > 2;
  const hoejre = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
  if (!venstre && !hoejre) return '';
  const start = venstre ? `transparent, #000 ${FADE}` : '#000';
  const slut = hoejre ? `#000 calc(100% - ${FADE}), transparent` : '#000';
  return `linear-gradient(to right, ${start}, ${slut})`;
}

export function rulleKant(el: HTMLElement | null): (() => void) | undefined {
  if (!el) return undefined;
  const opdater = () => {
    const m = maske(el);
    el.style.maskImage = m;
    el.style.setProperty('-webkit-mask-image', m);
  };
  opdater();
  el.addEventListener('scroll', opdater, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(opdater) : null;
  ro?.observe(el);
  for (const c of Array.from(el.children)) ro?.observe(c);
  return () => {
    el.removeEventListener('scroll', opdater);
    ro?.disconnect();
  };
}
