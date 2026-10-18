import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Columns3,
  Download,
  FileUp,
  Filter,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Plus,
  Search,
  Table2,
  Trash2,
} from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type {
  CollectionSchema,
  FieldDef,
  Item,
  ItemValue,
} from '@/services/api'
import { areasApi, collectionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'

type CollectionView = 'table' | 'cards' | 'gallery' | 'timeline'
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})
const today = new Date().toISOString().slice(0, 10)
const currentTime = Date.now()

interface InventoryData {
  area: Awaited<ReturnType<typeof areasApi.getArea>>
  collection: CollectionSchema | null
  items: Item[]
}

async function loadCollection(
  areaId: string,
  collectionId: string,
): Promise<InventoryData> {
  const [area, collection, items] = await Promise.all([
    areasApi.getArea(areaId),
    collectionsApi.getCollection(collectionId),
    collectionsApi.listCollectionItems(collectionId),
  ])
  return { area, collection, items }
}

function formatValue(value: ItemValue | undefined, field: FieldDef) {
  if (value === undefined || value === null || value === '') return 'Not set'
  if (field.type === 'currency' && typeof value === 'number')
    return money.format(value)
  if (field.type === 'checkbox') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return value.title
  if (field.type === 'date' && typeof value === 'string')
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  return `${value}${field.unit ? ` ${field.unit}` : ''}`
}

function getCellText(value: ItemValue | undefined) {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return value.title
  return String(value)
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/)
  const parseLine = (line: string) => {
    const values: string[] = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      if (character === '"' && line[index + 1] === '"' && quoted) {
        current += '"'
        index += 1
      } else if (character === '"') quoted = !quoted
      else if (character === ',' && !quoted) {
        values.push(current)
        current = ''
      } else current += character
    }
    values.push(current)
    return values
  }
  return {
    headers: parseLine(lines[0] ?? ''),
    rows: lines.slice(1).filter(Boolean).map(parseLine),
  }
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function VirtualTable({
  items,
  visibleFields,
  selected,
  sortBy,
  sortDirection,
  onSort,
  onToggle,
  onEdit,
}: {
  items: Item[]
  visibleFields: FieldDef[]
  selected: Set<string>
  sortBy: string
  sortDirection: 'asc' | 'desc'
  onSort: (fieldId: string) => void
  onToggle: (id: string) => void
  onEdit: (item: Item, field: FieldDef, value: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Virtualizer instances are mutable and must be read directly each render.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 53,
    overscan: 8,
  })
  const [editing, setEditing] = useState<{
    itemId: string
    fieldId: string
  } | null>(null)
  const rowItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={scrollRef}
      className="hidden h-[min(68vh,680px)] min-h-[360px] overflow-auto rounded-xl border border-border sm:block"
    >
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/95 text-xs text-muted-foreground backdrop-blur">
          <tr>
            <th className="w-10 border-b border-border px-3 py-3">
              <span className="sr-only">Select rows</span>
            </th>
            {visibleFields.map((field) => (
              <th
                key={field.id}
                className="border-b border-border px-3 py-3 font-medium"
              >
                <button
                  type="button"
                  onClick={() => onSort(field.id)}
                  className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {field.name}
                  {sortBy === field.id ? (
                    <span
                      aria-label={
                        sortDirection === 'asc'
                          ? 'sorted ascending'
                          : 'sorted descending'
                      }
                    >
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {rowItems.map((virtualRow) => {
            const item = items[virtualRow.index]
            return (
              <tr
                key={item.id}
                className="absolute left-0 top-0 w-full hover:bg-muted/35"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <td className="border-b border-border/70 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.title}`}
                    checked={selected.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    className="size-4 accent-primary"
                  />
                </td>
                {visibleFields.map((field) => {
                  const value = item.data[field.id]
                  const isEditing =
                    editing?.itemId === item.id && editing.fieldId === field.id
                  const editable =
                    field.type !== 'image' && field.type !== 'reference'
                  return (
                    <td
                      key={field.id}
                      className="max-w-64 truncate border-b border-border/70 px-3 py-2.5 text-sm"
                      onDoubleClick={() =>
                        editable &&
                        setEditing({ itemId: item.id, fieldId: field.id })
                      }
                    >
                      {isEditing ? (
                        <Input
                          autoFocus
                          defaultValue={getCellText(value)}
                          aria-label={`Edit ${field.name}`}
                          onBlur={(event) => {
                            onEdit(item, field, event.currentTarget.value)
                            setEditing(null)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter')
                              event.currentTarget.blur()
                            if (event.key === 'Escape') setEditing(null)
                          }}
                          className="h-8 min-w-24 px-2"
                        />
                      ) : (
                        <button
                          type="button"
                          className="max-w-full truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() =>
                            editable &&
                            setEditing({ itemId: item.id, fieldId: field.id })
                          }
                          aria-label={`${field.name}: ${formatValue(value, field)}. Edit`}
                        >
                          {formatValue(value, field)}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MobileVirtualCards({
  items,
  fields,
  selected,
  onToggle,
}: {
  items: Item[]
  fields: FieldDef[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Virtualizer instances are mutable and must be read directly each render.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 136,
    overscan: 6,
  })
  return (
    <div
      ref={scrollRef}
      className="h-[min(68vh,680px)] min-h-[360px] overflow-auto sm:hidden"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]
          return (
            <Card
              key={item.id}
              className="absolute left-0 top-0 w-full p-3"
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fields
                      .slice(0, 2)
                      .map(
                        (field) =>
                          `${field.name}: ${formatValue(item.data[field.id], field)}`,
                      )
                      .join(' · ')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title}`}
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
                {fields.slice(2, 6).map((field) => (
                  <p key={field.id} className="truncate text-xs">
                    <span className="text-muted-foreground">
                      {field.name}:{' '}
                    </span>
                    {formatValue(item.data[field.id], field)}
                  </p>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function InventoryCollectionPage() {
  const { areaId = 'personal-inventory', collectionId = 'inventory' } =
    useParams()
  const { data, error, isLoading, mutate } = useSWR(
    ['collection-screen', areaId, collectionId],
    ([, id, collection]) => loadCollection(id, collection),
  )
  const [view, setView] = useState<CollectionView>(
    collectionId === 'inventory' ? 'gallery' : 'table',
  )
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<string>('purchaseDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quickAdd, setQuickAdd] = useState(false)
  const [newValues, setNewValues] = useState<Record<string, string>>({})
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldDef['type']>('text')
  const [importOpen, setImportOpen] = useState(false)
  const [stagedImport, setStagedImport] = useState<{
    headers: string[]
    rows: string[][]
  } | null>(null)
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [importError, setImportError] = useState('')
  const [filter, setFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const collection = data?.collection
  const fields = useMemo(() => collection?.fields ?? [], [collection?.fields])
  const inventoryValue = (data?.items ?? []).reduce(
    (sum, item) =>
      sum + (typeof item.data.amount === 'number' ? item.data.amount : 0),
    0,
  )
  const warrantiesSoon = (data?.items ?? []).filter((item) => {
    const warrantyEnds = item.data.warrantyEnds
    if (typeof warrantyEnds !== 'string') return false
    const daysRemaining =
      (new Date(`${warrantyEnds}T12:00:00`).getTime() - currentTime) / 86400000
    return daysRemaining >= 0 && daysRemaining <= 60
  }).length
  const visibleFields = useMemo(
    () =>
      fields.filter((field) => visibleIds === null || visibleIds.has(field.id)),
    [fields, visibleIds],
  )
  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase()
    const result = (data?.items ?? []).filter((item) => {
      const matchesQuery =
        !search ||
        [
          item.title,
          ...Object.values(item.data).flatMap((value) =>
            Array.isArray(value) ? value : [value],
          ),
        ].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(search),
        )
      const matchesFilter =
        !filter ||
        String(item.data.location ?? item.data.category ?? '')
          .toLowerCase()
          .includes(filter.toLowerCase())
      return matchesQuery && matchesFilter
    })
    return result.sort((a, b) => {
      const left = a.data[sortBy] ?? a.title
      const right = b.data[sortBy] ?? b.title
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data?.items, filter, query, sortBy, sortDirection])

  async function saveItem(item: Item, field: FieldDef, value: string) {
    let parsed: ItemValue = value
    if (
      field.type === 'currency' ||
      field.type === 'number' ||
      field.type === 'duration'
    )
      parsed = Number(value) || 0
    if (field.type === 'checkbox') parsed = value === 'true'
    await collectionsApi.updateItem(item.id, {
      data: { ...item.data, [field.id]: parsed },
    })
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              items: current.items.map((entry) =>
                entry.id === item.id
                  ? { ...entry, data: { ...entry.data, [field.id]: parsed } }
                  : entry,
              ),
            }
          : current,
      { revalidate: false },
    )
  }

  async function addRow() {
    if (!collection || !data?.area) return
    const values: Record<string, ItemValue> = {}
    fields.forEach((field) => {
      const value = newValues[field.id]
      if (value !== undefined && value !== '')
        values[field.id] =
          field.type === 'currency' || field.type === 'number'
            ? Number(value)
            : value
    })
    const title = String(
      values.model ??
        values.make ??
        values.merchant ??
        values.name ??
        'Untitled item',
    )
    const created = await collectionsApi.createItem({
      areaId,
      collectionId,
      title,
      type: collectionId,
      occurredAt: String(values.purchaseDate ?? values.date ?? today),
      data: values,
    })
    await mutate(
      (current) =>
        current ? { ...current, items: [created, ...current.items] } : current,
      { revalidate: false },
    )
    setNewValues({})
    setQuickAdd(false)
  }

  async function deleteSelected() {
    const ids = [...selected]
    await collectionsApi.deleteItems(ids)
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => !selected.has(item.id)),
            }
          : current,
      { revalidate: false },
    )
    setSelected(new Set())
  }

  function exportCsv() {
    const header = fields.map((field) => csvEscape(field.name)).join(',')
    const body = filteredItems
      .map((item) =>
        fields
          .map((field) => csvEscape(getCellText(item.data[field.id])))
          .join(','),
      )
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${collection?.name.toLowerCase().replaceAll(' ', '-') ?? 'collection'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function readImport(file: File) {
    setImportError('')
    try {
      const parsed = parseCsv(await file.text())
      if (!parsed.headers.length || !parsed.rows.length)
        throw new Error(
          'The file needs a header row and at least one data row.',
        )
      setStagedImport(parsed)
      setMapping(
        Object.fromEntries(
          parsed.headers.map((header, index) => [
            index,
            fields.find(
              (field) =>
                field.name.toLowerCase() === header.toLowerCase() ||
                field.id.toLowerCase() === header.toLowerCase(),
            )?.id ?? '',
          ]),
        ),
      )
      setImportOpen(true)
    } catch (caught) {
      setImportError(
        caught instanceof Error ? caught.message : 'Could not read this file.',
      )
    }
  }

  async function confirmImport() {
    if (!collection || !stagedImport) return
    const rows = stagedImport.rows.map((row) =>
      Object.fromEntries(
        row.flatMap((cell, index) => {
          const field = fields.find((entry) => entry.id === mapping[index])
          if (!field) return []
          const value: ItemValue =
            field.type === 'currency' ||
            field.type === 'number' ||
            field.type === 'duration'
              ? Number(cell) || 0
              : field.type === 'checkbox'
                ? cell.toLowerCase() === 'true' || cell.toLowerCase() === 'yes'
                : field.type === 'multiChoice'
                  ? cell
                      .split('|')
                      .map((choice) => choice.trim())
                      .filter(Boolean)
                  : cell
          return [[field.id, value]]
        }),
      ),
    )
    const imported = await collectionsApi.importItems(collection.id, rows)
    await mutate(
      (current) =>
        current
          ? { ...current, items: [...imported, ...current.items] }
          : current,
      { revalidate: false },
    )
    setImportOpen(false)
    setStagedImport(null)
  }

  async function addField() {
    if (!collection || !newFieldName.trim()) return
    const field: FieldDef = {
      id: `field-${crypto.randomUUID()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      order: fields.length,
    }
    const updated = {
      ...collection,
      fields: [...fields, field],
      updatedAt: new Date().toISOString(),
    }
    await collectionsApi.updateCollection(updated)
    await mutate(
      (current) => (current ? { ...current, collection: updated } : current),
      { revalidate: false },
    )
    setNewFieldName('')
  }

  async function moveField(index: number, direction: -1 | 1) {
    if (!collection) return
    const nextFields = [...fields]
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= nextFields.length) return
    ;[nextFields[index], nextFields[nextIndex]] = [
      nextFields[nextIndex],
      nextFields[index],
    ]
    const updated = {
      ...collection,
      fields: nextFields.map((field, order) => ({ ...field, order })),
    }
    await collectionsApi.updateCollection(updated)
    await mutate(
      (current) => (current ? { ...current, collection: updated } : current),
      { revalidate: false },
    )
  }

  if (isLoading)
    return (
      <div className="grid gap-4" aria-label="Loading collection">
        <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    )
  if (error)
    return (
      <EmptyState
        icon={Table2}
        variant="page"
        tone="danger"
        title="Couldn’t load this collection"
        message={error.message || 'Try again in a moment.'}
        action={
          <Button variant="outline" onClick={() => void mutate()}>
            Try again
          </Button>
        }
      />
    )
  if (!collection || !data?.area)
    return (
      <EmptyState
        icon={Table2}
        variant="page"
        title="Collection not found"
        message="This collection may have been removed."
        action={
          <Button variant="outline" render={<Link to="/areas" />}>
            Back to Areas
          </Button>
        }
      />
    )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/areas" className="hover:text-foreground">
              Areas
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              to={areaId === 'home-budget' ? '/area/home-budget' : '/areas'}
              className="hover:text-foreground"
            >
              {data.area.name}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{collection.name}</span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Collection
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {collection.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.items.length.toLocaleString()} entries ·{' '}
              {collection.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp data-icon="inline-start" />
            Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Choose a CSV file to import"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void readImport(file)
              event.currentTarget.value = ''
            }}
          />
          <Button size="sm" onClick={() => setQuickAdd((open) => !open)}>
            <Plus data-icon="inline-start" />
            Add item
          </Button>
        </div>
      </div>

      {collection.id === 'inventory' ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-lg">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total value</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {money.format(inventoryValue)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              Warranties ending soon
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {warrantiesSoon}
            </p>
          </Card>
        </div>
      ) : null}

      {importError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {importError}
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this collection"
                aria-label="Search this collection"
                className="pl-9"
              />
            </label>
            <label className="relative">
              <Filter className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter by location or category"
                className="h-9 max-w-40 appearance-none rounded-lg border border-input bg-background pl-8 pr-7 text-sm"
              >
                <option value="">All locations</option>
                {[
                  ...new Set(
                    data.items
                      .map((item) =>
                        String(item.data.location ?? item.data.category ?? ''),
                      )
                      .filter(Boolean),
                  ),
                ].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </label>
            <details className="relative">
              <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-muted">
                <Columns3 className="size-4" />
                Fields
                <ChevronDown className="size-3.5" />
              </summary>
              <div className="absolute left-0 top-10 z-20 flex max-h-64 w-52 flex-col gap-2 overflow-auto rounded-xl border border-border bg-popover p-3 shadow-lg">
                {fields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleIds === null || visibleIds.has(field.id)}
                      onChange={() =>
                        setVisibleIds((current) => {
                          const next = new Set(
                            current ?? fields.map((entry) => entry.id),
                          )
                          if (next.has(field.id)) next.delete(field.id)
                          else next.add(field.id)
                          return next
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    {field.name}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <div className="flex items-center justify-between gap-2">
            {selected.size ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void deleteSelected()}
              >
                <Trash2 data-icon="inline-start" />
                Delete {selected.size}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {filteredItems.length.toLocaleString()} shown
              </span>
            )}
            <div
              className="flex rounded-lg border border-border p-0.5"
              role="group"
              aria-label="Collection view"
            >
              {(
                [
                  { id: 'table', label: 'Table', icon: Table2 },
                  { id: 'cards', label: 'Cards', icon: List },
                  { id: 'gallery', label: 'Gallery', icon: ImageIcon },
                  { id: 'timeline', label: 'Timeline', icon: LayoutGrid },
                ] as const
              ).map((option) => {
                const Icon = option.icon
                return (
                  <Button
                    key={option.id}
                    size="icon-sm"
                    variant={view === option.id ? 'secondary' : 'ghost'}
                    aria-label={`${option.label} view`}
                    aria-pressed={view === option.id}
                    onClick={() => setView(option.id)}
                  >
                    <Icon />
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
        {quickAdd ? (
          <Card className="border-primary/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">Quick add</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickAdd(false)}
              >
                Cancel
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {fields.slice(0, 8).map((field) => (
                <label
                  key={field.id}
                  className="flex min-w-0 flex-col gap-1 text-xs font-medium"
                >
                  {field.name}
                  <Input
                    type={
                      field.type === 'date'
                        ? 'date'
                        : field.type === 'currency' || field.type === 'number'
                          ? 'number'
                          : 'text'
                    }
                    value={
                      newValues[field.id] ??
                      (field.id === 'purchaseDate' ? today : '')
                    }
                    onChange={(event) =>
                      setNewValues((values) => ({
                        ...values,
                        [field.id]: event.target.value,
                      }))
                    }
                    placeholder={field.type === 'currency' ? '0.00' : ''}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => void addRow()}>
                Save item
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      {view === 'table' ? (
        <>
          <VirtualTable
            items={filteredItems}
            visibleFields={visibleFields}
            selected={selected}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={(fieldId) => {
              if (sortBy === fieldId)
                setSortDirection((direction) =>
                  direction === 'asc' ? 'desc' : 'asc',
                )
              else {
                setSortBy(fieldId)
                setSortDirection('asc')
              }
            }}
            onToggle={(id) =>
              setSelected((current) => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onEdit={(item, field, value) => void saveItem(item, field, value)}
          />
          <MobileVirtualCards
            items={filteredItems}
            fields={fields}
            selected={selected}
            onToggle={(id) =>
              setSelected((current) => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
          />
        </>
      ) : view === 'gallery' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="group overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {typeof item.data.photo === 'string' ? (
                  <img
                    src={item.data.photo}
                    alt={`${item.title}, ${String(item.data.make ?? '')} ${String(item.data.model ?? '')}`}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground">
                    <ImageIcon className="size-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold tracking-tight">{item.title}</h2>
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.title}`}
                    checked={selected.has(item.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current)
                        if (next.has(item.id)) next.delete(item.id)
                        else next.add(item.id)
                        return next
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {[item.data.make, item.data.model].filter(Boolean).join(' ')}
                </p>
                <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs text-muted-foreground">
                  <span>
                    {String(item.data.location ?? 'Location not set')}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatValue(
                      item.data.amount,
                      fields.find((field) => field.id === 'amount') ?? {
                        id: 'amount',
                        name: 'Amount',
                        type: 'currency',
                        order: 0,
                      },
                    )}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{item.title}</h2>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title}`}
                  checked={selected.has(item.id)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }
                  className="size-4 accent-primary"
                />
              </div>
              {fields.slice(0, 5).map((field) => (
                <p
                  key={field.id}
                  className="flex justify-between gap-3 border-t border-border/60 pt-2 text-xs"
                >
                  <span className="text-muted-foreground">{field.name}</span>
                  <span className="truncate text-right">
                    {formatValue(item.data[field.id], field)}
                  </span>
                </p>
              ))}
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2.5 rounded-full bg-primary" />
                <span className="mt-2 h-full w-px bg-border" />
              </div>
              <Card className="mb-1 flex min-w-0 items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {formatValue(
                      item.data.purchaseDate ??
                        item.data.date ??
                        item.createdAt,
                      { id: 'date', name: 'Date', type: 'date', order: 0 },
                    )}
                  </p>
                  <h2 className="mt-1 truncate font-semibold">{item.title}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {fields
                      .slice(0, 3)
                      .map((field) => formatValue(item.data[field.id], field))
                      .join(' · ')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label={`Select ${item.title}`}
                  checked={selected.has(item.id)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(item.id)) next.delete(item.id)
                      else next.add(item.id)
                      return next
                    })
                  }
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
              </Card>
            </div>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="No matching entries"
            message="Try another search or clear the filters."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setFilter('')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : null}

      <div className="mt-8 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Collection fields</h2>
            <p className="text-xs text-muted-foreground">
              A simple schema for the details you want to keep.
            </p>
          </div>
          <Button
            variant={fieldsOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFieldsOpen((open) => !open)}
          >
            <Columns3 data-icon="inline-start" />
            {fieldsOpen ? 'Done' : 'Edit fields'}
          </Button>
        </div>
        {fieldsOpen ? (
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.type}
                      {field.unit ? ` · ${field.unit}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${field.name} up`}
                      disabled={index === 0}
                      onClick={() => void moveField(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${field.name} down`}
                      disabled={index === fields.length - 1}
                      onClick={() => void moveField(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={newFieldName}
                onChange={(event) => setNewFieldName(event.target.value)}
                placeholder="New field name"
                aria-label="New field name"
              />
              <select
                value={newFieldType}
                onChange={(event) =>
                  setNewFieldType(event.target.value as FieldDef['type'])
                }
                aria-label="New field type"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              >
                {(
                  [
                    'text',
                    'longText',
                    'number',
                    'currency',
                    'date',
                    'datetime',
                    'duration',
                    'checkbox',
                    'choice',
                    'multiChoice',
                    'link',
                    'reference',
                    'image',
                  ] as FieldDef['type'][]
                ).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => void addField()}
                disabled={!newFieldName.trim()}
              >
                <Plus data-icon="inline-start" />
                Add field
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Map CSV fields"
      >
        <DialogHeader
          title="Map CSV fields"
          description="Review the incoming columns before adding these rows."
        />
        <DialogBody className="flex flex-col gap-4">
          {stagedImport ? (
            <>
              <p className="text-sm text-muted-foreground">
                {stagedImport.rows.length} new, 0 updated, 0 skipped
              </p>
              <div className="flex flex-col gap-2">
                {stagedImport.headers.map((header, index) => {
                  const matched = fields.find(
                    (field) =>
                      field.name.toLowerCase() === header.toLowerCase() ||
                      field.id.toLowerCase() === header.toLowerCase(),
                  )
                  return (
                    <label
                      key={header}
                      className="grid grid-cols-[1fr_1fr] items-center gap-3 text-sm"
                    >
                      <span className="truncate">{header}</span>
                      <select
                        value={mapping[index] ?? matched?.id ?? ''}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [index]: event.target.value,
                          }))
                        }
                        aria-label={`Map ${header}`}
                        className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Skip column</option>
                        {fields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                })}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      {stagedImport.headers.slice(0, 4).map((header) => (
                        <th
                          key={header}
                          className="border-b border-border px-2 py-2 font-medium"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {(stagedImport.rows[0] ?? [])
                        .slice(0, 4)
                        .map((cell, index) => (
                          <td
                            key={`${index}-${cell}`}
                            className="max-w-32 truncate px-2 py-2 text-muted-foreground"
                          >
                            {cell}
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setImportOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void confirmImport()} disabled={!stagedImport}>
            Import rows
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
