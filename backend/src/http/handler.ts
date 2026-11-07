import { Cause, Effect, Exit, Option } from 'effect'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { z } from 'zod'
import { env } from '../config/env.ts'
import { type AppError, errorResponse, validationFailed } from './errors.ts'

export interface Reply {
  status?: number
  body?: unknown
}

/** Sends typed failures as JSON API errors and forwards defects to the Express error handler. */
function fail(cause: Cause.Cause<AppError>, res: Response, next: NextFunction): void {
  const error = Cause.findErrorOption(cause)
  if (Option.isNone(error)) {
    next(Cause.squash(cause))
    return
  }
  if (error.value._tag === 'DatabaseError' && !env.isTest) console.error(error.value.cause)
  const { status, body } = errorResponse(error.value, env.isProduction)
  res.status(status).json(body)
}

/** Runs an Effect middleware step; success continues the chain. */
export function step(program: (req: Request) => Effect.Effect<void, AppError>): RequestHandler {
  return async (req, res, next) => {
    const exit = await Effect.runPromiseExit(Effect.suspend(() => program(req)))
    if (Exit.isSuccess(exit)) next()
    else fail(exit.cause, res, next)
  }
}

/**
 * Adapts an Effect program to an Express route. Programs return a Reply; an undefined body sends 204.
 */
export function handle(
  program: (req: Request, res: Response) => Effect.Effect<Reply, AppError>
): RequestHandler {
  return async (req, res, next) => {
    const exit = await Effect.runPromiseExit(Effect.suspend(() => program(req, res)))
    if (Exit.isFailure(exit)) {
      fail(exit.cause, res, next)
      return
    }
    const { status = 200, body } = exit.value
    if (body === undefined) res.status(status === 200 ? 204 : status).end()
    else res.status(status).json(body)
  }
}

export const ok = (data: unknown, meta?: unknown): Reply => ({
  body: meta === undefined ? { data } : { data, meta },
})
export const created = (data: unknown): Reply => ({ status: 201, body: { data } })
export const noContent: Reply = {}

/** Parses untrusted input with a Zod schema, failing with a 400 ValidationFailed error. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): Effect.Effect<z.output<S>, AppError> {
  const result = schema.safeParse(input ?? {})
  return result.success ? Effect.succeed(result.data) : Effect.fail(validationFailed(result.error))
}
