// Tænd/sluk-kontakt i pixelstil (role="switch"). Hele rækken er et touch-mål på mindst 44 px.
import { useId } from 'react';

export function Kontakt({
  til, onSkift, label, forklaring, testId, deaktiveret, note,
}: { til: boolean; onSkift: (v: boolean) => void; label: string; forklaring?: string; testId?: string; deaktiveret?: boolean; note?: string }) {
  const id = useId();
  return (
    <div className={`flex min-h-[44px] items-center gap-3 ${deaktiveret ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={`block text-sm font-bold ${deaktiveret ? 'text-muted' : 'text-ink'} ${deaktiveret ? '' : 'cursor-pointer'}`}>
          {label}
          {note && <span className="ml-2 rounded border border-line bg-bg px-1 font-pixel text-[0.6rem] font-bold uppercase text-dim">{note}</span>}
        </label>
        {forklaring && <p className="text-xs leading-snug text-muted">{forklaring}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={til}
        disabled={deaktiveret}
        data-testid={testId}
        onClick={() => onSkift(!til)}
        className="relative inline-flex h-[44px] w-[68px] shrink-0 items-center disabled:cursor-not-allowed"
      >
        <span className={`absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-md border-2 border-line transition-colors ${til ? 'bg-good' : 'bg-bg'}`} />
        <span
          className={`absolute top-1/2 flex h-7 w-8 -translate-y-1/2 items-center justify-center rounded-md border-2 border-line font-pixel text-[0.55rem] font-black transition-[left] duration-100 ${
            til ? 'left-[36px] bg-ink text-line' : 'left-0 bg-panel2 text-muted'
          }`}
          aria-hidden
        >
          {til ? 'TIL' : 'FRA'}
        </span>
      </button>
    </div>
  );
}
