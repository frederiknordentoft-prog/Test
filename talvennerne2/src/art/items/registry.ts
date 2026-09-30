// Genstande indlæses efter behov. En genstand er en fil `src/art/items/<sæt>/<id>.tsx` med
// `export default` af en ItemDef; id'et er `<sæt>-<slot>` eller `milepael-<navn>`.
import type { ItemDef, ItemId } from '../rig/types'

const loaders = import.meta.glob<{ default: ItemDef }>(['./*/*.tsx', '!./*/*.test.tsx'])

const pathOf = (id: string) => Object.keys(loaders).find((k) => k.endsWith(`/${id}.tsx`))

/** Genstande, der findes som filer lige nu. */
export const AVAILABLE_ITEMS = Object.keys(loaders).map((k) => k.split('/').pop()!.slice(0, -4)) as ItemId[]

const cache = new Map<string, Promise<ItemDef>>()

export function loadItem(id: ItemId): Promise<ItemDef> {
  let p = cache.get(id)
  if (!p) {
    const path = pathOf(id)
    if (!path) return Promise.reject(new Error(`Ukendt genstand: ${id}`))
    p = loaders[path]().then((m) => m.default)
    cache.set(id, p)
  }
  return p
}

/** Alle genstande (til kontaktark og tests). */
export function loadAllItems(): Promise<ItemDef[]> {
  return Promise.all(AVAILABLE_ITEMS.map(loadItem))
}
