import { pbkdf2, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { hashPassword, verifyPassword as verifyScryptPassword } from 'better-auth/crypto'

const pbkdf2Async = promisify(pbkdf2)

/** Parameters used by passport-local-mongoose 9, which created every account before Better Auth. */
const LEGACY = { prefix: 'pbkdf2-sha256', iterations: 25_000, keyLength: 512, digest: 'sha256' } as const

/** Encodes a passport-local-mongoose salt/hash pair so Better Auth can store it in a credential account. */
export function encodeLegacyHash(salt: string, hash: string): string {
  return [LEGACY.prefix, LEGACY.iterations, salt, hash].join('$')
}

async function verifyLegacyHash(encoded: string, password: string): Promise<boolean> {
  const [prefix, iterations, salt, hash] = encoded.split('$')
  if (prefix !== LEGACY.prefix || !iterations || !salt || !hash) return false

  const expected = Buffer.from(hash, 'hex')
  const actual = await pbkdf2Async(password, salt, Number(iterations), LEGACY.keyLength, LEGACY.digest)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export const passwordHasher = {
  hash: hashPassword,
  async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
    return hash.startsWith(`${LEGACY.prefix}$`)
      ? verifyLegacyHash(hash, password)
      : verifyScryptPassword({ hash, password })
  },
}
