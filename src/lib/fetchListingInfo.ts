export interface ListingInfo {
  title?: string
  description?: string
  images: string[]
  price?: number
  currency?: string
  m2?: number
  bedrooms?: number
  bathrooms?: number
}

// En dev/preview esto lo atiende el propio servidor de Vite (server/fetchOg.ts).
// Si conectan una Edge Function de Supabase para producción, VITE_OG_FUNCTION_URL
// la reemplaza sin tocar el resto del código.
const OG_FUNCTION_URL = import.meta.env.VITE_OG_FUNCTION_URL as string | undefined
const FUNCTION_URL = OG_FUNCTION_URL || '/api/fetch-og'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Pide que se lea la URL de la propiedad del lado del servidor y se extraigan
 * sus metadatos Open Graph (título, imagen, descripción, precio si el portal
 * lo expone). Requiere internet para alcanzar el sitio de la propiedad.
 */
export async function fetchListingInfo(url: string): Promise<ListingInfo> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Las Edge Functions de Supabase exigen una llave por defecto -- la
  // pública (anon) alcanza, es la misma que ya usa el cliente de Supabase.
  if (OG_FUNCTION_URL && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`
    headers.apikey = SUPABASE_ANON_KEY
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    throw new Error(`Error al leer el link: ${res.status}`)
  }
  const data = (await res.json()) as ListingInfo
  return { ...data, images: data.images ?? [] }
}
