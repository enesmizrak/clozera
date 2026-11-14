import { passwordSchema } from '@clozera/shared'
import type { Auth } from './auth.ts'

/** Sets (or creates) the email/password credential and ends the user's sessions, as the web reset flow does. */
export async function setCredentialPassword(auth: Auth, userId: string, password: string): Promise<void> {
  const parsed = passwordSchema.safeParse(password)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid password.')

  const context = await auth.$context
  const hash = await context.password.hash(password)
  const accounts = await context.internalAdapter.findAccounts(userId)

  if (accounts.some(account => account.providerId === 'credential')) {
    await context.internalAdapter.updatePassword(userId, hash)
  } else {
    await context.internalAdapter.linkAccount({
      userId,
      providerId: 'credential',
      accountId: userId,
      password: hash,
    })
  }

  await context.internalAdapter.deleteUserSessions(userId)
}
