import { createFileRoute } from '@tanstack/react-router'
import { getRequestIP } from '@tanstack/react-start/server'
import { clientAddressConfig, resolveClientAddress } from '../../lib/client-address'

/** Response headers that describe the upstream body encoding, which `fetch` has already decoded. */
const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']

/** Request headers that carry a client address or describe the hop; the proxy sets its own. */
const STRIPPED_REQUEST_HEADERS = [
  'host',
  'x-forwarded-for',
  'forwarded',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
]

const clientAddress = clientAddressConfig(process.env)

/**
 * Same-origin proxy to the Express API. Keeping `/api` on the web origin makes the Better Auth
 * session cookie first-party, so it works in browsers that block third-party cookies and is
 * visible to SSR. The visitor address is resolved from a trusted source (src/lib/client-address.ts)
 * and forwarded as a single X-Forwarded-For value.
 */
async function proxy({ request }: { request: Request }): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(
    incoming.pathname + incoming.search,
    process.env.API_INTERNAL_URL ?? 'http://localhost:3000'
  )

  const address = resolveClientAddress(request.headers, getRequestIP(), clientAddress)
  const headers = new Headers(request.headers)
  for (const header of STRIPPED_REQUEST_HEADERS) headers.delete(header)
  if (address) headers.set('x-forwarded-for', address)
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  // API payloads are small JSON documents. Buffering them (instead of streaming) keeps Node's
  // fetch from failing when the API answers 401, which the Fetch spec treats as retryable.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      signal: request.signal,
    })
  } catch (error) {
    if (request.signal.aborted) throw error
    return Response.json(
      { error: { code: 'BAD_GATEWAY', message: 'The service is temporarily unavailable.', details: [] } },
      { status: 502 }
    )
  }

  const responseHeaders = new Headers(upstream.headers)
  for (const header of HOP_BY_HOP) responseHeaders.delete(header)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: { GET: proxy, POST: proxy, PUT: proxy, PATCH: proxy, DELETE: proxy, OPTIONS: proxy },
  },
})
