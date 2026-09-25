import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../db/db'
import { useProfile } from '../lib/ProfileContext'
import { weightedScore, combinedScore, formatScore } from '../lib/scoring'

type SortKey = 'combined' | 'price' | 'm2' | 'title'

export function PropertyTable() {
  const { profiles } = useProfile()
  const properties = useLiveQuery(() => db.properties.orderBy('createdAt').reverse().toArray(), [])
  const brokers = useLiveQuery(() => db.brokers.toArray(), [])
  const criteria = useLiveQuery(() => db.criteria.filter((c) => c.active).sortBy('sortOrder'), [])
  const allRatings = useLiveQuery(() => db.ratings.toArray(), [])

  const [brokerFilter, setBrokerFilter] = useState('')
  const [m2Filter, setM2Filter] = useState<'' | 'under200' | 'over200'>('')
  const [ratingFilter, setRatingFilter] = useState<'' | '4' | '3'>('')
  const [sortKey, setSortKey] = useState<SortKey>('combined')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const brokerById = useMemo(() => new Map((brokers ?? []).map((b) => [b.id, b])), [brokers])

  const rows = useMemo(() => {
    if (!properties || !criteria || !allRatings) return []
    return properties
      .filter((p) => !brokerFilter || p.brokerId === brokerFilter)
      .filter((p) => {
        if (m2Filter === 'under200') return p.m2 !== undefined && p.m2 < 200
        if (m2Filter === 'over200') return p.m2 !== undefined && p.m2 >= 200
        return true
      })
      .map((property) => {
        const perUser: Record<string, number | null> = {}
        for (const profile of profiles) {
          const ratings = allRatings.filter((r) => r.propertyId === property.id && r.userId === profile.id)
          perUser[profile.id] = weightedScore(ratings, criteria)
        }
        const combined = combinedScore(Object.values(perUser))
        return { property, perUser, combined }
      })
      .filter(({ combined }) => {
        if (ratingFilter === '4') return (combined ?? 0) >= 4
        if (ratingFilter === '3') return (combined ?? 0) >= 3
        return true
      })
  }, [properties, criteria, allRatings, profiles, brokerFilter, m2Filter, ratingFilter])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'combined') cmp = (a.combined ?? -1) - (b.combined ?? -1)
      else if (sortKey === 'price') cmp = (a.property.price ?? -1) - (b.property.price ?? -1)
      else if (sortKey === 'm2') cmp = (a.property.m2 ?? -1) - (b.property.m2 ?? -1)
      else cmp = a.property.title.localeCompare(b.property.title)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (!properties) return <p className="text-slate-500">Cargando…</p>

  if (properties.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">Todavía no han agregado ninguna propiedad.</p>
        <Link to="/add" className="inline-block bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          Agregar la primera
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900">Comparativa</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={brokerFilter}
            onChange={(e) => setBrokerFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            <option value="">Todos los corredores</option>
            {brokers?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={m2Filter}
            onChange={(e) => setM2Filter(e.target.value as typeof m2Filter)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            <option value="">Todos los tamaños</option>
            <option value="under200">Menos de 200 m²</option>
            <option value="over200">200 m² o más</option>
          </select>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            <option value="">Todas las calificaciones</option>
            <option value="4">4★ o más</option>
            <option value="3">3★ o más</option>
          </select>
          <select
            value={sortKey === 'combined' ? sortDir : ''}
            onChange={(e) => {
              setSortKey('combined')
              setSortDir(e.target.value as 'asc' | 'desc')
            }}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5"
          >
            <option value="desc">Calificación: mayor a menor</option>
            <option value="asc">Calificación: menor a mayor</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <Th onClick={() => toggleSort('title')} active={sortKey === 'title'} dir={sortDir}>
                Propiedad
              </Th>
              <Th onClick={() => toggleSort('price')} active={sortKey === 'price'} dir={sortDir}>
                Precio
              </Th>
              <Th onClick={() => toggleSort('m2')} active={sortKey === 'm2'} dir={sortDir}>
                m²
              </Th>
              <th className="px-4 py-3 font-medium">Corredor</th>
              {profiles.map((p) => (
                <th key={p.id} className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: p.color }}>
                  {p.name}
                </th>
              ))}
              <Th onClick={() => toggleSort('combined')} active={sortKey === 'combined'} dir={sortDir}>
                Score total
              </Th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(({ property, perUser, combined }) => (
              <tr key={property.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {property.images[0] ? (
                      <img
                        src={property.images[0]}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-slate-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-300 text-lg">
                        🏠
                      </div>
                    )}
                    <div className="min-w-0">
                      <Link
                        to={`/property/${property.id}`}
                        className="font-medium text-slate-900 hover:underline truncate block"
                      >
                        {property.title}
                      </Link>
                      <a
                        href={property.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Ver anuncio ↗
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {property.price ? `$${property.price.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{property.m2 ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {property.brokerId ? brokerById.get(property.brokerId)?.name ?? '—' : '—'}
                </td>
                {profiles.map((p) => (
                  <td key={p.id} className="px-4 py-3 font-medium" style={{ color: p.color }}>
                    {formatScore(perUser[p.id])}
                  </td>
                ))}
                <td className="px-4 py-3 font-bold text-slate-900">{formatScore(combined)} ★</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  dir: 'asc' | 'desc'
}) {
  return (
    <th
      className={`px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-800 ${active ? 'text-slate-900' : ''}`}
      onClick={onClick}
    >
      {children}
      {active && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}
