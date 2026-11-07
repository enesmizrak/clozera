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

  const existing = await User.findOne({ email })
  if (!existing) {
    if (!password) throw new Error('ADMIN_PASSWORD must be defined when creating a new admin user.')
    await auth.api.signUpEmail({ body: { name, email, password, username, timezone } })
  } else if (password) {
    await setCredentialPassword(auth, String(existing._id), password)
  }

  await User.updateOne(
    { email },
    { $set: { name, username, displayUsername: username, timezone, role: 'admin' } }
  )
  console.log(`${existing ? 'Updated' : 'Created'} admin user: ${email}`)
  console.log(
    password ? 'Password set from ADMIN_PASSWORD.' : 'Password unchanged. Set ADMIN_PASSWORD to change it.'
  )
})
