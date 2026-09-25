const FAKE_EMAIL_DOMAIN = 'casa-rating.local'

/**
 * Supabase Auth necesita un email para identificar la cuenta aunque el login
 * sea por usuario/contraseña. Convertimos el nombre de usuario en un email
 * sintético y determinista, para que la persona nunca tenga que escribir ni
 * ver un correo real.
 */
export function usernameToEmail(username: string): string {
  const slug = username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug}@${FAKE_EMAIL_DOMAIN}`
}
