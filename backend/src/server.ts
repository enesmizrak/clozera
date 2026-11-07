import { once } from 'node:events'
import http from 'node:http'
import mongoose from 'mongoose'
import { createAuth, mongoAuthDatabase } from './auth/auth.ts'
import { env } from './config/env.ts'
import { connectDatabase, disconnectDatabase, nativeDatabase } from './db/connection.ts'
import { createApp } from './app.ts'

const SHUTDOWN_TIMEOUT_MS = 8000

async function main() {
  await connectDatabase()
  const auth = createAuth(mongoAuthDatabase(nativeDatabase(), mongoose.connection.getClient()))
  const app = createApp(auth)
  const server = http.createServer(app)

  server.listen(env.PORT)
  await once(server, 'listening')
  console.log(`Clozera API listening on port ${env.PORT}`)

  let shuttingDown = false
  async function shutdown(exitCode = 0) {
    if (shuttingDown) return
    shuttingDown = true
    app.locals.shuttingDown = true

    const timeout = setTimeout(() => {
      console.error('Graceful shutdown timed out.')
      server.closeAllConnections()
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    timeout.unref()

    try {
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
      await disconnectDatabase()
      process.exitCode = exitCode
      clearTimeout(timeout)
    } catch (error) {
      console.error('Shutdown failed:', (error as Error).message)
      process.exitCode = 1
    }
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error('HTTP server failed:', error.code ?? error.name)
    void shutdown(1)
  })
}

main().catch(async (error: NodeJS.ErrnoException) => {
  // Never log the connection URI or credentials on startup failure.
  console.error(
    'Server startup failed:',
    error.code ?? error.name,
    error.name === 'Error' ? error.message : ''
  )
  process.exitCode = 1
  await disconnectDatabase()
})
