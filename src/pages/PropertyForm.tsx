import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { db } from '../db/db'
import { fetchListingInfo } from '../lib/fetchListingInfo'
import { queueOutbox } from '../lib/sync'
import { useProfile } from '../lib/ProfileContext'
import type { Broker } from '../types'

export function PropertyForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { profile } = useProfile()
  const brokers = useLiveQuery(() => db.brokers.orderBy('name').toArray(), [])
  // undefined = still loading, null = confirmed not found
  const existing = useLiveQuery(
    () => (id ? db.properties.get(id).then((p) => p ?? null) : null),
    [id],
  )

  const [url, setUrl] = useState('')
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [price, setPrice] = useState('')
  const [m2, setM2] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [zone, setZone] = useState('')
  const [brokerId, setBrokerId] = useState('')
  const [newBrokerName, setNewBrokerName] = useState('')
  const [fieldsLoaded, setFieldsLoaded] = useState(false)

  useEffect(() => {
    if (isEditing && existing && !fieldsLoaded) {
      setUrl(existing.url)
      setTitle(existing.title)
      setDescription(existing.description ?? '')
      setImages(existing.images)
      setPrice(existing.price ? String(existing.price) : '')
      setM2(existing.m2 ? String(existing.m2) : '')
      setBedrooms(existing.bedrooms ? String(existing.bedrooms) : '')
      setBathrooms(existing.bathrooms ? String(existing.bathrooms) : '')
      setZone(existing.zone ?? '')
      setBrokerId(existing.brokerId ?? '')
      setFieldsLoaded(true)
    }
  }, [isEditing, existing, fieldsLoaded])

  const handleAutoFill = async () => {
    if (!url) return
    setLoadingInfo(true)
    setInfoError(null)
    try {
      const info = await fetchListingInfo(url)
      if (info.title) setTitle(info.title)
      if (info.description) setDescription(info.description)
      if (info.images?.length) setImages(info.images)
      if (info.price) setPrice(String(info.price))
      if (info.m2) setM2(String(info.m2))
      if (info.bedrooms) setBedrooms(String(info.bedrooms))
      if (info.bathrooms) setBathrooms(String(info.bathrooms))

      if (!info.title && !info.description && !info.images?.length && !info.price) {
        setInfoError('Leímos el link pero este sitio no expone datos automáticos (título/imagen/precio). Llena el formulario a mano.')
      }
    } catch {
      setInfoError('No se pudo leer el link automáticamente (el sitio pudo haberlo bloqueado). Llena los datos a mano.')
    } finally {
      setLoadingInfo(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile || saving) return

    setSaving(true)
    setSaveError(null)
    try {
      let finalBrokerId = brokerId
      if (!finalBrokerId && newBrokerName.trim()) {
        const broker: Broker = {
          id: crypto.randomUUID(),
          name: newBrokerName.trim(),
          createdAt: Date.now(),
        }
        await db.brokers.add(broker)
        await queueOutbox('brokers', 'upsert', broker)
        finalBrokerId = broker.id
      }

      const now = Date.now()
      const propertyId = isEditing && id ? id : crypto.randomUUID()
      // Solo se incluyen los campos opcionales que sí tienen valor: guardar
      // `undefined` explícito en IndexedDB puede fallar en algunos navegadores
      // (notablemente Safari/iOS), y ahí el guardado se rompía sin avisar.
      const property = {
        id: propertyId,
        url,
        title: title || url,
        images,
        currency: 'MXN',
        createdBy: isEditing && existing ? existing.createdBy : profile.id,
        createdAt: isEditing && existing ? existing.createdAt : now,
        updatedAt: now,
        ...(description ? { description } : {}),
        ...(price ? { price: Number(price) } : {}),
        ...(m2 ? { m2: Number(m2) } : {}),
        ...(bedrooms ? { bedrooms: Number(bedrooms) } : {}),
        ...(bathrooms ? { bathrooms: Number(bathrooms) } : {}),
        ...(zone ? { zone } : {}),
        ...(finalBrokerId ? { brokerId: finalBrokerId } : {}),
      }

      await db.properties.put(property)
      await queueOutbox('properties', 'upsert', property)
      navigate(`/property/${propertyId}`)
    } catch (err) {
      console.error('No se pudo guardar la propiedad', err)
      setSaveError('No se pudo guardar la propiedad en este dispositivo. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing && existing === null) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 mb-4">No encontramos esa propiedad.</p>
        <Link to="/" className="inline-block bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          Volver a la comparativa
        </Link>
      </div>
    )
  }

  if (isEditing && (!existing || !fieldsLoaded)) {
    return <p className="text-slate-500">Cargando…</p>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">
        {isEditing ? 'Editar propiedad' : 'Agregar propiedad'}
      </h1>

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-1">Link de la propiedad</label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleAutoFill()}
            disabled={!url || loadingInfo}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loadingInfo ? 'Leyendo…' : 'Autocompletar'}
          </button>
        </div>
        {infoError && <p className="text-sm text-amber-600 mt-2">{infoError}</p>}
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.slice(0, 6).map((img) => (
              <img key={img} src={img} alt="" className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
            ))}
          </div>
        )}

        <Field label="Título">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
        </Field>

        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Precio (MXN)">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
          </Field>
          <Field label="m²">
            <input type="number" value={m2} onChange={(e) => setM2(e.target.value)} className="input" />
          </Field>
          <Field label="Recámaras">
            <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="input" />
          </Field>
          <Field label="Baños">
            <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Zona / colonia">
          <input value={zone} onChange={(e) => setZone(e.target.value)} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Corredor / agente">
            <select value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className="input">
              <option value="">— Selecciona —</option>
              {brokers?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="O agrega uno nuevo">
            <input
              value={newBrokerName}
              onChange={(e) => setNewBrokerName(e.target.value)}
              placeholder="Nombre del corredor"
              className="input"
              disabled={!!brokerId}
            />
          </Field>
        </div>

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Guardar propiedad'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
