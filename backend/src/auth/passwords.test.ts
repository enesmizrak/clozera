import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vite-plus/test'
import { encodeLegacyHash, passwordHasher } from './passwords.ts'

/** Produces the same salt/hash pair that passport-local-mongoose 9 stored on users. */
function passportLocalMongooseHash(password: string) {
  const salt = randomBytes(32).toString('hex')
  const hash = pbkdf2Sync(password, salt, 25_000, 512, 'sha256').toString('hex')
  return { salt, hash }
}

describe('password hasher', () => {
  it('verifies passwords migrated from passport-local-mongoose', async () => {
    const { salt, hash } = passportLocalMongooseHash('secret123')
    const encoded = encodeLegacyHash(salt, hash)

    await expect(passwordHasher.verify({ hash: encoded, password: 'secret123' })).resolves.toBe(true)
    await expect(passwordHasher.verify({ hash: encoded, password: 'wrong-password' })).resolves.toBe(false)
  })

  it('rejects malformed legacy hashes', async () => {
    await expect(passwordHasher.verify({ hash: 'pbkdf2-sha256$25000$', password: 'x' })).resolves.toBe(false)
  })

  it('hashes new passwords with Better Auth scrypt', async () => {
    const hash = await passwordHasher.hash('secret123')
    expect(hash.startsWith('pbkdf2-sha256$')).toBe(false)
    await expect(passwordHasher.verify({ hash, password: 'secret123' })).resolves.toBe(true)
    await expect(passwordHasher.verify({ hash, password: 'secret124' })).resolves.toBe(false)
  })
})
