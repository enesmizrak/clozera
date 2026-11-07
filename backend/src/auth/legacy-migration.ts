import mongoose, { type Types } from 'mongoose'

interface LegacyUser {
  _id: Types.ObjectId
  email: string
  username?: string
  displayUsername?: string
}

export interface LegacyMigrationResult {
  /** Users that still carry passport-local-mongoose credentials. */
  pending: number
  /** Users migrated in this run. */
  migrated: number
  /** Lowercased emails of migrated users, for sending password reset links. */
  migratedEmails: string[]
  /** Users skipped because their lowercased email collides with another account. */
  conflicts: string[]
}

/**
 * Retires passport-local-mongoose credentials. Their PBKDF2 hashes (25,000 iterations) are too weak
 * to keep, so they are deleted rather than moved: migrated learners set a new password through the
 * password reset flow, which creates their Better Auth credential. Known accounts are marked as
 * email-verified so the reset link is all they need.
 *
 * Runs as a dry run unless `apply` is true, and is safe to run repeatedly.
 */
export async function migrateLegacyCredentials({
  apply,
}: {
  apply: boolean
}): Promise<LegacyMigrationResult> {
  const users = mongoose.connection.collection<LegacyUser>('users')
  const legacyUsers = await users
    .find({ $or: [{ hash: { $exists: true } }, { salt: { $exists: true } }] })
    .project<LegacyUser>({ email: 1, username: 1, displayUsername: 1 })
    .toArray()
  const result: LegacyMigrationResult = {
    pending: legacyUsers.length,
    migrated: 0,
    migratedEmails: [],
    conflicts: [],
  }

  for (const user of legacyUsers) {
    // Better Auth looks up users by lowercased email.
    const email = user.email.trim().toLowerCase()
    if (await users.findOne({ _id: { $ne: user._id }, email })) {
      result.conflicts.push(email)
      continue
    }
    if (!apply) continue

    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          email,
          emailVerified: true,
          ...(user.username ? { username: user.username.toLowerCase() } : {}),
          ...(user.displayUsername || !user.username ? {} : { displayUsername: user.username }),
          updatedAt: new Date(),
        },
        $unset: { hash: '', salt: '' },
      }
    )
    result.migrated += 1
    result.migratedEmails.push(email)
  }

  return result
}
