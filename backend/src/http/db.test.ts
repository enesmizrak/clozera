import { Cause, Effect, Exit } from 'effect'
import { describe, expect, it } from 'vite-plus/test'
import { db } from './db.ts'
import { Conflict } from './errors.ts'

describe('db', () => {
  it('names the last key of a compound duplicate key conflict', async () => {
    const exit = await Effect.runPromiseExit(
      db(() => Promise.reject({ code: 11000, keyValue: { languagePair: 'x', slug: 'y' } }))
    )

    expect(Exit.isFailure(exit)).toBe(true)
    const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    expect(failure).toBeInstanceOf(Conflict)
    expect((failure as Conflict).message).toContain('slug')
  })
})
