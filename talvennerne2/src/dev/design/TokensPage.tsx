// #tokens — colours with measured contrast, the type scale, radii, depth and motion.
import { useEffect, useState } from 'react'
import { DOMAINS } from '../../content/skills'

const CORE = [
  'ink', 'ink-2', 'ink-3', 'paper', 'paper-2', 'card', 'primary', 'primary-deep', 'primary-soft', 'primary-tint',
  'sky-from', 'sky-to', 'good', 'good-strong', 'good-deep', 'good-soft', 'oops', 'oops-lip', 'oops-deep', 'oops-soft',
  'star', 'star-lip', 'star-deep', 'star-soft', 'heart', 'heart-soft', 'warm', 'warm-soft',
  'stone', 'stone-done', 'paw', 'wood', 'wood-edge',
]

function rgbOf(css: string): [number, number, number] | null {
  const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(css)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
const lin = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

function useResolved(names: string[]) {
  const [vals, setVals] = useState<Record<string, [number, number, number] | null>>({})
  useEffect(() => {
    const probe = document.createElement('span')
    document.body.appendChild(probe)
    const out: Record<string, [number, number, number] | null> = {}
    for (const n of names) {
      probe.style.color = `var(--color-${n})`
      out[n] = rgbOf(getComputedStyle(probe).color)
    }
    probe.remove()
    setVals(out)
  }, [names])
  return vals
}

function Swatch({ name, rgb }: { name: string; rgb: [number, number, number] | null | undefined }) {
  const white: [number, number, number] = [255, 255, 255]
  const ink: [number, number, number] = [43, 33, 68]
  return (
    <div className="h-tile" style={{ alignItems: 'stretch', padding: 8 }}>
      <div style={{ height: 56, borderRadius: 14, background: `var(--color-${name})`, boxShadow: 'inset 0 0 0 1px var(--color-line)' }} />
      <div style={{ fontSize: 13, fontWeight: 900 }}>{name}</div>
      <div style={{ fontSize: 12, color: 'var(--color-ink-2)', fontVariantNumeric: 'tabular-nums' }}>
        {rgb ? hex(rgb) : '…'}
        {rgb && ` · hvid ${ratio(rgb, white).toFixed(1)} · ink ${ratio(rgb, ink).toFixed(1)}`}
      </div>
    </div>
  )
}

const DOMAIN_NAMES = DOMAINS.flatMap((d) => [`d-${d.id}`, `d-${d.id}-deep`, `d-${d.id}-soft`])

export function TokensPage() {
  const core = useResolved(CORE)
  const dom = useResolved(DOMAIN_NAMES)
  return (
    <>
      <h1 className="h-title">Tokens</h1>
      <p className="h-sub">Papir og himmel. Kun lyst tema. Rød bruges aldrig som fejlfarve.</p>

      <div className="h-section">Farver</div>
      <div className="h-grid">
        {CORE.map((n) => (
          <Swatch key={n} name={n} rgb={core[n]} />
        ))}
      </div>

      <div className="h-section">Domæner (base · deep · soft)</div>
      <div className="h-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {DOMAINS.map((d) => (
          <div key={d.id} className="h-tile" style={{ alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['', '-deep', '-soft'].map((s) => (
                <div key={s} style={{ flex: 1, height: 44, borderRadius: 12, background: `var(--color-d-${d.id}${s})`, boxShadow: 'inset 0 0 0 1px var(--color-line)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 12, background: `var(--color-d-${d.id}-soft)`, color: `var(--color-d-${d.id}-deep)`, fontWeight: 900, fontSize: 15 }}>
              {d.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-ink-2)' }}>
              deep på soft {dom[`d-${d.id}-deep`] && dom[`d-${d.id}-soft`] ? ratio(dom[`d-${d.id}-deep`]!, dom[`d-${d.id}-soft`]!).toFixed(2) : '…'} : 1
            </div>
          </div>
        ))}
      </div>

      <div className="h-section">Typografi · Nunito Variable</div>
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="tv-t-task">8 + 5 = 13</div>
        <div className="tv-t-answer">47 · 3 : 12 − 9</div>
        <div className="tv-t-title">Overskrift til skærme</div>
        <div className="tv-t-button">Knaptekst til en stor knap</div>
        <div className="tv-t-body" style={{ maxWidth: 560 }}>
          Brødtekst til forklaringer og kort. Alt, et barn ser, kan læses op. Æ, ø og å, “citater” og tankestreg – også minus −.
        </div>
        <div className="tv-t-dash" style={{ maxWidth: 560, color: 'var(--color-ink-2)' }}>
          Dashboard 15 px: Kan selv 3 · Med støtte 2 · Øver 1 · Ikke startet 4. Nøjagtighed 86 %.
        </div>
        <div className="tv-t-label" style={{ color: 'var(--color-ink-2)' }}>
          LABEL 13 PX · DOCK OG PILLER
        </div>
      </div>

      <div className="h-section">Form og dybde</div>
      <div className="h-row">
        {[
          ['card 28', 'var(--radius-card)', 'var(--shadow-card)'],
          ['btn 24', 'var(--radius-btn)', 'var(--shadow-card)'],
          ['tile 20', 'var(--radius-tile)', 'var(--shadow-float)'],
        ].map(([n, r, s]) => (
          <div key={n} style={{ textAlign: 'center' }}>
            <div style={{ width: 120, height: 88, borderRadius: r, background: 'var(--color-card)', boxShadow: s }} />
            <span className="h-cap">{n}</span>
          </div>
        ))}
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 160, height: 88, borderRadius: 20, background: 'var(--sky)' }} />
          <span className="h-cap">himmel</span>
        </div>
      </div>

      <div className="h-section">Bevægelse</div>
      <p className="tv-t-dash" style={{ color: 'var(--color-ink-2)', maxWidth: 620 }}>
        120 / 220 / 400 ms med cubic-bezier(.2,.8,.2,1). Skærmskift: skub 24 px + fade 220 ms. Tryk: 4 px på 80 ms, fjeder tilbage på
        180 ms. Rolig tilstand og reduceret bevægelse: kun crossfade, ingen løkker. Kun transform og opacity animeres.
      </p>
    </>
  )
}
