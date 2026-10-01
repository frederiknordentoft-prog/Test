import { createRoot } from 'react-dom/client'
import { loadAllClips } from '../speech/catalog'
import '@fontsource-variable/nunito'
import './sheets.css'
import { SheetApp } from './SheetApp'

// Dev-only contact-sheet app (vite build --mode sheets). Never part of the production build.
// clip texts load lazily (src/speech/catalog.ts): render once they are known
void loadAllClips().then(() => createRoot(document.getElementById('root')!).render(<SheetApp />))
