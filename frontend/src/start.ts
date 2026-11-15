import { createMiddleware, createStart } from '@tanstack/react-start'
import { withSecurityHeaders } from '@/lib/security-headers'

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next()
  return { ...result, response: withSecurityHeaders(result.response) }
})

export const startInstance = createStart(() => ({ requestMiddleware: [securityHeaders] }))
