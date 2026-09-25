// AI-sporet: små delte byggeklodser til AI-laboratoriet, akt-skiftet og agenter i projektfaser.
// Mørkt og glødende (cyan) — alt er CSS/SVG. Animationer neutraliseres af reduceret bevægelse (index.css).
import type { ReactNode } from 'react';
import type { AgentFunktion } from '../../sim/types';
import { Ikon } from './kit';
import { AGENT_IKON } from '../lib/aiHjaelp';

const CSS = `
@keyframes ai-gloed { 0%,100% { box-shadow: 0 0 0 2px var(--color-line), 0 0 10px 1px rgba(78,230,216,.35); } 50% { box-shadow: 0 0 0 2px var(--color-line), 0 0 18px 4px rgba(78,230,216,.6); } }
.ai-gloed { animation: ai-gloed 2.8s ease-in-out infinite; }
.ai-gloed-stille { box-shadow: 0 0 0 2px var(--color-line), 0 0 12px 2px rgba(78,230,216,.45); }
@keyframes ai-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
.ai-scan::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, transparent 0%, rgba(78,230,216,.10) 48%, rgba(78,230,216,.22) 50%, transparent 52%); animation: ai-scan 4.5s linear infinite; }
.ai-linjer { background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px); }
.ai-nat { background: radial-gradient(120% 90% at 50% 0%, #10204a 0%, #0a1030 45%, #05060d 100%); }
.ai-nat-panel { background: linear-gradient(180deg, rgba(16,32,74,.55), rgba(5,6,13,.55)); }
@keyframes ai-blink { 50% { opacity: .25; } }
.ai-blink { animation: ai-blink 1.1s steps(2) infinite; }
@keyframes ai-ind { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
.ai-ind { animation: ai-ind 420ms cubic-bezier(.2,1.1,.4,1) both; }
.ai-ind-gloed { animation: ai-ind 420ms cubic-bezier(.2,1.1,.4,1) both, ai-gloed 2.8s ease-in-out 420ms infinite; }
.ai-tekst-gloed { text-shadow: 0 0 8px rgba(78,230,216,.7), 0 0 2px rgba(78,230,216,.9); }
`;

export function AiStil() {
  return (
    <style href="ai-stil" precedence="medium">
      {CSS}
    </style>
  );
}

/** En lille glødende terminal (agentens "skrivebord"). Pixel-SVG. */
export function GloedTerminal({ str = 36, funktion, slukket, className = '' }: { str?: number; funktion?: AgentFunktion; slukket?: boolean; className?: string }) {
  const skaerm = slukket ? '#1a2238' : '#0c3a44';
  const linje = slukket ? '#3a4466' : 'var(--color-cyan)';
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-md border-2 border-line bg-[#070b1a] ${slukket ? '' : 'ai-gloed-stille'} ${className}`}
      style={{ width: str, height: str }}
      aria-hidden
    >
      <AiStil />
      <svg viewBox="0 0 12 12" width={str - 8} height={str - 8} shapeRendering="crispEdges">
        <rect x={0} y={0} width={12} height={9} fill="#0b0c16" />
        <rect x={1} y={1} width={10} height={7} fill={skaerm} />
        <rect x={2} y={2} width={4} height={1} fill={linje} />
        <rect x={2} y={4} width={6} height={1} fill={linje} opacity={0.75} />
        <rect x={2} y={6} width={3} height={1} fill={linje} opacity={0.5} />
        <rect x={9} y={6} width={1} height={1} fill={slukket ? linje : 'var(--color-ink)'} className={slukket ? '' : 'ai-blink'} />
        <rect x={4} y={9} width={4} height={1} fill="#0b0c16" />
        <rect x={2} y={10} width={8} height={2} fill="#0b0c16" />
      </svg>
      {funktion && (
        <span className="absolute -right-1.5 -bottom-1.5 flex h-4 w-4 items-center justify-center rounded border-2 border-line bg-cyan">
          <Ikon navn={AGENT_IKON[funktion]} farve="var(--color-line)" str={10} />
        </span>
      )}
    </span>
  );
}

/** "AI"-mærke: chip-ikon + tekst i cyan (ikon + farve, aldrig kun farve) */
export function AiMaerke({ children = 'AI', titel }: { children?: ReactNode; titel?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded border-2 border-line bg-cyan px-1 py-px font-pixel text-[0.6rem] font-black uppercase leading-none text-line"
      title={titel}
    >
      <Ikon navn="chip" farve="var(--color-line)" indre="var(--color-cyan)" str={10} />
      {children}
    </span>
  );
}

/** Bjælke for 0..1 med glød og valgfri markør (fx tærsklen 0,3 for dataejerskab) */
export function GloedBar({ vaerdi, farve = 'var(--color-cyan)', label, testId, markoer }: { vaerdi: number; farve?: string; label: string; testId?: string; markoer?: number }) {
  const p = Math.max(0, Math.min(1, vaerdi));
  return (
    <span
      className="relative block h-3 w-full overflow-hidden rounded-sm border-2 border-line bg-[#1b2447]"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
      data-testid={testId}
    >
      <span className="block h-full transition-[width] duration-500" style={{ width: `${p * 100}%`, background: farve, boxShadow: p > 0 ? `0 0 8px ${farve}` : undefined }} />
      {markoer !== undefined && <span className="absolute inset-y-0 w-0.5 bg-ink/80" style={{ left: `${Math.max(0, Math.min(1, markoer)) * 100}%` }} aria-hidden />}
    </span>
  );
}
