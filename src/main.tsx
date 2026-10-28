import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { WardrobeProvider } from './stores/WardrobeContext'
import { OutfitProvider } from './stores/OutfitContext'
import { ScanProvider } from './stores/ScanContext'
import { OutfitHistoryProvider } from './stores/OutfitHistoryContext'
import { StyleProfileProvider } from './stores/StyleProfileContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WardrobeProvider>
      <OutfitProvider>
        <OutfitHistoryProvider>
          <StyleProfileProvider>
          <ScanProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ScanProvider>
          </StyleProfileProvider>
        </OutfitHistoryProvider>
      </OutfitProvider>
    </WardrobeProvider>
  </StrictMode>,
)
