import { describe, expect, it, vi } from 'vite-plus/test'
import { ensureLearnerScope } from './collections'
import { endLearnerSession, notifySessionLost, onSessionLost } from './learner-session'
import { getQueryClient } from './query-client'

function steps(log: string[], prefix = '') {
  return {
    clearSession: () => void log.push(`${prefix}clear`),
    navigate: async () => void log.push(`${prefix}navigate`),
    reset: async () => void log.push(`${prefix}reset`),
    invalidate: async () => void log.push(`${prefix}invalidate`),
  }
}

describe('session loss notifications', () => {
  it('calls every listener until it unsubscribes', () => {
    const a = vi.fn<() => void>()
    const b = vi.fn<() => void>()
    const offA = onSessionLost(a)
    const offB = onSessionLost(b)
    notifySessionLost()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    notifySessionLost()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
    offB()
  })
})

describe('endLearnerSession', () => {
  it('runs the steps in order', async () => {
    const log: string[] = []
    await endLearnerSession(steps(log))
    expect(log).toEqual(['clear', 'navigate', 'reset', 'invalidate'])
  })

  it('shares one run between overlapping calls, using the first navigate', async () => {
    const log: string[] = []
    const first = endLearnerSession(steps(log, 'a:'))
    const second = endLearnerSession(steps(log, 'b:'))
    await Promise.all([first, second])
    expect(log).toEqual(['a:clear', 'a:navigate', 'a:reset', 'a:invalidate'])
  })

  it('runs again after the previous run settled', async () => {
    const log: string[] = []
    await endLearnerSession(steps(log))
    await endLearnerSession(steps(log))
    expect(log).toHaveLength(8)
  })
})

describe('ensureLearnerScope', () => {
  it('keeps data for the same learner and drops it for a different one', async () => {
    const client = getQueryClient()
    client.setQueryData(['collection', 'x'], {})
    client.setQueryData(['session'], { id: 'a' })
    await ensureLearnerScope('a')
    await ensureLearnerScope('a')
    expect(client.getQueryData(['collection', 'x'])).toBeDefined()
    await ensureLearnerScope('b')
    expect(client.getQueryData(['collection', 'x'])).toBeUndefined()
    expect(client.getQueryData(['session'])).toEqual({ id: 'a' })
  })
})
