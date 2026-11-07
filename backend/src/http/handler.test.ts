import { Effect } from 'effect'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vite-plus/test'
import { z } from 'zod'
import { Conflict, DatabaseError, Forbidden, NotFound } from './errors.ts'
import { created, handle, noContent, ok, parse } from './handler.ts'

function appWith(program: Parameters<typeof handle>[0]) {
  const app = express()
  app.use(express.json())
  app.post('/', handle(program))
  return app
}

describe('Effect route adapter', () => {
  it('sends data, created and no-content replies', async () => {
    expect((await request(appWith(() => Effect.succeed(ok({ a: 1 }, { total: 1 })))).post('/')).body).toEqual(
      {
        data: { a: 1 },
        meta: { total: 1 },
      }
    )
    expect((await request(appWith(() => Effect.succeed(created('x')))).post('/')).status).toBe(201)
    expect((await request(appWith(() => Effect.succeed(noContent))).post('/')).status).toBe(204)
  })

  it.each([
    [new NotFound({ message: 'Missing.' }), 404, 'NOT_FOUND'],
    [new Forbidden({ message: 'No.' }), 403, 'FORBIDDEN'],
    [new Conflict({ message: 'Taken.' }), 409, 'CONFLICT'],
    [new DatabaseError({ cause: new Error('boom') }), 500, 'INTERNAL_SERVER_ERROR'],
  ])('maps %s to an API error', async (error, status, code) => {
    const response = await request(appWith(() => Effect.fail(error))).post('/')
    expect(response.status).toBe(status)
    expect(response.body.error.code).toBe(code)
  })

  it('turns schema failures into field-level validation errors', async () => {
    const schema = z.object({ name: z.string().min(1, 'Name is required.') })
    const response = await request(appWith(req => Effect.map(parse(schema, req.body), ok)))
      .post('/')
      .send({ name: '' })

    expect(response.status).toBe(400)
    expect(response.body.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Name is required.',
      details: [{ field: 'name', message: 'Name is required.' }],
    })
  })
})
