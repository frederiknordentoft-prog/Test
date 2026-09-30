import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import './sheets.css'
import { SheetApp } from './SheetApp'

// Dev-only contact-sheet app (vite build --mode sheets). Never part of the production build.
createRoot(document.getElementById('root')!).render(<SheetApp />)
