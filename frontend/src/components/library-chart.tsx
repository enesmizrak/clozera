import type { CollectionDto } from '@clozera/shared'
import { barX, defineChart } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { Chart } from '@tanstack/react-charts'
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Row {
  id: string
  name: string
  sentences: number
}

const MAX_ROWS = 8

/** Largest collections first; repeated names get a "(2)" suffix so each bar has its own band. */
export function chartRows(collections: readonly CollectionDto[]): Row[] {
  const seen = new Map<string, number>()
  return collections
    .map(collection => ({ id: collection.id, name: collection.name, sentences: collection.sentenceCount }))
    .toSorted((left, right) => right.sentences - left.sentences)
    .slice(0, MAX_ROWS)
    .map(row => {
      const count = (seen.get(row.name) ?? 0) + 1
      seen.set(row.name, count)
      return count === 1 ? row : { ...row, name: `${row.name} (${count})` }
    })
}

/**
 * Answers "where is most of my practice material?" for pinned collections:
 * named-category magnitudes, so sorted horizontal bars with an accessible table equivalent.
 */
export function LibraryChart({ collections }: { collections: readonly CollectionDto[] }) {
  const rows = useMemo(() => chartRows(collections), [collections])

  const definition = useMemo(
    () =>
      defineChart(({ width }) => ({
        marks: [barX(rows, { x: 'sentences', y: 'name', fill: 'var(--chart-1)' })],
        scales: {
          x: {
            scale: scaleLinear,
            nice: true,
            axis: { ticks: { count: width < 420 ? 3 : 5 }, label: 'Sentences' },
          },
          y: { scale: () => scaleBand<string>().padding(0.2) },
        },
      })),
    [rows]
  )

  if (rows.length < 2) return null
  const total = collections.reduce((sum, collection) => sum + collection.sentenceCount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Practice material</h2>
        </CardTitle>
        <CardDescription>
          {total.toLocaleString('en-US')} sentences across {collections.length} pinned collections
          {collections.length > MAX_ROWS ? ` (top ${MAX_ROWS} shown)` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <Chart
          definition={definition}
          height={Math.max(160, rows.length * 36 + 48)}
          ariaLabel="Sentences per pinned collection"
          ariaDescription="Horizontal bars sorted from the largest collection to the smallest."
        />
        <table className="sr-only">
          <caption>Sentences per pinned collection</caption>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>{row.sentences}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
