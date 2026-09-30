// #icons — the full set at 24 and 48 px, plus in context (tiles and buttons).
import { Icon } from '../../ui/design/Icon'
import { ICON_NAMES } from '../../ui/design/icons'

export function IconsPage() {
  return (
    <>
      <h1 className="h-title">Ikoner</h1>
      <p className="h-sub">{ICON_NAMES.length} egne ikoner · 24-grid · stroke 2 · runde ender · duotone 18 %</p>
      <div className="h-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))' }}>
        {ICON_NAMES.map((n) => (
          <div key={n} className="h-tile" style={{ color: 'var(--color-ink)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <Icon name={n} size={48} />
              <Icon name={n} size={24} />
            </div>
            <span className="h-cap" style={{ marginTop: 2 }}>{n}</span>
          </div>
        ))}
      </div>
      <div className="h-section">I farve</div>
      <div className="h-row">
        {(['map', 'paw', 'shirt', 'shop', 'books', 'ear', 'hand', 'bulb', 'star', 'egg', 'heart', 'pearl', 'chest', 'trophy', 'medal', 'crown'] as const).map((n, i) => {
          const tones = ['d-number', 'd-addsub', 'd-fractions', 'd-money', 'd-shapes', 'primary', 'd-measure', 'warm']
          const t = tones[i % tones.length]
          return (
            <div key={n} style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: 20, background: `var(--color-${t})`, color: 'var(--color-card)', boxShadow: `0 5px 0 var(--color-${t}-deep, var(--color-primary-deep))` }}>
              <Icon name={n} size={36} strokeWidth={2.2} style={{ ['--icon-fill-o' as string]: 0.3 }} />
            </div>
          )
        })}
      </div>
      <div className="h-section">Solid</div>
      <div className="h-row" style={{ color: 'var(--color-primary)' }}>
        {(['star', 'heart', 'egg', 'play', 'pause', 'pearl', 'flag', 'paw', 'bulb', 'gift'] as const).map((n) => (
          <Icon key={n} name={n} size={40} solid />
        ))}
      </div>
    </>
  )
}
