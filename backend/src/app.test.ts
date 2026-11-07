import { memoryAdapter } from 'better-auth/adapters/memory'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { createApp } from './app.ts'
import { createAuth } from './auth/auth.ts'

const app = createApp(createAuth(memoryAdapter({})))

describe('app', () => {
  beforeEach(() => {
    app.locals.shuttingDown = false
  })

  it('reports not ready while MongoDB is disconnected', async () => {
    const response = await request(app).get('/health/ready')
    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'not_ready' })
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('returns a null session for anonymous requests', async () => {
    const response = await request(app).get('/api/session')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: null })
  })

  it('rejects protected routes without a session', async () => {
    const response = await request(app).get('/api/collections')
    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.', details: [] },
    })
  })

  it('rejects admin routes without a session', async () => {
    const response = await request(app).post('/api/admin/languages/import').send({ languages: [] })
    expect(response.status).toBe(401)
  })

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await request(app).get('/does-not-exist')
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.', details: [] } })
  })

  it('serves Better Auth under /api/auth', async () => {
    const response = await request(app).get('/api/auth/get-session')
    expect(response.status).toBe(200)
    expect(response.body).toBeNull()
  })
})
