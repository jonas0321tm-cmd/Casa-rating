import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { db, ensureSeedData, PLACEHOLDER_PROFILE_IDS } from '../db/db'
import type { Profile } from '../types'
import { queueOutbox, syncNow } from './sync'

const LOCAL_PROFILE_KEY = 'casa-rating-active-profile'

interface ProfileContextValue {
  ready: boolean
  authMode: boolean
  profile: Profile | null
  profiles: Profile[]
  setActiveProfile: (id: string) => void
  signOut: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

function colorForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 45%)`
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [activeLocalId, setActiveLocalId] = useState<string>(
    () => localStorage.getItem(LOCAL_PROFILE_KEY) ?? 'profile-1',
  )
  const allProfiles = useLiveQuery(() => db.profiles.toArray(), []) ?? []

  useEffect(() => {
    void (async () => {
      await ensureSeedData()
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) void syncNow()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cada quien registra (y mantiene actualizado) su propio nombre real la
  // primera vez que entra, para que el otro dispositivo lo vea al sincronizar.
  useEffect(() => {
    if (!session) return
    void (async () => {
      const id = session.user.id
      const name = (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'Yo'
      const existing = await db.profiles.get(id)
      if (existing?.name === name) return
      const profile: Profile = { id, name, color: colorForId(id), updatedAt: Date.now() }
      await db.profiles.put(profile)
      await queueOutbox('profiles', 'upsert', profile)
    })()
  }, [session])

  const setActiveProfile = (id: string) => {
    localStorage.setItem(LOCAL_PROFILE_KEY, id)
    setActiveLocalId(id)
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
  }

  const profiles = isSupabaseConfigured
    ? allProfiles.filter((p) => !(PLACEHOLDER_PROFILE_IDS as string[]).includes(p.id))
    : allProfiles

  const profile: Profile | null = isSupabaseConfigured
    ? session
      ? {
          id: session.user.id,
          name: (session.user.user_metadata?.name as string | undefined) ?? session.user.email ?? 'Yo',
          color: colorForId(session.user.id),
        }
      : null
    : (profiles.find((p) => p.id === activeLocalId) ?? profiles[0] ?? null)

  return (
    <ProfileContext.Provider
      value={{ ready, authMode: isSupabaseConfigured, profile, profiles, setActiveProfile, signOut }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
