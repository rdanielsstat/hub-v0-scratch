import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
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
  CollectionPreferences,
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
import { CollectionTable } from '@/components/collection/collection-table'
import { localDateString } from '@/lib/local-date'
import { EntryView, FieldInput, SchemaEditor, type DisplayMode } from '@/components/collection/collection-views'
import { useCollectionPageState } from '@/components/collection/collection-page-state'

interface CollectionData {
  area: Area | null
  collection: CollectionSchema | null
  items: Item[]
  preferences: CollectionPreferences
}
const dateToday = localDateString
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
  const [area, collection, items, preferences] = await Promise.all([
    areasApi.getArea(areaId),
    collectionsApi.getCollection(collectionId),
    collectionsApi.listCollectionItems(collectionId),
    collectionsApi.getPreferences(collectionId),
  ])
  return { area, collection, items, preferences }
}

export function CollectionPage() {
  const { areaId = '', collectionId = '' } = useParams()
  const state = useCollectionPageState(areaId, collectionId)
  const {
    resource, collection, fields, query, setQuery, filterField, setFilterField,
    filterValue, setFilterValue, sortField, sortDirection, visibleFieldIds,
    selectedIds, setSelectedIds, display, columnWidths, dialogOpen, setDialogOpen,
    schemaOpen, setSchemaOpen, draft, setDraft, saving, formError, importRef,
    shownFields, filteredItems, saveDisplay, updateColumnWidth, addItem, updateItem,
    removeItems, toggleSort, importCsv, exportCsv, saveSchema,
  } = state
  useEffect(() => {
    const preferences = resource.data?.preferences
    if (!preferences) return
    setDisplay(preferences.display)
    setColumnWidths(preferences.columnWidths)
  }, [collectionId, resource.data?.collection?.id])

  async function saveDisplay(nextDisplay: DisplayMode) {
    setDisplay(nextDisplay)
    if (collection)
      await collectionsApi.savePreferences(collection.id, {
        display: nextDisplay,
        columnWidths,
      })
  }

  async function updateColumnWidth(fieldId: string, width: number) {
    if (!collection) return
    const next = { ...columnWidths, [fieldId]: width }
    setColumnWidths(next)
    await collectionsApi.savePreferences(collection.id, {
      display,
      columnWidths: next,
    })
  }

  const shownFields = fields.filter((field) =>
    visibleFieldIds === null
      ? !(collection?.id === 'purchases' && field.id === 'description')
      : visibleFieldIds.includes(field.id),
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
                      const visible = current ?? fields
                        .filter((item) => !(collection.id === 'purchases' && item.id === 'description'))
                        .map((item) => item.id)
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
              onClick={() => void saveDisplay(mode)}
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
            <CollectionTable
              items={filteredItems}
              fields={shownFields}
              selectedIds={selectedIds}
              sortField={sortField}
              sortDirection={sortDirection}
              columnWidths={columnWidths}
              onSort={toggleSort}
              onResize={(fieldId, width) => void updateColumnWidth(fieldId, width)}
              onSelect={(itemId, selected) =>
                setSelectedIds((current) => selected
                  ? [...new Set([...current, itemId])]
                  : current.filter((id) => id !== itemId))
              }
              onSelectAll={(selected) =>
                setSelectedIds(selected ? filteredItems.map((item) => item.id) : [])
              }
              onSave={updateItem}
              onDelete={(itemId) => void removeItems([itemId])}
            />
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
