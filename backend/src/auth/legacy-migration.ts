import mongoose, { type Types } from 'mongoose'
import { encodeLegacyHash } from './passwords.ts'

interface LegacyUser {
  _id: Types.ObjectId
  email: string
  username?: string
  displayUsername?: string
  emailVerified?: boolean
  hash: string
  salt: string
}

export interface LegacyMigrationResult {
  /** Users that still carry passport-local-mongoose credentials. */
  pending: number
  /** Users moved to Better Auth credential accounts in this run. */
  migrated: number
  /** Users skipped because their lowercased email collides with another account. */
  conflicts: string[]
}

/**
 * Moves passport-local-mongoose credentials into Better Auth credential accounts.
 * Password hashes are kept as-is and verified by `passwordHasher`, so nobody has to reset a password.
 * Runs as a dry run unless `apply` is true, and is safe to run repeatedly.
 */
export async function migrateLegacyCredentials({
  apply,
}: {
  apply: boolean
}): Promise<LegacyMigrationResult> {
  const users = mongoose.connection.collection<LegacyUser>('users')
  const accounts = mongoose.connection.collection('auth_accounts')
  const legacyUsers = await users.find({ hash: { $exists: true }, salt: { $exists: true } }).toArray()
  const result: LegacyMigrationResult = { pending: legacyUsers.length, migrated: 0, conflicts: [] }

  for (const user of legacyUsers) {
    // Better Auth looks up users by lowercased email.
    const email = user.email.trim().toLowerCase()
    const duplicate = await users.findOne({ _id: { $ne: user._id }, email })
    if (duplicate) {
      result.conflicts.push(email)
      continue
    }
    if (!apply) continue

    const now = new Date()
    await accounts.updateOne(
      { userId: user._id, providerId: 'credential' },
      {
        $setOnInsert: {
          userId: user._id,
          accountId: String(user._id),
          providerId: 'credential',
          password: encodeLegacyHash(user.salt, user.hash),
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    )
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          email,
          emailVerified: user.emailVerified ?? false,
          ...(user.username ? { username: user.username.toLowerCase() } : {}),
          ...(user.displayUsername || !user.username ? {} : { displayUsername: user.username }),
          updatedAt: now,
        },
        $unset: { hash: '', salt: '' },
      }
    )
    result.migrated += 1
  }

  return result
}
