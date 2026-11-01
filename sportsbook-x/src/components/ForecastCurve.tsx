import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { FeedEvent } from '../odds/feed';
import { FULL_MINUTES } from '../odds/model';

interface Props {
  /** Home-win probability per minute, length FULL_MINUTES + 1. */
  series: number[];
  events: FeedEvent[];
  homeLabel: string;
  /** Minute the match clock is at. The curve is drawn up to here. */
  minute: number;
}

const W = 340;
const H = 176;
const PAD = 14;

const pinLetter: Record<string, string> = { goal: 'M', card: 'K', half: 'P', full: 'S' };
const pinName: Record<string, string> = { goal: 'Mål', card: 'Kort', half: 'Halvleg', full: 'Slutfløjt' };

/**
 * Probability curve with event pins. Numbers appear only while scrubbing,
 * and the curve is labelled as a model estimate. It never ticks on its own.
 */
export function ForecastCurve({ series, events, homeLabel, minute }: Props) {
  const [scrub, setScrub] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const x = (m: number) => PAD + (m / FULL_MINUTES) * (W - 2 * PAD);
  const y = (p: number) => PAD + (1 - p) * (H - 2 * PAD);

  const drawn = Math.min(minute, FULL_MINUTES);
  const path = useMemo(
    () => series.slice(0, drawn + 1).map((p, m) => `${m === 0 ? 'M' : 'L'}${x(m).toFixed(1)},${y(p).toFixed(1)}`).join(' '),
    [series, drawn],
  );
  const pins = events.filter((e) => e.minute <= drawn && (e.kind === 'goal' || e.kind === 'card' || e.kind === 'half' || e.kind === 'full'));

  const setFromClientX = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setScrub(Math.min(drawn, Math.round(rel * FULL_MINUTES)));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    setFromClientX(e.clientX);
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = scrub ?? drawn;
    if (e.key === 'ArrowRight') setScrub(Math.min(drawn, cur + 1));
    if (e.key === 'ArrowLeft') setScrub(Math.max(0, cur - 1));
    if (e.key === 'Escape') setScrub(null);
  };

  const shown = scrub ?? null;
  const shownProb = shown !== null ? series[shown] : null;

  return (
    <div className="curve-wrap">
      <div className="curve-readout" aria-live="polite">
        <span>{shown !== null ? `${shown}' · ${homeLabel}` : 'Træk for at læse'}</span>
        <span>{shownProb !== null ? `${Math.round(shownProb * 100)} %` : ''}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="slider"
        tabIndex={0}
        aria-label={`Sandsynlighedskurve for ${homeLabel}, modelestimat. Piletaster flytter minut.`}
        aria-valuemin={0}
        aria-valuemax={drawn}
        aria-valuenow={shown ?? drawn}
        style={{ touchAction: 'pan-y', display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setScrub(null)}
        onPointerLeave={() => setScrub(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setScrub(null)}
      >
        <line x1={PAD} x2={W - PAD} y1={y(0.5)} y2={y(0.5)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {pins.map((e, i) => {
          const p = series[e.minute] ?? 0.5;
          return (
            <g key={`${e.kind}-${e.minute}-${i}`} className="pin" aria-label={`${pinName[e.kind]} ${e.minute} minut`}>
              <circle cx={x(e.minute)} cy={y(p)} r={7} fill="#10121a" stroke="var(--accent)" strokeWidth={1.5} />
              <text x={x(e.minute)} y={y(p) + 3.5} textAnchor="middle" fontSize={9} fill="var(--text)" style={{ fontWeight: 700 }}>
                {pinLetter[e.kind]}
              </text>
            </g>
          );
        })}
        {shown !== null && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.35)" />
            <circle cx={x(shown)} cy={y(series[shown])} r={4} fill="var(--accent)" />
          </g>
        )}
      </svg>
      {drawn === 0 && (
        <p style={{ position: 'absolute', inset: 'auto 0 52px 0', textAlign: 'center', margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          Kurven starter ved kickoff. Træk for at læse startsandsynlighed.
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
        Modelestimat. Ikke en odds-tavle. M = mål, K = kort, P = halvleg, S = slutfløjt.
      </p>
    </div>
  );
}
