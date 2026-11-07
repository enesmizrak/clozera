import { createAuthClient } from 'better-auth/client'
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins'

/** Better Auth runs on the API; the browser reaches it through the same-origin `/api/auth` proxy. */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [
    usernameClient(),
    inferAdditionalFields({ user: { timezone: { type: 'string', required: false } } }),
  ],
})

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
