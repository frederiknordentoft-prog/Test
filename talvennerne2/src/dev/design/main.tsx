// Design review harness (dev server only: /design.html#tokens|components|icons|materials|shell).
// Never part of the production build, which only builds index, lyt and diag.
//
// Query flags: ?safe=se|x|ipad emulates iOS safe-area insets (Chromium has none), ?calm=1 turns on
// calm mode, ?shot=1 hides the harness navigation for screenshots.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { loadAllClips } from '../../speech/catalog'
import '../../styles/index.css'
import './harness.css'
import { setCalm } from '../../ui/design/motion'
import { HarnessSpeech } from './harnessSpeech'
import { TokensPage } from './TokensPage'
import { ComponentsPage } from './ComponentsPage'
import { IconsPage } from './IconsPage'
import { MaterialsPage } from './MaterialsPage'
import { ShellPage } from './ShellPage'

const ROUTES = ['tokens', 'components', 'icons', 'materials', 'shell'] as const
type Route = (typeof ROUTES)[number]

const params = new URLSearchParams(location.search)
const SHOT = params.has('shot')

// Safe-area emulation: portrait/landscape presets per device class.
const SAFE: Record<string, { p: [number, number, number, number]; l: [number, number, number, number] }> = {
  se: { p: [20, 0, 0, 0], l: [0, 0, 0, 0] },
  x: { p: [59, 0, 34, 0], l: [0, 59, 21, 59] },
  ipad: { p: [24, 0, 20, 0], l: [24, 0, 20, 0] },
}
const safe = params.get('safe')
if (safe && SAFE[safe]) {
  const land = innerWidth > innerHeight
  const [t, r, b, l] = land ? SAFE[safe].l : SAFE[safe].p
  const s = document.documentElement.style
  s.setProperty('--safe-t', `${t}px`)
  s.setProperty('--safe-r', `${r}px`)
  s.setProperty('--safe-b', `${b}px`)
  s.setProperty('--safe-l', `${l}px`)
}
if (params.get('calm') === '1') setCalm(true)

function parse(): { route: Route; rest: string } {
  const [head, ...rest] = location.hash.replace(/^#/, '').split('/')
  const route = (ROUTES as readonly string[]).includes(head) ? (head as Route) : 'components'
  return { route, rest: rest.join('/') }
}

function Harness() {
  const [loc, setLoc] = useState(parse)
  useEffect(() => {
    const on = () => setLoc(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  if (loc.route === 'shell') return <ShellPage sub={loc.rest} />
  return (
    <div className="h-page">
      {!SHOT && (
        <nav className="h-nav">
          {ROUTES.map((r) => (
            <a key={r} href={`#${r}`} aria-current={r === loc.route ? 'page' : undefined}>
              {r}
            </a>
          ))}
        </nav>
      )}
      {loc.route === 'tokens' && <TokensPage />}
      {loc.route === 'components' && <ComponentsPage sub={loc.rest} />}
      {loc.route === 'icons' && <IconsPage />}
      {loc.route === 'materials' && <MaterialsPage />}
    </div>
  )
}

// clip texts load lazily (src/speech/catalog.ts): render once they are known
void loadAllClips().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HarnessSpeech>
        <Harness />
      </HarnessSpeech>
    </StrictMode>,
  ),
)
