/**
 * Sandbox harness: a full-window Stage on the shared loop, for developing one
 * render module in isolation (sandbox/<name>.html → src/sandbox/<name>.ts).
 *
 *   const { stage, onUpdate } = createSandbox();
 *   stage.scene.add(myThing.group);
 *   onUpdate((dt) => myThing.update(dt, stage.time));
 *   sandboxReady();
 *
 * URL params: ?q=low|medium|high  &inset=top,right,bottom,left (px)  &rm=1 (reduced motion)
 */
import { debug, loop } from '../core/loop';
import type { Insets, Quality } from '../core/types';
import { Stage } from '../render/stage';

export interface Sandbox {
  stage: Stage;
  container: HTMLElement;
  onUpdate(fn: (dt: number) => void): void;
  params: URLSearchParams;
}

export function createSandbox(): Sandbox {
  const params = new URLSearchParams(location.search);
  document.documentElement.style.cssText = 'height:100%;background:#03050d;';
  document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#03050d;';
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;';
  document.body.appendChild(container);

  const quality = (params.get('q') as Quality) || 'high';
  const stage = new Stage(container, { quality, reducedMotion: params.get('rm') === '1' });

  const insetParam = (params.get('inset') || '0,0,0,0').split(',').map(Number);
  const insets: Insets = { top: insetParam[0] || 0, right: insetParam[1] || 0, bottom: insetParam[2] || 0, left: insetParam[3] || 0 };
  const layout = () => stage.setLayout({ width: container.clientWidth, height: container.clientHeight, insets });
  layout();
  addEventListener('resize', layout);

  const updaters: ((dt: number) => void)[] = [];
  loop.onUpdate((dt) => {
    for (const fn of updaters) fn(dt);
    stage.update(dt);
  });
  loop.onRender(() => stage.render());
  loop.start();
  debug.stage = stage;

  return { stage, container, onUpdate: (fn) => updaters.push(fn), params };
}

/** Tell the screenshot tool the scene is built. */
export function sandboxReady(): void {
  (window as unknown as { __SN_READY: boolean }).__SN_READY = true;
}
