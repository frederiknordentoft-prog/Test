// Rulning inde i spillets scroll-kolonner. scrollIntoView lægger overskriften helt øverst — på mobil ligger
// pausebanneret (absolut placeret) oven på toppen af kolonnen, netop når spillet står stille, og spilleren beslutter.
// Her rulles scroll-containeren selv, så målet lander lige under det, der dækker toppen.

/** Nærmeste forfader, der ruller lodret */
export function scrollForfader(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}

/** Hvor mange pixels af containerens top der er dækket af pausebanneret (0, hvis det ikke ligger over containeren) */
export function daekketTop(sc: HTMLElement): number {
  const r = sc.getBoundingClientRect();
  let d = 0;
  for (const b of document.querySelectorAll<HTMLElement>('[data-testid="pause-banner"]')) {
    const br = b.getBoundingClientRect();
    if (br.height === 0 || br.right <= r.left || br.left >= r.right) continue;
    if (br.bottom > r.top && br.top < r.top + r.height / 2) d = Math.max(d, br.bottom - r.top);
  }
  return d;
}

/** Elementets top i containerens indholdskoordinater — ud fra layoutet (offsetTop), så en igangværende
 *  pop-/glid-animation (transform) ikke snyder målingen */
function indholdsTop(el: HTMLElement, sc: HTMLElement): number {
  const docTop = (x: HTMLElement): number => {
    let y = 0;
    let n: HTMLElement | null = x;
    while (n) {
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    return y;
  };
  return docTop(el) - docTop(sc) - sc.clientTop;
}

/** Rul elementet op til toppen af sin scroll-container — under pausebanneret, hvis det dækker */
export function rulTilTop(el: HTMLElement, reduceret: boolean, luft = 8): void {
  const sc = scrollForfader(el);
  const behavior: ScrollBehavior = reduceret ? 'auto' : 'smooth';
  if (!sc) {
    el.scrollIntoView({ block: 'start', behavior });
    return;
  }
  const top = indholdsTop(el, sc) - daekketTop(sc) - luft;
  sc.scrollTo({ top: Math.max(0, top), behavior });
}

/** Rul så hele elementet er synligt i sin scroll-container (fx en bekræftelse, der foldes ud nederst) */
export function rulIndISyne(el: HTMLElement, reduceret: boolean, luft = 8): void {
  const sc = scrollForfader(el);
  const behavior: ScrollBehavior = reduceret ? 'auto' : 'smooth';
  if (!sc) {
    el.scrollIntoView({ block: 'nearest', behavior });
    return;
  }
  const top = indholdsTop(el, sc);
  const bund = top + el.offsetHeight;
  const synligTop = sc.scrollTop + daekketTop(sc) + luft;
  const synligBund = sc.scrollTop + sc.clientHeight - luft;
  let ny = sc.scrollTop;
  if (bund > synligBund) ny += bund - synligBund;
  if (top < synligTop + (ny - sc.scrollTop)) ny = top - daekketTop(sc) - luft;
  if (ny !== sc.scrollTop) sc.scrollTo({ top: Math.max(0, ny), behavior });
}
