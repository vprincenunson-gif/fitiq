import { Route, Routes } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { HomePage } from './pages/HomePage'
import { WardrobePage } from './pages/WardrobePage'
import { ItemPage } from './pages/ItemPage'
import { ScanPage } from './pages/ScanPage'
import { TryOnPage } from './pages/TryOnPage'
import { PlannerPage } from './pages/PlannerPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell><HomePage /></Shell>} />
      <Route path="/scan" element={<Shell bleed><ScanPage /></Shell>} />
      <Route path="/wardrobe" element={<Shell><WardrobePage /></Shell>} />
      <Route path="/items/:id" element={<Shell><ItemPage /></Shell>} />
      <Route path="/try-on" element={<Shell><TryOnPage /></Shell>} />
      <Route path="/planner" element={<Shell><PlannerPage /></Shell>} />
      <Route path="*" element={<Shell><HomePage /></Shell>} />
    </Routes>
  )
}
