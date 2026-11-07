import { toNodeHandler } from 'better-auth/node'
import cors from 'cors'
import express, { type ErrorRequestHandler } from 'express'
import morgan from 'morgan'
import { AUTH_BASE_PATH, type Auth } from './auth/auth.ts'
import { env } from './config/env.ts'
import { isDatabaseReady } from './db/connection.ts'
import { adminRouter } from './routes/admin.ts'
import { collectionsRouter } from './routes/collections.ts'
import { languagesRouter } from './routes/languages.ts'
import { usersRouter } from './routes/users.ts'

export function createApp(auth: Auth) {
  const app = express()
  app.locals.shuttingDown = false
  app.disable('x-powered-by')
  // Cloud Run and the web app's `/api` proxy terminate TLS in front of the API.
  app.set('trust proxy', env.isProduction ? 1 : 'loopback')

  // Probes do not need authentication, sessions or a database query.
  app.get('/health/ready', (_req, res) => {
    const ready = !app.locals.shuttingDown && isDatabaseReady()
    res.set('Cache-Control', 'no-store')
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' })
  })

  // Browsers normally reach the API through the web app's same-origin `/api` proxy.
  // CORS stays enabled for tools and direct calls from the configured frontend origin.
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }))
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'))

  // Better Auth parses its own request bodies, so it is mounted before express.json().
  app.all(`${AUTH_BASE_PATH}/{*path}`, toNodeHandler(auth))

  app.use(express.json({ limit: '1mb' }))
  app.use('/api', languagesRouter(), usersRouter(auth), collectionsRouter(auth), adminRouter(auth))

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.', details: [] } })
  })

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (!env.isTest) console.error(error)
    const status = (error as { status?: number }).status ?? 500
    const message =
      status < 500 || !env.isProduction ? String((error as Error).message) : 'Unexpected server error.'
    res
      .status(status)
      .json({ error: { code: status < 500 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR', message, details: [] } })
  }
  app.use(errorHandler)

  return app
}
