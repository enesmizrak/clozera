import { isIP } from 'node:net'

export interface ClientAddressConfig {
  /** A header set by a trusted edge with exactly one address, e.g. `cf-connecting-ip`. Empty = unused. */
  header: string
  /** Proxies in front of the web server that append to X-Forwarded-For. 0 = use the socket address. */
  trustedHops: number
}

export function clientAddressConfig(env: Record<string, string | undefined>): ClientAddressConfig {
  const hops = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? '0', 10)
  return {
    header: (env.CLIENT_IP_HEADER ?? '').trim().toLowerCase(),
    trustedHops: Number.isInteger(hops) && hops > 0 ? hops : 0,
  }
}

/** Resolves the visitor's address from the configured trusted source. Returns undefined when it cannot. */
export function resolveClientAddress(
  headers: Headers,
  socketAddress: string | undefined,
  config: ClientAddressConfig
): string | undefined {
  let candidate: string | undefined
  if (config.header) {
    candidate = headers.get(config.header)?.trim()
  } else if (config.trustedHops > 0) {
    const chain = (headers.get('x-forwarded-for') ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
    candidate = chain[chain.length - config.trustedHops]
  } else {
    candidate = socketAddress
  }
  return candidate && isIP(candidate) ? candidate : undefined
}
