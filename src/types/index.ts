export interface Profile {
  id: string
  name: string
  color: string
  updatedAt?: number
}

export interface Broker {
  id: string
  name: string
  phone?: string
  agency?: string
  notes?: string
  createdAt: number
}

export interface Criterion {
  id: string
  name: string
  weight: number // 0-100, all active criteria should sum to 100
  sortOrder: number
  active: boolean
}

export interface Property {
  id: string
  url: string
  title: string
  description?: string
  images: string[]
  price?: number
  currency?: string
  m2?: number
  bedrooms?: number
  bathrooms?: number
  zone?: string
  address?: string
  brokerId?: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface Rating {
  id: string
  propertyId: string
  criterionId: string
  userId: string
  stars: number // 1-5
  createdAt: number
  updatedAt: number
}

export interface OutboxEntry {
  id: string
  table: 'properties' | 'brokers' | 'criteria' | 'ratings' | 'profiles'
  op: 'upsert' | 'delete'
  payload: unknown
  createdAt: number
}

export interface PropertyScore {
  propertyId: string
  perUser: Record<string, number | null> // userId -> weighted score 0-5, null if not rated at all
  combined: number | null
}
