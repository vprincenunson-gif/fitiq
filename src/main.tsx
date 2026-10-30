import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './stores/AuthContext'
import { WardrobeProvider } from './stores/WardrobeContext'
import { OutfitProvider } from './stores/OutfitContext'
import { ScanProvider } from './stores/ScanContext'
import { OutfitHistoryProvider } from './stores/OutfitHistoryContext'
import { StyleProfileProvider } from './stores/StyleProfileContext'
import { WearProvider } from './stores/WearContext'
import { PlannerProvider } from './stores/PlannerContext'
import { SyncProvider } from './stores/SyncContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <WardrobeProvider>
        <WearProvider>
          <OutfitProvider>
            <OutfitHistoryProvider>
              <StyleProfileProvider>
                <PlannerProvider>
                  <ScanProvider>
                    <SyncProvider>
                      <BrowserRouter>
                        <App />
                      </BrowserRouter>
                    </SyncProvider>
                  </ScanProvider>
                </PlannerProvider>
              </StyleProfileProvider>
            </OutfitHistoryProvider>
          </OutfitProvider>
        </WearProvider>
      </WardrobeProvider>
    </AuthProvider>
  </StrictMode>,
)
