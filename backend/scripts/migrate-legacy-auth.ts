#!/usr/bin/env node
import { migrateLegacyCredentials } from '../src/auth/legacy-migration.ts'
import { runScript } from './lib/run-script.ts'

const args = process.argv.slice(2)
if (args.some(arg => arg !== '--apply')) {
  console.error('Usage: npm run auth:migrate-legacy -- [--apply]')
  process.exit(1)
}

runScript(async () => {
  const apply = args.includes('--apply')
  const result = await migrateLegacyCredentials({ apply })

  console.log(`Users with passport-local-mongoose credentials: ${result.pending}`)
  for (const email of result.conflicts)
    console.log(`Skipped (email already used by another account): ${email}`)
  console.log(
    apply
      ? `Moved ${result.migrated} credential(s) to Better Auth.`
      : 'Dry run: no changes written. Re-run with --apply to migrate.'
  )
})
