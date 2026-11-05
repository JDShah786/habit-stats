// Montserrat: only the weights the design uses (self-hosted, OFL).
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/montserrat/800-italic.css'
import '@fontsource/montserrat/900-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { localDay } from './engine/scoring'
import { openDb } from './storage/db'
import { fitToScreen } from './pwa/fit'
import { registerServiceWorker } from './pwa/register'
import { createStore } from './storage/store'
import { App } from './ui/App'
import './ui/app.css'
import './ui/themes.css'
import { bootTheme } from './ui/themes'

// PR previews build with their own VITE_DB_NAME, so they never touch the real habit data.
// The database keeps its first name, 'habit-stats', after the rename to Meta Log: renaming it
// would leave everyone's data behind.
const db = openDb(import.meta.env.VITE_DB_NAME || 'habit-stats')
const store = createStore(db, () => localDay(new Date()))

// Offline and installable (step 7). Not in PR previews.
registerServiceWorker()
// The installed iPhone app reports a window shorter than the screen; stretch to the real bottom.
fitToScreen(window, document.documentElement)
// Ask the phone to keep this app's storage permanently. Installed iPhone apps already are;
// this also helps in a browser tab.
void navigator.storage?.persist?.()

// Apply the saved theme (step 8) before the app shows, so it never flashes the wrong colours.
void bootTheme(store).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  ),
)
