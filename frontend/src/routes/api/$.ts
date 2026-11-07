import { createFileRoute } from '@tanstack/react-router'

/** Response headers that describe the upstream body encoding, which `fetch` has already decoded. */
const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length']

/**
 * Same-origin proxy to the Express API. Keeping `/api` on the web origin makes the Better Auth
 * session cookie first-party, so it works in browsers that block third-party cookies and is
 * visible to SSR.
 */
async function proxy({ request }: { request: Request }): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(
    incoming.pathname + incoming.search,
    process.env.API_INTERNAL_URL ?? 'http://localhost:3000'
  )

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('x-forwarded-host', incoming.host)
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  // API payloads are small JSON documents. Buffering them (instead of streaming) keeps Node's
  // fetch from failing when the API answers 401, which the Fetch spec treats as retryable.
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
    signal: request.signal,
  })

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
