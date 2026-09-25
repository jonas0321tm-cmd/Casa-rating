import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { queueOutbox } from '../lib/sync'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import type { Criterion } from '../types'

export function Settings() {
  const criteria = useLiveQuery(() => db.criteria.orderBy('sortOrder').toArray(), [])
  const brokers = useLiveQuery(() => db.brokers.orderBy('name').toArray(), [])
  const [newCriterionName, setNewCriterionName] = useState('')
  const [confirmingCriterionId, setConfirmingCriterionId] = useState<string | null>(null)

  const totalWeight = (criteria ?? []).filter((c) => c.active).reduce((sum, c) => sum + c.weight, 0)

  const updateCriterion = async (criterion: Criterion, patch: Partial<Criterion>) => {
    const updated = { ...criterion, ...patch }
    await db.criteria.put(updated)
    await queueOutbox('criteria', 'upsert', updated)
  }

  const addCriterion = async () => {
    if (!newCriterionName.trim()) return
    const criterion: Criterion = {
      id: crypto.randomUUID(),
      name: newCriterionName.trim(),
      weight: 5,
      sortOrder: (criteria?.length ?? 0) + 1,
      active: true,
    }
    await db.criteria.add(criterion)
    await queueOutbox('criteria', 'upsert', criterion)
    setNewCriterionName('')
  }

  const removeBroker = async (id: string) => {
    await db.brokers.delete(id)
    await queueOutbox('brokers', 'delete', { id })
  }

  const removeCriterion = async (id: string) => {
    await db.ratings.where('criterionId').equals(id).delete()
    await db.criteria.delete(id)
    await queueOutbox('criteria', 'delete', { id })
    setConfirmingCriterionId(null)
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Rúbrica</h1>
        <p className={`text-sm mb-3 ${totalWeight === 100 ? 'text-slate-500' : 'text-amber-600'}`}>
          Suma de pesos activos: {totalWeight}% {totalWeight !== 100 && '(debería sumar 100%)'}
        </p>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {criteria?.map((c) => (
            <div key={c.id} className="p-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={c.active}
                onChange={(e) => void updateCriterion(c, { active: e.target.checked })}
              />
              <input
                value={c.name}
                onChange={(e) => void updateCriterion(c, { name: e.target.value })}
                className="flex-1 text-sm border-none focus:outline-none bg-transparent"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => void updateCriterion(c, { weight: Number(e.target.value) })}
                className="w-16 text-sm border border-slate-300 rounded px-2 py-1"
              />
              <span className="text-xs text-slate-400">%</span>
              {confirmingCriterionId === c.id ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => void removeCriterion(c.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800"
                  >
                    Sí, eliminar
                  </button>
                  <button
                    onClick={() => setConfirmingCriterionId(null)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingCriterionId(c.id)}
                  className="text-xs text-red-500 hover:underline flex-shrink-0"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={newCriterionName}
            onChange={(e) => setNewCriterionName(e.target.value)}
            placeholder="Nuevo criterio"
            className="input flex-1"
          />
          <button
            onClick={() => void addCriterion()}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            Agregar
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Corredores</h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {brokers?.length ? (
            brokers.map((b) => (
              <div key={b.id} className="p-3 flex items-center justify-between">
                <span className="text-sm text-slate-800">{b.name}</span>
                <button onClick={() => void removeBroker(b.id)} className="text-xs text-red-500 hover:underline">
                  Eliminar
                </button>
              </div>
            ))
          ) : (
            <p className="p-3 text-sm text-slate-400">Aún no hay corredores. Se agregan desde "Agregar propiedad".</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Sincronización</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          {isSupabaseConfigured ? (
            <p className="text-emerald-600">✓ Supabase configurado — tus datos se sincronizan entre dispositivos cuando hay internet.</p>
          ) : (
            <p>
              Supabase no está configurado todavía. La app funciona 100% local y offline en este dispositivo, pero para
              compartir las calificaciones con tu pareja en otro celular hace falta conectar un proyecto de Supabase
              (ver <code className="bg-slate-100 px-1 rounded">README.md</code>).
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
