import { type SentenceDto, sentenceParts } from '@clozera/shared'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
})

const column = createColumnHelper<typeof features, SentenceDto>()

function ClozeSentence({ text }: { text: string }) {
  return (
    <span className="leading-relaxed">
      {sentenceParts(text).map((part, index) =>
        part.isCloze ? (
          <Badge key={index} variant="secondary" className="text-sm">
            {part.text}
          </Badge>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}

interface SentencesTableProps {
  sentences: SentenceDto[]
  canEdit: boolean
  onEdit: (sentence: SentenceDto) => void
  onDelete: (sentence: SentenceDto) => void
}

const PAGE_SIZE = 25

/** Searchable, paginated sentence list. Filtering and paging run on the locally synced collection. */
export function SentencesTable({ sentences, canEdit, onEdit, onDelete }: SentencesTableProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE })

  const columns = useMemo(
    () =>
      column.columns([
        column.display({
          id: 'position',
          header: '#',
          cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.index + 1}</span>,
        }),
        column.accessor('text', {
          header: 'Sentence',
          cell: ({ getValue }) => <ClozeSentence text={getValue()} />,
        }),
        column.accessor('translation', {
          header: 'Translation',
          cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
        }),
        column.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) =>
            canEdit && (
              <div className="flex justify-end gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit sentence"
                  onClick={() => onEdit(row.original)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete sentence"
                  onClick={() => onDelete(row.original)}
                >
                  <Trash2 />
                </Button>
              </div>
            ),
        }),
      ]),
    [canEdit, onEdit, onDelete]
  )

  const table = useTable({
    features,
    columns,
    data: sentences,
    state: { globalFilter, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: target => target.id === 'text' || target.id === 'translation',
  })

  const rows = table.getRowModel().rows
  const pageCount = table.getPageCount()

  return (
    <div className="space-y-4">
      <InputGroup className="max-w-sm">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search sentences"
          placeholder="Search sentences or translations"
          value={globalFilter}
          onChange={event => table.setGlobalFilter(event.target.value)}
        />
      </InputGroup>
      {rows.length ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(group => (
                <TableRow key={group.id}>
                  {group.headers.map(header => (
                    <TableHead
                      key={header.id}
                      className={header.column.id === 'position' ? 'w-12' : undefined}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  {row.getAllCells().map(cell => (
                    <TableCell key={cell.id} className="align-top whitespace-normal">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{globalFilter ? 'No matches found.' : 'No sentences yet.'}</EmptyTitle>
            <EmptyDescription>
              {globalFilter ? 'Try a different word or translation.' : 'Sentences you add appear here.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {pageCount > 1 && (
        <nav aria-label="Sentence pages" className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft />
            Previous
          </Button>
          <p className="text-sm tabular-nums">
            Page {pagination.pageIndex + 1} / {pageCount}
          </p>
          <Button variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            Next
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  )
}
