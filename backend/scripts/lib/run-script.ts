import mongoose from 'mongoose'
import { createAuth, mongoAuthDatabase, type Auth } from '../../src/auth/auth.ts'
import { connectDatabase, nativeDatabase } from '../../src/db/connection.ts'
import { createMailer } from '../../src/email/mailer.ts'

/** Connects to MongoDB, runs a maintenance task and always disconnects. Errors set a failing exit code. */
export function runScript(task: (context: { auth: Auth }) => Promise<void>): void {
  const run = async () => {
    try {
      await connectDatabase()
      // Scripts exit when the task ends, so they wait for every email to be delivered.
      await task({
        auth: createAuth(mongoAuthDatabase(nativeDatabase()), createMailer({ background: false })),
      })
    } catch (error) {
      // Avoid printing connection details or credentials from driver errors.
      const { name, message } = error as Error
      console.error(name === 'Error' ? message : `Failed (${name}).`)
      process.exitCode = 1
    } finally {
      await mongoose.disconnect()
    }
  }
  void run()
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} must be defined.`)
  return value
}
