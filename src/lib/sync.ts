import { db } from '../db/db'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import type { OutboxEntry } from '../types'

// Local (Dexie) usa camelCase (propertyId, createdAt...) pero las columnas de
// Supabase son snake_case (property_id, created_at...) -- sin esta conversión
// cada push fallaba silenciosamente por columnas "inexistentes" y nada se
// sincronizaba de verdad entre los dos dispositivos.
function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value
  }
  return out
}

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    out[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value
  }
  return out
}

/** Queue a local write to be pushed to Supabase next time we sync. */
export async function queueOutbox(table: OutboxEntry['table'], op: OutboxEntry['op'], payload: unknown) {
  await db.outbox.add({
    id: crypto.randomUUID(),
    table,
    op,
    payload,
    createdAt: Date.now(),
  })
  void syncNow()
}

let syncing = false

export async function syncNow() {
  if (!isSupabaseConfigured || !supabase) return
  if (syncing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) return

  syncing = true
  try {
    await pushOutbox()
    await pullRemote()
  } finally {
    syncing = false
  }
}

async function pushOutbox() {
  if (!supabase) return
  const pending = await db.outbox.orderBy('createdAt').toArray()

  for (const entry of pending) {
    try {
      if (entry.op === 'upsert') {
        const row = camelToSnake(entry.payload as Record<string, unknown>)
        const { error } = await supabase.from(entry.table).upsert(row)
        if (error) throw error
      } else {
        const payload = entry.payload as { id: string }
        const { error } = await supabase.from(entry.table).delete().eq('id', payload.id)
        if (error) throw error
      }
      await db.outbox.delete(entry.id)
    } catch (err) {
      // Leave it queued for retry, but keep going -- one stuck entry (e.g. a
      // table that doesn't exist yet) must not block every entry queued
      // after it, like a later delete that would otherwise never reach
      // Supabase and then get silently resurrected by the next pull.
      console.warn(`Sync: failed to push ${entry.table} ${entry.op}`, err)
    }
  }
}

async function pullRemote() {
  if (!supabase) return
  const tables = ['brokers', 'criteria', 'properties', 'ratings', 'profiles'] as const

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.warn(`Sync: failed to pull ${table}`, error)
      continue
    }
    if (!data) continue
    const rows = data.map((row) => snakeToCamel(row as Record<string, unknown>))
    await db.table(table).bulkPut(rows)
  }
}

export function startSyncListeners() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => void syncNow())
  void syncNow()
}
