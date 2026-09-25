import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { usernameToEmail } from '../lib/username'

function friendlyError(message: string): string {
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Ya existe una cuenta con ese nombre de usuario. Prueba "Entrar" en vez de "Crear cuenta".'
  }
  if (message.includes('Invalid login credentials')) {
    return 'Nombre de usuario o contraseña incorrectos.'
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return message
}

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabase) return

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    const email = usernameToEmail(username)

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password, options: { data: { name: username.trim() } } })
        : await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) setError(friendlyError(error.message))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="text-3xl mb-2">🏡</div>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Casa Rating</h1>
        <p className="text-sm text-slate-500 mb-4">
          {mode === 'signup'
            ? 'Crea tu usuario para sincronizar tus calificaciones con tu pareja.'
            : 'Entra con tu usuario y contraseña.'}
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>
        <button
          onClick={() => {
            setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
            setError(null)
          }}
          className="text-sm text-slate-500 hover:text-slate-800 mt-4"
        >
          {mode === 'signup' ? '¿Ya tienes cuenta? Entrar' : '¿Primera vez? Crear cuenta'}
        </button>
      </div>
    </div>
  )
}
