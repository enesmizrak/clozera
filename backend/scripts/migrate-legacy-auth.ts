#!/usr/bin/env node
import { migrateLegacyCredentials } from '../src/auth/legacy-migration.ts'
import { runScript } from './lib/run-script.ts'

const USAGE = 'Usage: npm run auth:migrate-legacy -- [--apply] [--notify]'
const args = process.argv.slice(2)
if (
  args.some(arg => arg !== '--apply' && arg !== '--notify') ||
  (args.includes('--notify') && !args.includes('--apply'))
) {
  console.error(USAGE)
  console.error('--notify sends password reset links and requires --apply.')
  process.exit(1)
}

runScript(async ({ auth }) => {
  const apply = args.includes('--apply')
  const result = await migrateLegacyCredentials({ apply })

  console.log(`Users with passport-local-mongoose credentials: ${result.pending}`)
  for (const email of result.conflicts)
    console.log(`Skipped (email already used by another account): ${email}`)
  if (!apply) {
    console.log('Dry run: no changes written. Re-run with --apply to remove legacy passwords.')
    return
  }

  console.log(`Removed legacy passwords and verified the email of ${result.migrated} user(s).`)
  if (!args.includes('--notify')) {
    console.log(
      'They can set a new password with "Forgot password?". Re-run with --notify to email them a link.'
    )
    return
  }

  for (const email of result.migratedEmails) {
    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } })
    console.log(`Password reset link sent: ${email}`)
  }
})
