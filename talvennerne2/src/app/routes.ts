// Every screen of the app and where its module lives. The app frame (App.tsx) owns navigation; a
// screen is a default-exported component in src/ui/screens/<area>/<Name>Screen.tsx that receives
// `{ route }` and navigates with useNav. A screen file that does not exist yet shows a placeholder,
// so screens can be built in parallel without touching the frame.
import type { ItemId, NodeId, RegionId, WorldId } from '../engine/types'
import type { DockId } from '../ui/shell/Dock'

export const BOOK_IDS = ['collection', 'can', 'stamps', 'trophies'] as const
export type BookId = (typeof BOOK_IDS)[number]

export const PARENT_TABS = ['overview', 'curriculum', 'skills', 'tables', 'misconceptions', 'rewards', 'settings'] as const
export type ParentTab = (typeof PARENT_TABS)[number]

export type Route =
  /** First start on a device without profiles: three cards for the grown-up (SPEC §8). */
  | { id: 'parentIntro' }
  /** "Tryk på katten" (SPEC §8). */
  | { id: 'soundCheck' }
  /** The picker, shown at every start with two or more profiles. */
  | { id: 'profiles' }
  /** A new child: name, first friend, grade, placement, first round. */
  | { id: 'onboarding' }
  /** The world map; `world`/`region` zoom in. */
  | { id: 'map'; world?: WorldId; region?: RegionId }
  /**
   * A round at a node (or Blandet øvelse / Træningshytten); `resume` continues profile.round.
   * `region`: the hut's region (the trial whose missed keys it practises).
   */
  | { id: 'round'; node: NodeId | 'practice' | 'hut'; resume?: boolean; region?: RegionId }
  /** The ceremony queue after a round (SPEC §5.8). */
  | { id: 'ceremonies' }
  | { id: 'animals'; uid?: string }
  /** `item`: a newly earned item to show first (guided dressing after a level-up). */
  | { id: 'wardrobe'; uid?: string; item?: ItemId }
  | { id: 'shop' }
  | { id: 'books'; book?: BookId }
  /** Behind the grown-ups' gate. */
  | { id: 'parent'; tab?: ParentTab }

export type RouteId = Route['id']
export type RouteOf<K extends RouteId> = Extract<Route, { id: K }>

/** Screen module per route, relative to src/ui/screens/ (without .tsx). */
export const SCREEN_FILES: Readonly<Record<RouteId, string>> = {
  parentIntro: 'parent/ParentIntroScreen',
  soundCheck: 'child/SoundCheckScreen',
  profiles: 'child/ProfilePickerScreen',
  onboarding: 'child/OnboardingScreen',
  map: 'child/MapScreen',
  round: 'child/PlayScreen',
  ceremonies: 'child/CeremonyScreen',
  animals: 'child/AnimalsScreen',
  wardrobe: 'child/WardrobeScreen',
  shop: 'child/ShopScreen',
  books: 'child/BooksScreen',
  parent: 'parent/DashboardScreen',
}

/** The dock is shown on these screens, with this item lit. */
export const DOCK_OF: Readonly<Partial<Record<RouteId, DockId>>> = {
  map: 'map',
  animals: 'animals',
  wardrobe: 'wardrobe',
  shop: 'shop',
  books: 'books',
}

export const DOCK_ROUTES: Readonly<Record<DockId, Route>> = {
  map: { id: 'map' },
  animals: { id: 'animals' },
  wardrobe: { id: 'wardrobe' },
  shop: { id: 'shop' },
  books: { id: 'books' },
}

/** Screens a child reaches without a profile loaded. */
export const PROFILELESS: ReadonlySet<RouteId> = new Set(['parentIntro', 'soundCheck', 'profiles', 'onboarding', 'parent'])

/** Identity of a route for screen transitions: same key, same screen instance. */
export function routeKey(r: Route): string {
  switch (r.id) {
    case 'map':
      return 'map'
    case 'round':
      return `round:${r.node}`
    case 'animals':
    case 'wardrobe':
      return `${r.id}:${r.uid ?? ''}`
    case 'books':
      return `books:${r.book ?? ''}`
    default:
      return r.id
  }
}
