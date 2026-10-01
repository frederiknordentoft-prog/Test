// Statiske dyr som billeder (SPEC §6.4): kun buddyen og højst 2 andre dyr pr. skærm animerer dele;
// resten renderes én gang til en SVG-streng og vises som <img src={blobUrl}>.
//
// Serialiseringen er en lille, afhængighedsfri React→SVG-streng-renderer (ingen react-dom/server,
// som ville koste ~40 KB gzip). Den virker overalt – også midt i en anden komponents render og i
// Node – fordi rigElement() er ren (ingen hooks). En test sammenligner output med
// renderToStaticMarkup, så de to aldrig glider fra hinanden.
import { Fragment, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { rigElement } from './Rig'
import type { RigProps } from './Rig'

/** SVG-attributter, der beholder camelCase (resten skrives med bindestreg som i React). */
const KEEP_CASE = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'clipPathUnits',
  'patternUnits', 'patternContentUnits', 'patternTransform', 'maskUnits', 'textLength', 'pathLength',
])
const SKIP = new Set(['children', 'key', 'ref', 'dangerouslySetInnerHTML'])

const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

function attrName(k: string): string {
  if (k === 'className') return 'class'
  if (k.startsWith('data-') || k.startsWith('aria-') || KEEP_CASE.has(k)) return k
  if (k === 'xmlnsXlink') return 'xmlns:xlink'
  if (k === 'xlinkHref') return 'xlink:href'
  return kebab(k)
}

function styleString(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.startsWith('--') ? k : kebab(k)}:${String(v)}`)
    .join(';')
}

/** Serialisér et React-træ af SVG-elementer og funktionskomponenter uden hooks. */
export function toMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return escape(String(node))
  if (Array.isArray(node)) return node.map(toMarkup).join('')
  if (!isValidElement(node)) return ''
  const el = node as ReactElement<Record<string, unknown>>
  const props = el.props
  if (el.type === Fragment) return toMarkup(props.children as ReactNode)
  if (typeof el.type === 'function') return toMarkup((el.type as (p: unknown) => ReactNode)(props))
  if (typeof el.type !== 'string') throw new Error('toMarkup: kun SVG-elementer og rene funktionskomponenter')
  let attrs = ''
  for (const [k, v] of Object.entries(props)) {
    if (SKIP.has(k) || v === undefined || v === null || v === false || typeof v === 'function') continue
    if (k === 'style') {
      const css = styleString(v as Record<string, unknown>)
      if (css) attrs += ` style="${escape(css)}"`
      continue
    }
    attrs += ` ${attrName(k)}="${escape(String(v))}"`
  }
  const inner = toMarkup(props.children as ReactNode)
  return `<${el.type}${attrs}>${inner}</${el.type}>`
}

/** Et statisk dyr som selvstændig SVG-streng (xmlns, bredde/højde fra viewBox). */
export function rigToSvg(props: RigProps, uid = 'r'): string {
  return toMarkup(rigElement({ size: 200, ...props, mode: 'static', freezeAt: undefined }, { uid }))
}

/** Cachenøgle for et statisk dyr: alt, der påvirker billedet. */
export function rigKey(p: RigProps): string {
  const outfit = Object.entries(p.outfit ?? {})
    .map(([slot, w]) => `${slot}:${w?.item.id}:${w?.colorway ?? 0}`)
    .sort()
    .join(',')
  return [
    p.species.id, p.breed ?? '', p.stage ?? 2, p.colorway ?? 'c1', p.star ? 1 : 0, p.mood ?? 'idle',
    p.silhouette ? 1 : 0, p.crop ?? 'full', outfit, p.lookAt ? `${p.lookAt.x},${p.lookAt.y}` : '',
  ].join('|')
}

const urls = new Map<string, string>()

/** Blob-URL til <img src>, cachet pr. nøgle. Frigiv med releaseRigImages() ved skærmskift. */
export function rigBlobUrl(p: RigProps): string {
  const key = rigKey(p)
  let url = urls.get(key)
  if (!url) {
    url = URL.createObjectURL(new Blob([rigToSvg(p)], { type: 'image/svg+xml' }))
    urls.set(key, url)
  }
  return url
}

export function releaseRigImages(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
}
