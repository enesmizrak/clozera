import type { Auth } from './auth.ts'

/** Sets (or creates) the email/password credential for a user, hashing with Better Auth. */
export async function setCredentialPassword(auth: Auth, userId: string, password: string): Promise<void> {
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
}
