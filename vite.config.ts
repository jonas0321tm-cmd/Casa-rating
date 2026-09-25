import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import { fetchOg } from './server/fetchOg.ts'

function fetchOgMiddlewarePlugin(): Plugin {
  const handler = async (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse,
  ) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      void (async () => {
        try {
          const { url } = JSON.parse(body) as { url?: string }
          if (!url) throw new Error('Falta url')
          const info = await fetchOg(url)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(info))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })()
    })
  }

  return {
    name: 'fetch-og-middleware',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/fetch-og', handler)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use('/api/fetch-og', handler)
    },
  }
}

// GitHub Pages sirve el proyecto bajo /Casa-rating/, no en la raíz del
// dominio -- pero eso solo aplica al build de producción; en desarrollo
// local (npm run dev / preview en la red de casa) se sigue usando la raíz.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Casa-rating/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    fetchOgMiddlewarePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Casa Rating',
        short_name: 'Casa Rating',
        description: 'Califica y compara casas y departamentos con tu pareja',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        // Rutas relativas (sin "/" inicial): el navegador las resuelve contra
        // la URL del propio manifest.webmanifest, así funcionan igual en la
        // raíz (red local) que bajo /Casa-rating/ (GitHub Pages).
        start_url: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/auth/v1'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
}))
