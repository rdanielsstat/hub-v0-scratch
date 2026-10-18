import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type {
  Area,
  CollectionSchema,
  FieldDef,
  Item,
  ItemValue,
} from '@/services/api'
import { areasApi, collectionsApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'

interface CollectionData {
  area: Area | null
  collection: CollectionSchema | null
  items: Item[]
}
type DisplayMode = 'table' | 'cards' | 'gallery' | 'timeline'
const dateToday = () => new Date().toISOString().slice(0, 10)
const valueText = (value: ItemValue | undefined) =>
  Array.isArray(value)
    ? value.join(', ')
    : value && typeof value === 'object'
      ? value.title
      : value === null || value === undefined
        ? ''
        : String(value)
const loadCollection = async (
  areaId: string,
  collectionId: string,
): Promise<CollectionData> => {
  const [area, collection, items] = await Promise.all([
    areasApi.getArea(areaId),
    collectionsApi.getCollection(collectionId),
    collectionsApi.listCollectionItems(collectionId),
  ])
  return { area, collection, items }
}

export function CollectionPage() {
  const { areaId = '', collectionId = '' } = useParams()
  const loader = useCallback(
    () => loadCollection(areaId, collectionId),
    [areaId, collectionId],
  )
  const resource = useApiResource(loader, `${areaId}:${collectionId}`)
  const [query, setQuery] = useState('')
  const [filterField, setFilterField] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [display, setDisplay] = useState<DisplayMode>('table')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const rowScrollRef = useRef<HTMLDivElement>(null)
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const collection = resource.data?.collection
  const fields = collection?.fields ?? []
  const shownFields = fields.filter(
    (field) => visibleFieldIds === null || visibleFieldIds.includes(field.id),
  )

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase()
    const narrowed = (resource.data?.items ?? []).filter((item) => {
      const haystack =
        `${item.title} ${Object.values(item.data).map(valueText).join(' ')}`.toLowerCase()
      const matchesQuery = !search || haystack.includes(search)
      const value = filterField
        ? valueText(item.data[filterField]).toLowerCase()
        : ''
      const matchesField =
        !filterField ||
        !filterValue ||
        value.includes(filterValue.toLowerCase())
      return matchesQuery && matchesField
    })
    if (sortField)
      narrowed.sort((left, right) => {
        const a = left.data[sortField] ?? left.title
        const b = right.data[sortField] ?? right.title
        const result =
          typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a).localeCompare(String(b))
        return sortDirection === 'asc' ? result : -result
      })
    return narrowed
  }, [
    resource.data?.items,
    query,
    filterField,
    filterValue,
    sortField,
    sortDirection,
  ])

  // TanStack Virtual returns non-memoizable measurement methods by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => rowScrollRef.current,
    estimateSize: () => 52,
    overscan: 12,
    initialRect: { width: 960, height: 600 },
  })
  const mobileVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => mobileScrollRef.current,
    estimateSize: () => 190,
    overscan: 8,
    initialRect: { width: 390, height: 640 },
  })

  async function addItem() {
    if (!collection || saving) return
    setSaving(true)
    setFormError('')
    try {
      const data: Record<string, ItemValue> = {}
      for (const field of fields)
        data[field.id] = parseValue(
          field,
          draft[field.id] ?? (field.type === 'date' ? dateToday() : ''),
        )
      const titleField = fields.find((field) => Boolean(data[field.id]))
      const title = titleField
        ? valueText(data[titleField.id])
        : 'Untitled item'
      const item = await collectionsApi.createItem({
        areaId,
        collectionId,
        title,
        type: collectionId,
        occurredAt: String(
          data[fields.find((field) => field.type === 'date')?.id ?? ''] ??
            dateToday(),
        ),
        data,
      })
      resource.setData((previous) =>
        previous ? { ...previous, items: [item, ...previous.items] } : previous,
      )
      setDraft({})
      setDialogOpen(false)
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Could not add this item.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function updateItem(item: Item, field: FieldDef | null, value: string) {
    if (!resource.data) return
    const patch = field
      ? { data: { ...item.data, [field.id]: parseValue(field, value) } }
      : { title: value }
    try {
      const updated = await collectionsApi.updateItem(item.id, patch)
      resource.setData((previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((row) =>
                row.id === item.id ? updated : row,
              ),
            }
          : previous,
      )
    } catch {
      setFormError('Could not save that change. Try again.')
    }
  }

  async function removeItems(ids: string[]) {
    if (
      !ids.length ||
      !window.confirm(
        `Delete ${ids.length} ${ids.length === 1 ? 'item' : 'items'}? This cannot be undone.`,
      )
    )
      return
    await collectionsApi.deleteItems(ids)
    resource.setData((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.filter((item) => !ids.includes(item.id)),
          }
        : previous,
    )
    setSelectedIds([])
  }

  function toggleSort(fieldId: string) {
    if (sortField === fieldId)
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(fieldId)
      setSortDirection('asc')
    }
  }

  async function importCsv(file: File) {
    if (!collection) return
    try {
      const rows = parseCsv(await file.text())
      const imported = await collectionsApi.importItems(
        collection.id,
        rows.map((row) =>
          Object.fromEntries(
            fields.map((field) => [
              field.id,
              parseValue(field, row[field.name] ?? row[field.id] ?? ''),
            ]),
          ),
        ),
      )
      resource.setData((previous) =>
        previous
          ? { ...previous, items: [...imported, ...previous.items] }
          : previous,
      )
      setFormError('')
    } catch {
      setFormError(
        'Could not import this CSV. Check its column headers and try again.',
      )
    }
  }

  function exportCsv() {
    const headers = ['Name', ...shownFields.map((field) => field.name)]
    const lines = filteredItems.map((item) =>
      [
        item.title,
        ...shownFields.map((field) => valueText(item.data[field.id])),
      ]
        .map(csvCell)
        .join(','),
    )
    const blob = new Blob(
      [[headers.map(csvCell).join(','), ...lines].join('\n')],
      { type: 'text/csv;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${collection?.name ?? 'collection'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function saveSchema(nextFields: FieldDef[]) {
    if (!collection) return
    const updated = await collectionsApi.updateCollection({
      ...collection,
      fields: nextFields,
    })
    resource.setData((previous) =>
      previous ? { ...previous, collection: updated } : previous,
    )
    setVisibleFieldIds(null)
  }

  if (resource.loading)
    return (
      <div aria-label="Loading collection" className="grid gap-3">
        <div className="h-12 animate-pulse rounded-lg bg-muted/50" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/40" />
      </div>
    )
  if (resource.error)
    return (
      <EmptyState
        variant="page"
        icon={Archive}
        tone="danger"
        title="Could not load this collection"
        message={resource.error.message}
        action={
          <Button variant="outline" onClick={() => void resource.refresh()}>
            Try again
          </Button>
        }
      />
    )
  if (!resource.data?.area || !collection)
    return (
      <EmptyState
        variant="page"
        icon={Archive}
        title="Collection not found"
        message="This collection may have been removed."
      />
    )

  const allSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id))
  const columnTemplate = `40px minmax(140px, 1.2fr) repeat(${shownFields.length}, minmax(100px, 1fr)) 40px`

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        to={`/area/${areaId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {resource.data.area.name}
      </Link>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {resource.data.area.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {collection.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {collection.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSchemaOpen(true)}>
            <Settings2 />
            Fields
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            Add item
          </Button>
        </div>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-40 flex-1 sm:max-w-xs">
          <span className="sr-only">Search collection</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search entries"
            className="pl-9"
          />
        </label>
        <Select
          aria-label="Filter by field"
          value={filterField}
          onChange={(event) => setFilterField(event.target.value)}
          className="w-36"
        >
          <option value="">All fields</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name}
            </option>
          ))}
        </Select>
        {filterField ? (
          <Input
            aria-label="Filter value"
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder="Contains"
            className="w-32"
          />
        ) : null}
        <details className="relative">
          <summary
            className="grid size-9 cursor-pointer list-none place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted"
            aria-label="Show or hide columns"
          >
            <Settings2 className="size-4" />
          </summary>
          <div className="absolute right-0 top-10 z-20 flex min-w-44 flex-col gap-2 rounded-lg border border-border bg-popover p-3 shadow-lg">
            {fields.map((field) => (
              <label key={field.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={shownFields.some((item) => item.id === field.id)}
                  onChange={(event) =>
                    setVisibleFieldIds((current) => {
                      const visible = current ?? fields.map((item) => item.id)
                      return event.target.checked
                        ? [...visible, field.id]
                        : visible.filter((id) => id !== field.id)
                    })
                  }
                />
                {field.name}
              </label>
            ))}
          </div>
        </details>
        <div
          className="ml-auto flex items-center gap-1"
          role="group"
          aria-label="Collection display"
        >
          {(['table', 'cards', 'gallery', 'timeline'] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={display === mode ? 'secondary' : 'ghost'}
              aria-pressed={display === mode}
              onClick={() => setDisplay(mode)}
            >
              {modeLabel(mode)}
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label="Import CSV"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importCsv(file)
              event.currentTarget.value = ''
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
          >
            <Upload />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download />
            Export CSV
          </Button>
          {selectedIds.length ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void removeItems(selectedIds)}
            >
              <Trash2 />
              Delete {selectedIds.length}
            </Button>
          ) : null}
        </div>
      </div>
      {formError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {filteredItems.length ? (
        <>
          {display === 'table' ? (
            <>
              <div
                className="hidden overflow-hidden rounded-t-lg border border-border bg-muted/60 text-left text-xs text-muted-foreground md:block"
                role="row"
                style={{ display: 'grid', gridTemplateColumns: columnTemplate }}
              >
                <div className="grid place-items-center px-2 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all items"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? filteredItems.map((item) => item.id)
                          : [],
                      )
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toggleSort('title')}
                  className="flex items-center gap-1 px-3 py-3 text-left font-medium"
                >
                  Name
                  {sortField === 'title' ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : null}
                </button>
                {shownFields.map((field) => (
                  <button
                    type="button"
                    key={field.id}
                    onClick={() => toggleSort(field.id)}
                    className="flex min-w-0 items-center gap-1 truncate px-3 py-3 text-left font-medium"
                  >
                    {field.name}
                    {sortField === field.id ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      )
                    ) : null}
                  </button>
                ))}
                <div />
              </div>
              <div
                ref={rowScrollRef}
                className="hidden max-h-[65vh] overflow-auto border-x border-b border-border md:block"
                role="rowgroup"
              >
                <div
                  style={{
                    height: virtualizer.getTotalSize(),
                    minWidth: 'max-content',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filteredItems[virtualRow.index]
                    return (
                      <div
                        key={item.id}
                        role="row"
                        className="absolute left-0 top-0 w-full border-b border-border/70 bg-background"
                        style={{
                          height: virtualRow.size,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'grid',
                          gridTemplateColumns: columnTemplate,
                        }}
                      >
                        <div className="grid place-items-center px-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.title}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </div>
                        <div className="min-w-0 px-3 py-2">
                          <EditableCell
                            text={item.title}
                            ariaLabel={`Name ${item.title}`}
                            onSave={(value) => updateItem(item, null, value)}
                          />
                        </div>
                        {shownFields.map((field) => (
                          <div key={field.id} className="min-w-0 px-3 py-2">
                            <EditableCell
                              text={valueText(item.data[field.id])}
                              ariaLabel={`${field.name} for ${item.title}`}
                              field={field}
                              onSave={(value) => updateItem(item, field, value)}
                            />
                          </div>
                        ))}
                        <div className="grid place-items-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => void removeItems([item.id])}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div
                ref={mobileScrollRef}
                className="max-h-[70vh] overflow-auto md:hidden"
              >
                <div
                  style={{
                    height: mobileVirtualizer.getTotalSize(),
                    position: 'relative',
                  }}
                >
                  {mobileVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filteredItems[virtualRow.index]
                    return (
                      <article
                        key={item.id}
                        className="absolute left-0 top-0 w-full rounded-xl border border-border bg-card p-3"
                        style={{
                          height: virtualRow.size,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="mb-2 flex items-start gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.title}`}
                            checked={selectedIds.includes(item.id)}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <EditableCell
                              text={item.title}
                              ariaLabel={`Name ${item.title}`}
                              onSave={(value) => updateItem(item, null, value)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => void removeItems([item.id])}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        {shownFields.slice(0, 5).map((field) => (
                          <div
                            key={field.id}
                            className="grid grid-cols-[minmax(0,5rem)_1fr] items-center gap-2 border-t border-border/60 py-1.5"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              {field.name}
                            </span>
                            <EditableCell
                              text={valueText(item.data[field.id])}
                              ariaLabel={`${field.name} for ${item.title}`}
                              field={field}
                              onSave={(value) => updateItem(item, field, value)}
                            />
                          </div>
                        ))}
                      </article>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <EntryView
              mode={display}
              items={filteredItems}
              fields={shownFields}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={query ? Search : Plus}
          title={query ? 'No matching items' : 'No items yet'}
          message={
            query
              ? 'Try a different search.'
              : 'Add the first entry to this collection.'
          }
          action={
            !query ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus />
                Add item
              </Button>
            ) : null
          }
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`Add to ${collection.name}`}
      >
        <DialogHeader
          title={`Add to ${collection.name}`}
          description="Enter the details for this item."
        />
        <DialogBody className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {fields.map((field) => (
            <label key={field.id} className="flex flex-col gap-1.5 text-sm">
              <Label htmlFor={`new-${field.id}`}>{field.name}</Label>
              <FieldInput
                field={field}
                value={
                  draft[field.id] ?? (field.type === 'date' ? dateToday() : '')
                }
                onChange={(value) =>
                  setDraft((previous) => ({ ...previous, [field.id]: value }))
                }
                id={`new-${field.id}`}
              />
            </label>
          ))}
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void addItem()}>
            {saving ? 'Saving' : 'Add item'}
          </Button>
        </DialogFooter>
      </Dialog>
      {schemaOpen ? (
        <SchemaEditor
          collection={collection}
          onClose={() => setSchemaOpen(false)}
          onSave={saveSchema}
        />
      ) : null}
    </div>
  )
}

function EditableCell({
  text,
  ariaLabel,
  field,
  onSave,
}: {
  text: string
  ariaLabel: string
  field?: FieldDef
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const canceled = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const save = () => {
    if (canceled.current) {
      canceled.current = false
      return
    }
    const next = inputRef.current?.value ?? draft
    if (next !== text) void onSave(next)
    setEditing(false)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      canceled.current = true
      setDraft(text)
      setEditing(false)
      return
    }
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      save()
    }
  }
  if (!editing)
    return (
      <button
        type="button"
        className="block w-full truncate rounded px-1 py-1 text-left text-sm hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${ariaLabel}, edit`}
        onClick={() => {
          setDraft(text)
          setEditing(true)
        }}
      >
        {text || <span className="text-muted-foreground">Empty</span>}
      </button>
    )
  return (
    <Input
      ref={inputRef}
      aria-label={ariaLabel}
      autoFocus
      value={draft}
      type={
        field?.type === 'number' ||
        field?.type === 'currency' ||
        field?.type === 'duration'
          ? 'number'
          : field?.type === 'date'
            ? 'date'
            : 'text'
      }
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={save}
      className="h-8 min-w-24"
    />
  )
}

function EntryView({
  mode,
  items,
  fields,
}: {
  mode: Exclude<DisplayMode, 'table'>
  items: Item[]
  fields: FieldDef[]
}) {
  const imageField = fields.find((field) => field.type === 'image')
  if (mode === 'gallery')
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="grid aspect-[4/3] place-items-center bg-muted">
              {imageField && item.data[imageField.id] ? (
                <img
                  src={String(item.data[imageField.id])}
                  alt={item.title}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {item.title}
                </span>
              )}
            </div>
            <h2 className="truncate p-3 text-sm font-medium">{item.title}</h2>
          </article>
        ))}
      </div>
    )
  if (mode === 'timeline')
    return (
      <ol className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-lg border border-border p-3"
          >
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
            <div>
              <h2 className="text-sm font-medium">{item.title}</h2>
              <time className="text-xs text-muted-foreground">
                {new Date(
                  item.occurredAt ?? item.createdAt,
                ).toLocaleDateString()}
              </time>
            </div>
          </li>
        ))}
      </ol>
    )
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border border-border p-4">
          <h2 className="mb-2 text-sm font-medium">{item.title}</h2>
          {fields.slice(0, 5).map((field) => (
            <p
              key={field.id}
              className="grid grid-cols-[minmax(0,5rem)_1fr] gap-2 py-1 text-xs"
            >
              <span className="truncate text-muted-foreground">
                {field.name}
              </span>
              <span className="break-words">
                {valueText(item.data[field.id]) || 'Not set'}
              </span>
            </p>
          ))}
        </article>
      ))}
    </div>
  )
}

function SchemaEditor({
  collection,
  onClose,
  onSave,
}: {
  collection: CollectionSchema
  onClose: () => void
  onSave: (fields: FieldDef[]) => Promise<void>
}) {
  const [fields, setFields] = useState(collection.fields)
  async function persist(next: FieldDef[]) {
    setFields(next)
    await onSave(next)
  }
  function moveField(index: number, delta: number) {
    const target = Math.max(0, Math.min(fields.length - 1, index + delta))
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    void persist(next.map((field, order) => ({ ...field, order })))
  }
  return (
    <Dialog open onClose={onClose} title="Edit fields">
      <DialogHeader
        title="Fields"
        description="Rename, reorder, or add fields to this collection."
      />
      <DialogBody className="flex max-h-[65vh] flex-col gap-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              aria-label={`Field ${index + 1} name`}
              value={field.name}
              onChange={(event) =>
                setFields((current) =>
                  current.map((item) =>
                    item.id === field.id
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                )
              }
              onBlur={() => void persist(fields)}
            />
            <span className="w-16 shrink-0 text-xs text-muted-foreground">
              {fieldTypeLabel(field.type)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${field.name} up`}
              onClick={() => moveField(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${field.name} down`}
              onClick={() => moveField(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${field.name}`}
              onClick={() =>
                void persist(fields.filter((item) => item.id !== field.id))
              }
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() =>
            void persist([
              ...fields,
              {
                id: `field${Date.now()}`,
                name: 'New field',
                type: 'text',
                order: fields.length,
              },
            ])
          }
        >
          <Plus />
          Add field
        </Button>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}

function FieldInput({
  field,
  value,
  onChange,
  id,
}: {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  id: string
}) {
  if (field.type === 'choice' && field.options?.length)
    return (
      <Select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose</option>
        {field.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </Select>
    )
  if (field.type === 'checkbox')
    return (
      <input
        id={id}
        type="checkbox"
        checked={value === 'true'}
        onChange={(event) => onChange(String(event.target.checked))}
      />
    )
  return (
    <Input
      id={id}
      type={
        field.type === 'date'
          ? 'date'
          : field.type === 'number' ||
              field.type === 'currency' ||
              field.type === 'duration'
            ? 'number'
            : 'text'
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function parseValue(field: FieldDef, value: string): ItemValue {
  if (
    field.type === 'number' ||
    field.type === 'currency' ||
    field.type === 'duration'
  )
    return value ? Number(value) : 0
  if (field.type === 'checkbox') return value === 'true'
  if (field.type === 'multiChoice')
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  return value
}

function modeLabel(mode: DisplayMode) {
  return mode[0].toUpperCase() + mode.slice(1)
}

function fieldTypeLabel(type: FieldDef['type']) {
  return {
    text: 'Text',
    longText: 'Long text',
    number: 'Number',
    currency: 'Currency',
    date: 'Date',
    datetime: 'Date and time',
    duration: 'Duration',
    checkbox: 'Checkbox',
    choice: 'Choice',
    multiChoice: 'Multiple choice',
    link: 'Link',
    reference: 'Reference',
    image: 'Image',
  }[type]
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && text[index + 1] === '"' && quoted) {
      currentCell += '"'
      index += 1
    } else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) {
      currentRow.push(currentCell)
      currentCell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      currentRow.push(currentCell)
      if (currentRow.some(Boolean)) rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else currentCell += character
  }
  currentRow.push(currentCell)
  if (currentRow.some(Boolean)) rows.push(currentRow)
  const [headers = [], ...values] = rows
  return values.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    ),
  )
}
