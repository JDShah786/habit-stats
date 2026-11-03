// Montserrat: only the weights the design uses (self-hosted, OFL).
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/montserrat/800-italic.css'
import '@fontsource/montserrat/900-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { localDay } from './engine/scoring'
import { openDb } from './storage/db'
import { createStore } from './storage/store'
import { App } from './ui/App'
import './ui/app.css'

// PR previews build with their own VITE_DB_NAME, so they never touch the real habit data.
const db = openDb(import.meta.env.VITE_DB_NAME || 'habit-stats')
const store = createStore(db, () => localDay(new Date()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
)
