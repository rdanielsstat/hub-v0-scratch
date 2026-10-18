import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Area, CollectionPreferences, CollectionSchema, FieldDef, Item, ItemValue } from '@/services/api'
import { areasApi, collectionsApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { localDateString } from '@/lib/local-date'
import { csvCell, parseCsv, parseValue, valueText } from './collection-utils'
import type { DisplayMode } from './collection-views'

interface CollectionData {
  area: Area | null
  collection: CollectionSchema | null
  items: Item[]
  preferences: CollectionPreferences
}

async function loadCollection(areaId: string, collectionId: string): Promise<CollectionData> {
  const [area, collection, items, preferences] = await Promise.all([
    areasApi.getArea(areaId),
    collectionsApi.getCollection(collectionId),
    collectionsApi.listCollectionItems(collectionId),
    collectionsApi.getPreferences(collectionId),
  ])
  return { area, collection, items, preferences }
}

export function useCollectionPageState(areaId: string, collectionId: string) {
  const loader = useCallback(() => loadCollection(areaId, collectionId), [areaId, collectionId])
  const resource = useApiResource(loader, `${areaId}:${collectionId}`)
  const [query, setQuery] = useState('')
  const [filterField, setFilterField] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [sortField, setSortField] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [visibleFieldIds, setVisibleFieldIds] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [display, setDisplay] = useState<DisplayMode>('table')
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [schemaOpen, setSchemaOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const collection = resource.data?.collection
  const fields = collection?.fields ?? []

  useEffect(() => {
    const preferences = resource.data?.preferences
    if (!preferences) return
    setDisplay(preferences.display)
    setColumnWidths(preferences.columnWidths)
  }, [collectionId, resource.data?.collection?.id])

  async function saveDisplay(nextDisplay: DisplayMode) {
    setDisplay(nextDisplay)
    if (collection)
      await collectionsApi.savePreferences(collection.id, { display: nextDisplay, columnWidths })
  }

  async function updateColumnWidth(fieldId: string, width: number) {
    if (!collection) return
    const next = { ...columnWidths, [fieldId]: width }
    setColumnWidths(next)
    await collectionsApi.savePreferences(collection.id, { display, columnWidths: next })
  }

  const shownFields = fields.filter((field) =>
    visibleFieldIds === null
      ? !(collection?.id === 'purchases' && field.id === 'description')
      : visibleFieldIds.includes(field.id),
  )

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase()
    const narrowed = (resource.data?.items ?? []).filter((item) => {
      const haystack = `${item.title} ${Object.values(item.data).map(valueText).join(' ')}`.toLowerCase()
      const matchesQuery = !search || haystack.includes(search)
      const value = filterField ? valueText(item.data[filterField]).toLowerCase() : ''
      const matchesField = !filterField || !filterValue || value.includes(filterValue.toLowerCase())
      return matchesQuery && matchesField
    })
    if (sortField)
      narrowed.sort((left, right) => {
        const a = left.data[sortField] ?? left.title
        const b = right.data[sortField] ?? right.title
        const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
        return sortDirection === 'asc' ? result : -result
      })
    return narrowed
  }, [resource.data?.items, query, filterField, filterValue, sortField, sortDirection])

  async function addItem() {
    if (!collection || saving) return
    setSaving(true)
    setFormError('')
    try {
      const data: Record<string, ItemValue> = {}
      for (const field of fields)
        data[field.id] = parseValue(field, draft[field.id] ?? (field.type === 'date' ? localDateString() : ''))
      const titleField = fields.find((field) => Boolean(data[field.id]))
      const title = titleField ? valueText(data[titleField.id]) : 'Untitled item'
      const dateField = fields.find((field) => field.type === 'date')
      const item = await collectionsApi.createItem({
        areaId,
        collectionId,
        title,
        type: collectionId,
        occurredAt: String((dateField ? data[dateField.id] : undefined) ?? localDateString()),
        data,
      })
      resource.setData((previous) => previous ? { ...previous, items: [item, ...previous.items] } : previous)
      setDraft({})
      setDialogOpen(false)
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not add this item.')
    } finally {
      setSaving(false)
    }
  }

  async function updateItem(item: Item, field: FieldDef | null, value: string) {
    if (!resource.data) return
    const patch = field ? { data: { ...item.data, [field.id]: parseValue(field, value) } } : { title: value }
    try {
      const updated = await collectionsApi.updateItem(item.id, patch)
      resource.setData((previous) => previous ? { ...previous, items: previous.items.map((row) => row.id === item.id ? updated : row) } : previous)
    } catch {
      setFormError('Could not save that change. Try again.')
    }
  }

  async function removeItems(ids: string[]) {
    if (!ids.length || !window.confirm(`Delete ${ids.length} ${ids.length === 1 ? 'item' : 'items'}? This cannot be undone.`)) return
    await collectionsApi.deleteItems(ids)
    resource.setData((previous) => previous ? { ...previous, items: previous.items.filter((item) => !ids.includes(item.id)) } : previous)
    setSelectedIds([])
  }

  function toggleSort(fieldId: string) {
    if (sortField === fieldId) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(fieldId)
      setSortDirection('asc')
    }
  }

  async function importCsv(file: File) {
    if (!collection) return
    try {
      const rows = parseCsv(await file.text())
      const imported = await collectionsApi.importItems(collection.id, rows.map((row) => Object.fromEntries(fields.map((field) => [field.id, parseValue(field, row[field.name] ?? row[field.id] ?? '')]))))
      resource.setData((previous) => previous ? { ...previous, items: [...imported, ...previous.items] } : previous)
      setFormError('')
    } catch {
      setFormError('Could not import this CSV. Check its column headers and try again.')
    }
  }

  function exportCsv() {
    const headers = ['Name', ...shownFields.map((field) => field.name)]
    const lines = filteredItems.map((item) => [item.title, ...shownFields.map((field) => valueText(item.data[field.id]))].map(csvCell).join(','))
    const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${collection?.name ?? 'collection'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function saveSchema(nextFields: FieldDef[]) {
    if (!collection) return
    const updated = await collectionsApi.updateCollection({ ...collection, fields: nextFields })
    resource.setData((previous) => previous ? { ...previous, collection: updated } : previous)
    setVisibleFieldIds(null)
  }

  return {
    resource, collection, fields, query, setQuery, filterField, setFilterField,
    filterValue, setFilterValue, sortField, sortDirection, visibleFieldIds,
    selectedIds, setSelectedIds, display, columnWidths, dialogOpen, setDialogOpen,
    schemaOpen, setSchemaOpen, draft, setDraft, saving, formError, importRef,
    shownFields, filteredItems, saveDisplay, updateColumnWidth, addItem, updateItem,
    removeItems, toggleSort, importCsv, exportCsv, saveSchema,
  }
}
