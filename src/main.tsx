import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { ProfileProvider } from './lib/ProfileContext.tsx'
import { startSyncListeners } from './lib/sync.ts'

startSyncListeners()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProfileProvider>
      <App />
    </ProfileProvider>
  </StrictMode>,
)
