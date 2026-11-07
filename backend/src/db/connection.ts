import mongoose from 'mongoose'
import { env } from '../config/env.ts'

export async function connectDatabase(uri = env.MONGODB_CONNECTION_STRING): Promise<void> {
  if (!uri) throw new Error('MONGODB_CONNECTION_STRING must be defined.')
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}

/** The native driver database behind Mongoose, shared with Better Auth. */
export function nativeDatabase() {
  const db = mongoose.connection.db
  if (!db) throw new Error('The database must be connected before it is used.')
  return db
}
