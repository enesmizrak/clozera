#!/usr/bin/env node
import { setCredentialPassword } from '../src/auth/credentials.ts'
import { User } from '../src/models/user.ts'
import { requireEnv, runScript } from './lib/run-script.ts'

runScript(async ({ auth }) => {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const username = (process.env.ADMIN_USERNAME ?? email.split('@')[0] ?? 'admin').trim().toLowerCase()
  const name = (process.env.ADMIN_NAME ?? username).trim()
  const timezone = (process.env.ADMIN_TIMEZONE ?? 'UTC').trim()

  let user = await User.findOne({ email })
  if (!user) {
    if (!password) throw new Error('ADMIN_PASSWORD must be defined when creating a new admin user.')
    // Created directly: the operator controls this address, so no verification email is sent.
    const context = await auth.$context
    const created = await context.internalAdapter.createUser(
      { name, email, emailVerified: true, username, displayUsername: username, timezone },
      { method: 'admin' }
    )
    user = await User.findById(created.id).orFail()
  }
  if (password) await setCredentialPassword(auth, String(user._id), password)

  await User.updateOne(
    { _id: user._id },
    { $set: { name, username, displayUsername: username, timezone, role: 'admin', emailVerified: true } }
  )
  console.log(`Admin user ready: ${email}`)
  console.log(
    password ? 'Password set from ADMIN_PASSWORD.' : 'Password unchanged. Set ADMIN_PASSWORD to change it.'
  )
})
