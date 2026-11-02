import { useEffect, useRef } from 'react';
import type { MatchStore, Focus } from '../../state/match';
import { OUTCOME_ID } from '../../state/match';
import { makeGeo, pOfY, tOfX, type Geo } from '../../render/fan/geometry';
import { drawStrands } from '../../render/fan/strands';
import { drawLive } from '../../render/fan/live';
import { fontsReady } from '../../diag/fonts';
import { sound } from '../../render/sound';

interface Props {
  store: MatchStore;
  onLimitDraft: (focus: Focus, level: number) => void;
  onBranchTap: (idx: number) => void;
}

/**
 * The hero. Strand layer: two stacked canvases, cross-faded by CSS when a Monte Carlo result
 * arrives. Live layer: redrawn every tick. FX layer: a ring during big moments only. The head is
 * a DOM element so its breathing runs on the compositor.
 */
export function Fan({ store, onLimitDraft, onBranchTap }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const sA = useRef<HTMLCanvasElement>(null);
  const sB = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const cb = useRef({ onLimitDraft, onBranchTap });
  cb.current = { onLimitDraft, onBranchTap };

  useEffect(() => {
    const el = wrap.current;
    const a = sA.current;
    const b = sB.current;
    const lv = live.current;
    const fxc = fx.current;
    const hd = head.current;
    if (!el || !a || !b || !lv || !fxc || !hd) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let center = store.sim.askRaw[store.focus];
    let front = 0;
    let lastMcEvent = -1;
    let lastFocus = store.focus;
    let burnUntil = 0;
    let quietUntil = 0;
    let scheduled = false;
    let draftLevel: number | null = null;
    let scrubT: number | null = null;
    let tags: { y: number; idx: number }[] = [];
    let geo: Geo | null = null;
    let showGhostUntil = 0;

    const geoNow = () => makeGeo(w, h, store.sim.t, store.sim.end, center);

    const swapStrands = (opts: { burnTeam?: 0 | 1 | null; dim?: boolean }) => {
      if (!geo) return;
      const back = front === 0 ? b : a;
      // The strand layer is soft light: drawn at 1× and scaled by CSS (a quarter of the pixels at 2×).
      drawStrands(back, 1, geo, store.mcResult, { ...opts, focus: store.focus });
      back.classList.add('on');
      (front === 0 ? a : b).classList.remove('on');
      front = 1 - front;
    };

    const draw = () => {
      scheduled = false;
      if (w < 2) return;
      const sim = store.sim;
      const now = performance.now();
      // Recentre the fisheye only between events, when the price has drifted away.
      const ask = sim.askRaw[store.focus];
      const recentre = store.focus !== lastFocus || (Math.abs(ask - center) > 6 && now > quietUntil);
      if (recentre) center = ask;
      geo = geoNow();
      const speedy = store.effectiveSpeed(now) > 1;
      const dim = sim.halt?.kind === 'var' || speedy;
      if (store.mcEvent !== lastMcEvent || recentre) {
        if (now > burnUntil) {
          lastMcEvent = store.mcEvent;
          lastFocus = store.focus;
          swapStrands({ dim });
        }
      }
      const out = drawLive(lv, dpr, geo, {
        sim,
        d: store.view.d,
        focus: store.focus,
        limits: store.limitsFor(store.focus),
        entries: (store.book.positions.get(OUTCOME_ID[store.focus])?.lots ?? []).map((l) => ({ t: l.t, price: l.price })),
        ghost: store.ghost && store.ghost.contract === OUTCOME_ID[store.focus] ? store.ghost : null,
        showGhost: now < showGhostUntil || store.view.ghostStatus !== null,
        draftLevel,
        scrubT,
        counts: store.mcResult?.counts ?? null,
      });
      tags = out.tags;
      hd.style.transform = `translate(${geo.nowX}px, ${out.headY}px)`;
      hd.dataset.focus = String(store.focus);
    };
    let lastDraw = 0;
    let urgent = false;
    const schedule = () => {
      if (scheduled) return;
      const now = performance.now();
      // The price line redraws at ~5 Hz; the head glides between draws with a CSS transition.
      const wait = urgent || draftLevel !== null || scrubT !== null ? 0 : Math.max(0, 190 - (now - lastDraw));
      scheduled = true;
      urgent = false;
      setTimeout(() => requestAnimationFrame(() => {
        lastDraw = performance.now();
        draw();
      }), wait);
    };
    const now0 = () => {
      urgent = true;
      schedule();
    };

    const ring = (team: 0 | 1 | null, big: boolean) => {
      if (reduced || !geo) return;
      const g = geo;
      const x0 = g.nowX;
      const y0 = store.sim.askRaw[store.focus];
      const yy = parseFloat(hd.style.transform.split(',')[1] ?? '0') || 0;
      const col = team === 0 ? '92,225,255' : team === 1 ? '255,210,0' : '232,237,242';
      const t0 = performance.now();
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      fxc.width = W;
      fxc.height = H;
      fxc.style.display = 'block';
      const c = fxc.getContext('2d');
      if (!c) return;
      void y0;
      const frame = () => {
        const dt = (performance.now() - t0) / 1000;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        if (dt > 0.75) {
          fxc.style.display = 'none';
          return;
        }
        const r = 6 + (big ? 1200 : 500) * dt;
        c.strokeStyle = `rgba(${col},${Math.max(0, 0.9 - dt * 1.2)})`;
        c.lineWidth = big ? 2 : 1.5;
        c.beginPath();
        c.arc(x0, yy, r, 0, Math.PI * 2);
        c.stroke();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      w = Math.round(box.width);
      h = Math.round(box.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      lastMcEvent = -1;
      schedule();
    });
    ro.observe(el);
    void fontsReady.then(() => {
      lastMcEvent = -1;
      schedule();
    });
    const offFrame = store.onFrame(schedule);
    const offEvent = store.onEvent((e) => {
      const now = performance.now();
      urgent = true;
      if (e.kind === 'goal') {
        quietUntil = now + 3000;
        // Hit-stop: freeze the head for 80 ms, then the ring and the burn.
        el.classList.add('hitstop');
        setTimeout(() => el.classList.remove('hitstop'), 80);
        setTimeout(() => ring(e.team ?? null, true), 80);
        burnUntil = now + 1300;
        if (geo && store.mcResult) swapStrands({ burnTeam: e.team ?? null });
        sound.goal(e.team ?? 0);
        const root = el.closest('.kamp');
        root?.classList.remove('pump');
        void (root as HTMLElement | null)?.offsetWidth;
        root?.classList.add('pump');
        setTimeout(() => root?.classList.remove('pump'), 900);
        store.holdSpeed(2500);
      } else if (e.kind === 'var-start') {
        quietUntil = now + 10000;
        sound.halt();
        store.holdSpeed(1000);
      } else if (e.kind === 'var-verdict') {
        ring(e.varOk ? (e.team ?? null) : null, true);
        sound.halt();
      } else if (e.kind === 'whale') {
        ring(e.team ?? null, false);
        sound.whale();
      } else if (e.kind === 'red') {
        quietUntil = now + 3000;
        sound.halt();
      } else if (e.kind === 'kickoff') sound.bell(true);
      else if (e.kind === 'fulltime') sound.bell(false);
      schedule();
    });

    // --- gestures: scrub the past, long-press a buy limit, tap a branch tag ---
    let down: { x: number; y: number; id: number } | null = null;
    let timer = 0;
    const local = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const onDown = (ev: PointerEvent) => {
      const p = local(ev);
      down = { ...p, id: ev.pointerId };
      el.setPointerCapture(ev.pointerId);
      store.holdSpeed(4000);
      window.clearTimeout(timer);
      if (geo && p.x < geo.right && store.sim.phase !== 'FT' && store.sim.phase !== 'closed') {
        timer = window.setTimeout(() => {
          if (!down || !geo) return;
          const ask = store.sim.ask[store.focus];
          draftLevel = Math.max(1, Math.min(ask - 1, Math.round(pOfY(geo, down.y))));
          now0();
        }, 450);
      }
    };
    const onMove = (ev: PointerEvent) => {
      if (!down || !geo) return;
      const p = local(ev);
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      if (draftLevel !== null) {
        const ask = store.sim.ask[store.focus];
        draftLevel = Math.max(1, Math.min(ask - 1, Math.round(pOfY(geo, p.y))));
        schedule();
        return;
      }
      if (moved > 6) {
        window.clearTimeout(timer);
        if (down.x < geo.nowX && store.sim.t > 0.5) {
          scrubT = Math.min(store.sim.t, tOfX(geo, Math.min(p.x, geo.nowX)));
          schedule();
        }
      }
    };
    const onUp = (ev: PointerEvent) => {
      window.clearTimeout(timer);
      const p = local(ev);
      if (draftLevel !== null) {
        cb.current.onLimitDraft(store.focus, draftLevel);
        draftLevel = null;
      } else if (scrubT !== null) {
        scrubT = null;
      } else if (down && geo && Math.hypot(p.x - down.x, p.y - down.y) < 8 && p.x > geo.right - 4) {
        const near = tags.reduce<{ idx: number; d: number } | null>((best, t) => {
          const dd = Math.abs(t.y - p.y);
          return dd < 24 && (!best || dd < best.d) ? { idx: t.idx, d: dd } : best;
        }, null);
        if (near) cb.current.onBranchTap(near.idx);
      }
      down = null;
      schedule();
    };
    const onCancel = () => {
      window.clearTimeout(timer);
      draftLevel = null;
      scrubT = null;
      down = null;
      schedule();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    const ghostOnBuy = store.onEvent(() => {});
    void ghostOnBuy;
    (store as unknown as { showGhost?: () => void }).showGhost = () => {
      showGhostUntil = performance.now() + 3000;
      schedule();
    };
    schedule();
    return () => {
      ro.disconnect();
      offFrame();
      offEvent();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, [store]);

  return (
    <div ref={wrap} className="fan-wrap no-touch-ui" data-pump="0">
      <canvas ref={sA} className="fan layer-strands on" aria-hidden="true" />
      <canvas ref={sB} className="fan layer-strands" aria-hidden="true" />
      <canvas ref={live} className="fan layer-live on" aria-hidden="true" />
      <canvas ref={fx} className="fan layer-fx on" style={{ display: 'none' }} aria-hidden="true" />
      <span ref={head} className="fan-head" aria-hidden="true" />
    </div>
  );
}
