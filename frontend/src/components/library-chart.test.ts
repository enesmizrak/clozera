import type { CollectionDto } from '@clozera/shared'
import { describe, expect, it } from 'vite-plus/test'
import { chartRows } from './library-chart'

const make = (id: string, name: string, sentenceCount: number) =>
  ({ id, name, sentenceCount }) as unknown as CollectionDto

describe('chartRows', () => {
  it('keeps ids distinct and de-duplicates repeated names', () => {
    const rows = chartRows([make('a', 'Verbs', 10), make('b', 'Verbs', 5), make('c', 'Nouns', 7)])

    expect(rows.map(row => row.name)).toEqual(['Verbs', 'Nouns', 'Verbs (2)'])
    expect(new Set(rows.map(row => row.id)).size).toBe(3)
  })
})
