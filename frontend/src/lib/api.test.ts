import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { api } from './api'

// Tests run outside the Start server runtime, so there is no request to read cookies from.
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeader: () => undefined }))

function stubLibrary(total: number) {
  const started: number[] = []
  const resolvers: Array<() => void> = []
  const fetchMock = vi.fn<(input: string) => Promise<Response>>(async input => {
    const url = new URL(input, 'http://localhost')
    const page = Number(url.searchParams.get('page'))
    started.push(page)
    // Pages after the first wait until released, so serial loading would stall.
    if (page > 1) await new Promise<void>(resolve => resolvers.push(resolve))
    const from = (page - 1) * 100
    const count = Math.max(Math.min(100, total - from), 0)
    const collections = Array.from({ length: count }, (_, i) => ({ id: `c${from + i}` }))
    return new Response(JSON.stringify({ data: { collections }, meta: { total, page, perPage: 100 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, started, resolvers }
}

describe('api.collections', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads every page in page order, requesting the remaining pages in parallel', async () => {
    const { fetchMock, started, resolvers } = stubLibrary(250)

    const result = api.collections('deu-eng')
    await vi.waitFor(() => expect(started).toEqual([1, 2, 3]))
    for (const release of resolvers.toReversed()) release()
    const rows = await result

    expect(rows.map(row => row.id)).toEqual(Array.from({ length: 250 }, (_, i) => `c${i}`))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops at the page ceiling and warns', async () => {
    const { fetchMock, resolvers } = stubLibrary(2500)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = api.collections('deu-eng')
    await vi.waitFor(() => expect(resolvers).toHaveLength(19))
    for (const release of resolvers) release()
    const rows = await result

    expect(rows).toHaveLength(2000)
    expect(fetchMock).toHaveBeenCalledTimes(20)
    expect(warn).toHaveBeenCalledWith('Library truncated at 2000 rows')
  })
})

describe('api path building', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('encodes ids so they cannot escape their path segment', async () => {
    const fetchMock = vi.fn<(input: string) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ data: { id: 'x' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.collection('../users/me')

    const url = new URL(fetchMock.mock.calls[0]![0], 'http://localhost')
    expect(url.pathname.endsWith('/collections/..%2Fusers%2Fme')).toBe(true)
  })
})
