// Vitest setup: the clip catalogue loads lazily in the app (see src/speech/catalog.ts); every test
// file sees the whole catalogue, as the app does after boot.
import { loadAllClips } from '../speech/catalog'

await loadAllClips()
