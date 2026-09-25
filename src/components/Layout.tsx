import { NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '../lib/ProfileContext'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export function Layout() {
  const { profile, profiles, authMode, setActiveProfile, signOut } = useProfile()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏡</span>
            <span className="font-semibold text-slate-900">Casa Rating</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass}>
              Comparativa
            </NavLink>
            <NavLink to="/add" className={navLinkClass}>
              Agregar
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Ajustes
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {!authMode && profile && (
              <select
                value={profile.id}
                onChange={(e) => setActiveProfile(e.target.value)}
                className="text-sm border border-slate-300 rounded-full px-3 py-1.5 bg-white"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {authMode && profile && (
              <button
                onClick={() => void signOut()}
                className="text-sm text-slate-500 hover:text-slate-800"
                title={profile.name}
              >
                Salir ({profile.name})
              </button>
            )}
            {profile && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: profile.color }}
                aria-hidden
              />
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
