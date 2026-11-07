import { z } from 'zod'

/** Shared search params for login and sign-up: where to continue after authenticating. */
export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
})
