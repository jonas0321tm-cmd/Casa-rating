# Casa Rating

App para calificar y comparar casas/departamentos con una rúbrica de estrellas ponderada.
Funciona 100% offline (los datos se guardan en el celular con IndexedDB) y, si conectas
un proyecto de Supabase, sincroniza entre tu perfil y el de tu pareja.

## Correr en desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Sin ninguna configuración adicional, la app ya funciona
completa en un solo dispositivo (modo local: eliges tu perfil con el selector de arriba
a la derecha).

## Instalarla como app en el celular (PWA)

```bash
npm run build
npm run preview
```

Abre esa URL desde el navegador del celular (Chrome/Safari) y usa "Agregar a pantalla de
inicio". Queda instalada como app y funciona sin internet una vez cargada la primera vez.
Para publicarla de verdad (no solo en tu red local) hace falta subir el build a un hosting
gratuito como Vercel, Netlify o Cloudflare Pages — apunta el proyecto a este repo y listo.

## Activar la sincronización entre los dos perfiles (Supabase)

Esto es opcional — sin esto la app funciona perfecto en un solo dispositivo. Actívalo
cuando quieran ver las calificaciones del otro sin estar en el mismo celular.

1. Crea una cuenta gratis en [supabase.com](https://supabase.com) y un proyecto nuevo.
2. En el **SQL Editor** del proyecto, pega y corre el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) tal cual (ya trae los usuarios
   "Jonathan T" y "Michelle M" precargados en `allowed_users`; si alguien va a usar
   un nombre de usuario distinto, agrega su fila siguiendo el patrón que explica el
   comentario del archivo).
3. En **Project Settings → API**, copia la "Project URL" y la "anon public key".
4. Copia `.env.example` a `.env.local` y pega esos dos valores:
   ```bash
   cp .env.example .env.local
   ```
5. **Importante**: en **Authentication → Providers → Email**, apaga la opción
   "Confirm email". La app usa usuario/contraseña (no correo real) — el correo que
   genera por dentro es falso (`@casa-rating.local`), así que nunca les llegaría un
   email de confirmación. Si dejas esa opción prendida, nadie va a poder entrar
   después de crear su cuenta.
6. (Opcional pero recomendado) Despliega la función que lee los links automáticamente:
   ```bash
   npx supabase login
   npx supabase link --project-ref <tu-project-ref>
   npx supabase functions deploy fetch-og --no-verify-jwt
   ```
   Copia la URL que te da (`https://<project-ref>.functions.supabase.co/fetch-og`) en
   `VITE_OG_FUNCTION_URL` dentro de `.env.local`.
7. Reinicia `npm run dev` (o vuelve a hacer `npm run build`). Ahora, al abrir la app,
   pedirá crear cuenta / entrar con usuario y contraseña — cada quien crea la suya en
   su propio dispositivo la primera vez, y desde ahí sus calificaciones se sincronizan
   automáticamente.

## Cómo funciona el score

Cada criterio de la rúbrica tiene un peso (%, ajustable en **Ajustes**). El score de una
persona en una propiedad es el promedio ponderado de las estrellas que puso en los
criterios que sí calificó. El "score total" en la tabla comparativa es el promedio de los
scores de ambos perfiles.

## Límites conocidos

- La auto-lectura del link usa las etiquetas Open Graph que el portal publique (título,
  imagen, a veces precio). Casi ningún portal expone ahí m², recámaras o baños — esos
  se llenan a mano en 10 segundos.
- Si el portal no publica etiquetas Open Graph, el autocompletado no trae nada y hay que
  llenar el formulario manualmente (siempre funciona como respaldo).
