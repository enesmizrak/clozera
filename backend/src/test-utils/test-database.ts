import mongoose from 'mongoose'

const localHosts = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
  'mongodb',
  'mongo',
  'host.docker.internal',
])

interface TestTarget {
  uri: string
  databaseName: string
  host: string
  port: number
}

function normalizedHost(host: string): string {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) ? 'loopback' : host
}

/** Validates that integration tests can only ever touch a local `clozera-test*` database. */
function testDatabaseTarget(): TestTarget {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test database operations require NODE_ENV=test.')
  }

  const uri = process.env.TEST_MONGODB_CONNECTION_STRING
  if (!uri) {
    throw new Error('TEST_MONGODB_CONNECTION_STRING must be defined for integration tests.')
  }

  let target: URL
  let databaseName: string
  try {
    target = new URL(uri)
    databaseName = decodeURIComponent(target.pathname.slice(1))
  } catch {
    throw new Error('TEST_MONGODB_CONNECTION_STRING must be a valid local MongoDB URI.')
  }

  if (
    target.protocol !== 'mongodb:' ||
    !localHosts.has(target.hostname) ||
    !/^clozera[-_]test(?:[-_][a-z0-9_-]+)?$/.test(databaseName)
  ) {
    throw new Error(
      'Integration tests require a local MongoDB URI with a clozera-test or clozera_test database name.'
    )
  }

  return { uri, databaseName, host: normalizedHost(target.hostname), port: Number(target.port || 27017) }
}

function assertTestConnection(target: TestTarget): void {
  const { connection } = mongoose
  if (
    connection.readyState !== 1 ||
    connection.name !== target.databaseName ||
    normalizedHost(connection.host) !== target.host ||
    connection.port !== target.port
  ) {
    throw new Error(
      'Refusing to clear or reuse a MongoDB connection that does not match the validated test target.'
    )
  }
}

export async function connectTestDatabase(): Promise<void> {
  const target = testDatabaseTarget()
  if (mongoose.connection.readyState === 1) {
    assertTestConnection(target)
    return
  }

  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 2000 })
  } catch {
    throw new Error(
      'Could not connect to the integration test database. Start local MongoDB or update TEST_MONGODB_CONNECTION_STRING.'
    )
  }
  assertTestConnection(target)
}

export async function clearTestDatabase(): Promise<void> {
  const target = testDatabaseTarget()
  assertTestConnection(target)
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({}))
  )
}

export async function disconnectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) await mongoose.connection.close()
}
