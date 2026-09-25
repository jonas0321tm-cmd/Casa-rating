import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PropertyTable } from './pages/PropertyTable'
import { PropertyForm } from './pages/PropertyForm'
import { PropertyDetail } from './pages/PropertyDetail'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { useProfile } from './lib/ProfileContext'

export function App() {
  const { ready, authMode, profile } = useProfile()

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Cargando…</div>
  }

  if (authMode && !profile) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<PropertyTable />} />
          <Route path="add" element={<PropertyForm />} />
          <Route path="property/:id" element={<PropertyDetail />} />
          <Route path="property/:id/edit" element={<PropertyForm />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
