// Supabase Edge Function: lee un link de propiedad y extrae sus metadatos,
// en este orden de prioridad: 1) Open Graph / Twitter Card (título, imagen,
// descripción), 2) datos estructurados JSON-LD (schema.org) para precio, m²
// y recámaras, y 3) como último recurso, un lector de texto en español que
// busca esos mismos datos escritos en prosa dentro de la descripción o el
// resto de la página (ej. "departamento de tres recámaras", "120 m2",
// "$1,850,000").
// Se ejecuta en el servidor para evitar el bloqueo de CORS que casi todos
// los portales inmobiliarios aplican a peticiones hechas desde el navegador.
//
// Deploy: supabase functions deploy fetch-og

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function extractMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, 'i'),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match) return decodeHtmlEntities(match[1])
  }
  return undefined
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const digits = raw.replace(/[^\d.]/g, '')
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? decodeHtmlEntities(match[1].trim()) : undefined
}

// --- JSON-LD (schema.org) ---------------------------------------------

function collectJsonLdObjects(html: string): unknown[] {
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const objects: unknown[] = []
  for (const m of scripts) {
    try {
      const parsed: unknown = JSON.parse(m[1].trim())
      if (Array.isArray(parsed)) objects.push(...parsed)
      else objects.push(parsed)
    } catch {
      // bloque JSON-LD mal formado, se ignora
    }
  }
  const flat: unknown[] = []
  for (const obj of objects) {
    const graph = obj && typeof obj === 'object' ? (obj as Record<string, unknown>)['@graph'] : undefined
    if (Array.isArray(graph)) flat.push(...graph)
    else flat.push(obj)
  }
  return flat
}

function deepFind(obj: unknown, keys: string[], depth = 0): unknown {
  if (depth > 6 || obj == null || typeof obj !== 'object') return undefined
  const record = obj as Record<string, unknown>
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const found = deepFind(value, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function toNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val
  if (typeof val === 'string') {
    const n = Number(val.replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
    return toNumber((val as Record<string, unknown>).value)
  }
  return undefined
}

interface JsonLdExtract {
  price?: number
  description?: string
  m2?: number
  bedrooms?: number
}

function extractFromJsonLd(html: string): JsonLdExtract {
  const result: JsonLdExtract = {}
  for (const obj of collectJsonLdObjects(html)) {
    if (result.price === undefined) result.price = toNumber(deepFind(obj, ['price']))
    if (result.m2 === undefined) result.m2 = toNumber(deepFind(obj, ['floorSize']))
    if (result.bedrooms === undefined) {
      result.bedrooms = toNumber(deepFind(obj, ['numberOfRooms', 'numberOfBedroomsTotal', 'numberOfBedrooms']))
    }
    if (result.description === undefined) {
      const d = deepFind(obj, ['description'])
      if (typeof d === 'string' && d.trim()) result.description = decodeHtmlEntities(d.trim())
    }
  }
  return result
}

// --- Lectura de texto en español ---------------------------------------

const SPANISH_NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
}

const NUMBER_TOKEN = '(\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)'

function wordToNumber(raw: string): number | undefined {
  const cleaned = raw.trim().toLowerCase()
  if (/^\d+$/.test(cleaned)) return Number(cleaned)
  return SPANISH_NUMBER_WORDS[cleaned]
}

function extractVisibleText(html: string): string {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const noTags = noScripts.replace(/<[^>]+>/g, ' ')
  return decodeHtmlEntities(noTags).replace(/\s+/g, ' ').trim()
}

function guessCount(text: string, keywordPattern: string): number | undefined {
  const before = new RegExp(`${NUMBER_TOKEN}\\s*(?:${keywordPattern})`, 'i')
  const after = new RegExp(`(?:${keywordPattern})\\s*[:\\-]?\\s*${NUMBER_TOKEN}`, 'i')
  const match = text.match(before) ?? text.match(after)
  return match ? wordToNumber(match[1]) : undefined
}

function guessM2(text: string): number | undefined {
  const before = /(\d+(?:[.,]\d+)?)\s*(?:m²|m2|mts²|mts2|metros\s*cuadrados)/i
  const after = /(?:m²|m2|superficie)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i
  const match = text.match(before) ?? text.match(after)
  if (!match) return undefined
  const n = Number(match[1].replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseMoneyString(raw: string): number | undefined {
  const noCents = raw.replace(/\.(\d{2})$/, '')
  const digits = noCents.replace(/[^\d]/g, '')
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function guessPrice(text: string): number | undefined {
  const millones = text.match(/\$?\s?(\d+(?:[.,]\d+)?)\s*(?:millones|mdp)\b/i)
  if (millones) {
    const n = Number(millones[1].replace(',', '.'))
    if (Number.isFinite(n) && n > 0) return Math.round(n * 1_000_000)
  }
  // "$1,850,000" o "$ 1850000"
  const dollarAmount = text.match(/\$\s?(\d[\d.,]{3,})/)
  if (dollarAmount) {
    const n = parseMoneyString(dollarAmount[1])
    if (n) return n
  }
  // "MXN 1,850,000" / "1,850,000 MXN" / "1,850,000 pesos" -- sin signo de $
  const mxnAfter = text.match(/(\d[\d.,]{3,})\s*(?:MXN|mxn|pesos(?:\s+mexicanos)?)\b/i)
  if (mxnAfter) {
    const n = parseMoneyString(mxnAfter[1])
    if (n) return n
  }
  const mxnBefore = text.match(/(?:MXN|mxn)\s*\$?\s?(\d[\d.,]{3,})/)
  if (mxnBefore) {
    const n = parseMoneyString(mxnBefore[1])
    if (n) return n
  }
  return undefined
}

interface TextGuess {
  price?: number
  m2?: number
  bedrooms?: number
  bathrooms?: number
}

function guessFromText(text: string): TextGuess {
  return {
    price: guessPrice(text),
    m2: guessM2(text),
    bedrooms: guessCount(text, 'rec[aá]maras?|habitaciones?|dormitorios?'),
    bathrooms: guessCount(text, 'ba[ñn]os?'),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Falta el parámetro url' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CasaRatingBot/1.0; +https://example.com) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    const html = await res.text()
    const jsonLd = extractFromJsonLd(html)

    const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title') ?? extractTitleTag(html)
    const description =
      extractMeta(html, 'og:description') ??
      extractMeta(html, 'twitter:description') ??
      extractMeta(html, 'description') ??
      jsonLd.description
    const image = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image')
    const metaPrice = parsePrice(extractMeta(html, 'product:price:amount') ?? extractMeta(html, 'og:price:amount'))

    // Se busca tanto en el texto visible de toda la página (donde casi siempre
    // se muestra el precio de forma prominente) como en la descripción misma
    // (por si el precio o los detalles vienen redactados ahí en vez de en la página).
    const searchText = [description, extractVisibleText(html)].filter(Boolean).join(' ')
    const textGuess = guessFromText(searchText)
    const images = image ? [image] : []

    return new Response(
      JSON.stringify({
        title,
        description,
        images,
        price: metaPrice ?? jsonLd.price ?? textGuess.price,
        m2: jsonLd.m2 ?? textGuess.m2,
        bedrooms: jsonLd.bedrooms ?? textGuess.bedrooms,
        bathrooms: textGuess.bathrooms,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
