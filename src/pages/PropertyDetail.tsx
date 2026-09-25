import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { db } from '../db/db'
import { StarRating } from '../components/StarRating'
import { useProfile } from '../lib/ProfileContext'
import { queueOutbox } from '../lib/sync'
import { weightedScore, formatScore } from '../lib/scoring'
import type { Rating } from '../types'

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, profiles } = useProfile()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // undefined = still loading, null = confirmed not found
  const property = useLiveQuery(
    () => (id ? db.properties.get(id).then((p) => p ?? null) : null),
    [id],
  )
  const broker = useLiveQuery(
    () => (property?.brokerId ? db.brokers.get(property.brokerId) : undefined),
    [property?.brokerId],
  )
  const criteria = useLiveQuery(
    () => db.criteria.filter((c) => c.active).sortBy('sortOrder'),
    [],
  )
  const ratings = useLiveQuery(() => (id ? db.ratings.where('propertyId').equals(id).toArray() : []), [id])

  if (!id || property === null) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">No encontramos esa propiedad.</p>
        <Link to="/" className="inline-block bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          Volver a la comparativa
        </Link>
      </div>
    )
  }

  if (!property || !criteria || !ratings) {
    return <p className="text-slate-500">Cargando…</p>
  }

  const myRatings = ratings.filter((r) => r.userId === profile?.id)
  const ratingFor = (criterionId: string, userId: string) =>
    ratings.find((r) => r.criterionId === criterionId && r.userId === userId)

  const handleRate = async (criterionId: string, stars: number) => {
    if (!profile) return
    const existing = ratingFor(criterionId, profile.id)
    const now = Date.now()
    const rating: Rating = existing
      ? { ...existing, stars, updatedAt: now }
      : { id: crypto.randomUUID(), propertyId: id, criterionId, userId: profile.id, stars, createdAt: now, updatedAt: now }

    await db.ratings.put(rating)
    await queueOutbox('ratings', 'upsert', rating)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await db.ratings.where('propertyId').equals(id).delete()
      await db.properties.delete(id)
      await queueOutbox('properties', 'delete', { id })
      navigate('/')
    } catch (err) {
      console.error('No se pudo eliminar la propiedad', err)
      setDeleteError('No se pudo eliminar. Intenta de nuevo.')
      setDeleting(false)
    }
  }

  const myScore = weightedScore(myRatings, criteria)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
          ← Volver a la comparativa
        </Link>
        <div className="flex items-center gap-3">
          <Link to={`/property/${id}/edit`} className="text-sm text-slate-500 hover:text-slate-800">
            Editar
          </Link>
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">¿Seguro?</span>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)} className="text-sm text-red-500 hover:text-red-700">
              Eliminar
            </button>
          )}
        </div>
      </div>
      {deleteError && <p className="text-sm text-red-600 text-right mt-1">{deleteError}</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-3 mb-6">
        {property.images.length > 0 && (
          <div className="flex gap-1 overflow-x-auto">
            {property.images.slice(0, 6).map((img) => (
              <img key={img} src={img} alt="" className="h-40 w-56 object-cover flex-shrink-0" />
            ))}
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{property.title}</h1>
            <span className="text-lg font-bold text-slate-900 whitespace-nowrap">{formatScore(myScore)} ★</span>
          </div>
          {property.description && <p className="text-sm text-slate-600 mt-1">{property.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mt-3">
            {property.price && <span>💰 ${property.price.toLocaleString()} {property.currency}</span>}
            {property.m2 && <span>📐 {property.m2} m²</span>}
            {property.bedrooms && <span>🛏️ {property.bedrooms} rec.</span>}
            {property.bathrooms && <span>🚿 {property.bathrooms} baños</span>}
            {property.zone && <span>📍 {property.zone}</span>}
            {broker && <span>🧑‍💼 {broker.name}</span>}
          </div>
          <a href={property.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            Ver anuncio original ↗
          </a>
        </div>
      </div>

      <h2 className="text-base font-semibold text-slate-900 mb-3">Tu calificación</h2>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {criteria.map((criterion) => {
          const mine = ratingFor(criterion.id, profile?.id ?? '')
          return (
            <div key={criterion.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">{criterion.name}</p>
                <p className="text-xs text-slate-400">Peso: {criterion.weight}%</p>
              </div>
              <StarRating value={mine?.stars ?? 0} onChange={(stars) => void handleRate(criterion.id, stars)} />
            </div>
          )
        })}
      </div>

      {profiles.length > 1 && (
        <>
          <h2 className="text-base font-semibold text-slate-900 mt-6 mb-3">Otras calificaciones</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {profiles
              .filter((p) => p.id !== profile?.id)
              .map((p) => {
                const theirRatings = ratings.filter((r) => r.userId === p.id)
                const theirScore = weightedScore(theirRatings, criteria)
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: p.color }}>
                      {p.name}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {theirRatings.length > 0 ? `${formatScore(theirScore)} ★` : 'Sin calificar'}
                    </span>
                  </div>
                )
              })}
          </div>
        </>
      )}
    </div>
  )
}
