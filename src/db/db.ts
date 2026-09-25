import Dexie, { type EntityTable } from 'dexie'
import type { Broker, Criterion, OutboxEntry, Profile, Property, Rating } from '../types'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export const PLACEHOLDER_PROFILE_IDS = ['profile-1', 'profile-2']

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'crit-ubicacion', name: 'Ubicación / zona', weight: 20, sortOrder: 0, active: true },
  { id: 'crit-precio', name: 'Precio vs. mercado', weight: 15, sortOrder: 1, active: true },
  { id: 'crit-tamano', name: 'Tamaño y distribución (m²)', weight: 15, sortOrder: 2, active: true },
  { id: 'crit-acabados', name: 'Estado y acabados', weight: 15, sortOrder: 3, active: true },
  { id: 'crit-luz', name: 'Luz natural y ventilación', weight: 10, sortOrder: 4, active: true },
  { id: 'crit-ruido', name: 'Ruido', weight: 5, sortOrder: 5, active: true },
  { id: 'crit-estacionamiento', name: 'Estacionamiento', weight: 5, sortOrder: 6, active: true },
  { id: 'crit-seguridad', name: 'Seguridad', weight: 5, sortOrder: 7, active: true },
  { id: 'crit-amenidades', name: 'Amenidades / plusvalía', weight: 5, sortOrder: 8, active: true },
  { id: 'crit-servicios', name: 'Cercanía a servicios', weight: 5, sortOrder: 9, active: true },
]

export const DEFAULT_PROFILES: Profile[] = [
  { id: 'profile-1', name: 'Tú', color: '#2563eb' },
  { id: 'profile-2', name: 'Tu pareja', color: '#db2777' },
]

class CasaRatingDB extends Dexie {
  properties!: EntityTable<Property, 'id'>
  brokers!: EntityTable<Broker, 'id'>
  criteria!: EntityTable<Criterion, 'id'>
  ratings!: EntityTable<Rating, 'id'>
  profiles!: EntityTable<Profile, 'id'>
  outbox!: EntityTable<OutboxEntry, 'id'>

  constructor() {
    super('casa-rating-db')
    this.version(1).stores({
      properties: 'id, brokerId, createdAt',
      brokers: 'id, name',
      criteria: 'id, sortOrder, active',
      ratings: 'id, propertyId, criterionId, userId, [propertyId+userId]',
      profiles: 'id',
      outbox: 'id, createdAt',
    })
  }
}

export const db = new CasaRatingDB()

export async function ensureSeedData() {
  const criteriaCount = await db.criteria.count()
  if (criteriaCount === 0) {
    await db.criteria.bulkPut(DEFAULT_CRITERIA)
  }

  if (isSupabaseConfigured) {
    // En modo cuenta real cada quien es dueño de su propio perfil (ver
    // ProfileContext), así que los marcadores locales "Tú"/"Tu pareja" ya no
    // aplican -- se limpian por si quedaron de una prueba anterior en modo local.
    await db.profiles.bulkDelete(PLACEHOLDER_PROFILE_IDS)
  } else {
    const profileCount = await db.profiles.count()
    if (profileCount === 0) {
      await db.profiles.bulkPut(DEFAULT_PROFILES)
    }
  }
}
