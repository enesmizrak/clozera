import { createAuthClient } from 'better-auth/client'
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins'

/** Better Auth runs on the API; the browser reaches it through the same-origin `/api/auth` proxy. */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  // `callbackURL` is only for emailed links. The app navigates itself after sign-in; Better Auth's
  // default redirect would otherwise reload the page and override `?redirect=`.
  disableDefaultFetchPlugins: true,
  plugins: [
    usernameClient(),
    inferAdditionalFields({ user: { timezone: { type: 'string', required: false } } }),
  ],
})

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
