/** Tiny DOM helpers for the HUD. No framework: elements are built once and then only mutated. */

export type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const c of children) if (c) node.append(c);
  return node;
}

export function attr<T extends Element>(node: T, attrs: Record<string, string | number | boolean | null | undefined>): T {
  for (const key in attrs) {
    const v = attrs[key];
    if (v === null || v === undefined || v === false) node.removeAttribute(key);
    else node.setAttribute(key, v === true ? '' : String(v));
  }
  return node;
}

/**
 * Wrap static SVG markup from icons.ts. Only ever called with markup this
 * module wrote itself; text from outside goes through textContent.
 */
export function svg(markup: string, className = 'sn-ico'): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = markup;
  return span;
}

export function button(className: string, label: string, ...children: Child[]): HTMLButtonElement {
  const b = el('button', className, ...children);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  return b;
}

/** Writes text only when it changed, so count-ups do not touch the DOM on idle frames. */
export function setText(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function toggleAttr(node: Element, name: string, on: boolean): void {
  if (on) node.setAttribute(name, '');
  else node.removeAttribute(name);
}

/** Restart a one-shot CSS animation that is keyed on a class. */
export function retrigger(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  // Reading layout flushes the removal, so re-adding restarts the animation.
  void node.offsetWidth;
  node.classList.add(className);
}

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
