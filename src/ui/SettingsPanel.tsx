import { useState } from 'react'
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  ELEMENTS,
  type ElementCategory,
} from '../data/elements'
import { useGameStore } from '../state/store'
import { ShapeGlyph } from './Tray'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ElementCategory[]

export function SettingsPanel() {
  const [open, setOpen] = useState(false)
  const settings = useGameStore((s) => s.settings)
  const toggleSound = useGameStore((s) => s.toggleSound)
  const toggleReducedMotion = useGameStore((s) => s.toggleReducedMotion)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-xl hover:bg-amber-900/10"
        aria-label="Indstillinger"
      >
        ⚙️
      </button>
      {open && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Indstillinger"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border-2 border-amber-700/40 bg-parchment p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Indstillinger</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg hover:bg-amber-900/10"
                aria-label="Luk indstillinger"
              >
                ✕
              </button>
            </div>

            <label className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">Lyd</span>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={toggleSound}
                className="h-5 w-5 accent-amber-800"
              />
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">
                Reduceret bevægelse
                <span className="block text-xs font-normal text-ink/60">
                  Mindre wobble, ingen partikler (følger ellers systemet)
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.reducedMotion === 'reduceret'}
                onChange={toggleReducedMotion}
                className="h-5 w-5 accent-amber-800"
              />
            </label>

            <h3 className="mt-4 font-display text-sm font-bold text-ink">Kategorier</h3>
            <ul className="mt-1 space-y-1">
              {CATEGORIES.map((cat) => {
                const sample = ELEMENTS.find((e) => e.category === cat)
                return (
                  <li key={cat} className="flex items-center gap-2 text-sm text-ink/85">
                    {sample && <ShapeGlyph el={sample} size={12} />}
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: CATEGORY_COLORS[cat] }}
                      aria-hidden="true"
                    />
                    {CATEGORY_LABELS[cat]}
                    <span className="text-xs text-ink/50">
                      ({ELEMENTS.filter((e) => e.category === cat)
                        .map((e) => e.symbol)
                        .join(', ')})
                    </span>
                  </li>
                )
              })}
            </ul>

            <p className="mt-4 text-xs leading-relaxed text-ink/60">
              Vægtskålen bruger grundstoffernes standard-atomvægte (IUPAC, forkortet).
              Bjælken tipper efter den faktiske massefordeling — for at balancere ét
              uranatom skal der ca. 236 brintatomer til. Alt gemmes kun på din enhed.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
