import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  Download,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react'
import { localDateString } from '@/lib/local-date'
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
import { EntryDetailPanel } from '@/components/collection/entry-detail-panel'
import { useEntryDetails } from '@/hooks/use-entry-details'
import type { FieldDef } from '@/services/api'
import {
  EntryView,
  FieldInput,
  SchemaEditor,
  type DisplayMode,
} from '@/components/collection/collection-views'
import { useCollectionPageState } from '@/components/collection/collection-page-state'

export function CollectionPage() {
  const { areaId = '', collectionId = '' } = useParams()
  const state = useCollectionPageState(areaId, collectionId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [toastMessage, setToastMessage] = useState('')
  const [undoAvailable, setUndoAvailable] = useState(false)
  const entryId = searchParams.get('entry') ?? ''
  const entryDetails = useEntryDetails(entryId)
  const selectedEntry = state.resource.data?.items.find((item) => item.id === entryId)
  const {
    resource,
    collection,
    fields,
    query,
    setQuery,
    filterField,
    setFilterField,
    filterValue,
    setFilterValue,
    sortField,
    sortDirection,
    setVisibleFieldIds,
    selectedIds,
    setSelectedIds,
    display,
    columnWidths,
    dialogOpen,
    setDialogOpen,
    schemaOpen,
    setSchemaOpen,
    draft,
    setDraft,
    saving,
    formError,
    importRef,
    shownFields,
    filteredItems,
    saveDisplay,
    updateColumnWidth,
    addItem,
    updateItem,
    addSubItem,
    updateSubItem,
    removeItems,
    undoRemoveItems,
    toggleSort,
    importCsv,
    exportCsv,
    saveSchema,
  } = state
  const searchRef = useRef<HTMLInputElement>(null)
  const amountField = fields.find((field) => field.type === 'currency')
  const dateField = fields.find((field) => field.type === 'date')
  const amountTotal = amountField
    ? filteredItems.reduce((sum, item) => {
        const value = item.data[amountField.id]
        return sum + (typeof value === 'number' ? value : 0)
      }, 0)
    : null
  const amountAverage = amountTotal !== null && filteredItems.length
    ? amountTotal / filteredItems.length
    : 0
  const currency = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)

  function setEntryQuery(itemId?: string, fullPage = false, replace = false) {
    const next = new URLSearchParams(searchParams)
    if (itemId) next.set('entry', itemId)
    else next.delete('entry')
    if (fullPage) next.set('full', '1')
    else next.delete('full')
    setSearchParams(next, { replace })
  }

  async function saveEntryField(field: FieldDef, value: string) {
    if (!selectedEntry) return
    await updateItem(selectedEntry, field, value)
    await entryDetails.refresh()
    setToastMessage(`Saved ${field.name}`)
  }

  async function saveEntryTitle(title: string) {
    if (!selectedEntry) return
    await updateItem(selectedEntry, null, title)
    await entryDetails.refresh()
    setToastMessage('Entry renamed')
  }

  async function saveEntryOptions(field: FieldDef, options: string[]) {
    await saveSchema(fields.map((current) => current.id === field.id ? { ...current, options } : current))
    setToastMessage(`Updated ${field.name} options`)
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
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-2 text-xs hover:bg-muted">
            Saved views
          </summary>
          <div className="absolute left-0 top-10 z-20 rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button
              type="button"
              className="whitespace-nowrap rounded px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                setQuery('')
                setFilterField('')
                setFilterValue('')
              }}
            >
              All entries
            </button>
          </div>
        </details>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterField(filterField ? '' : (fields[0]?.id ?? ''))}
        >
          Filters
        </Button>
        {dateField ? (
          <Button
            variant={filterField === dateField.id ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilterField(dateField.id)}
          >
            Date
          </Button>
        ) : null}
        {amountField ? (
          <Button
            variant={filterField === amountField.id ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFilterField(amountField.id)}
          >
            Amount
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => searchRef.current?.focus()}
        >
          Search
        </Button>
        <label className="relative min-w-40 flex-1 sm:max-w-xs">
          <span className="sr-only">Search collection</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sort entries"
          onClick={() => toggleSort(sortField || dateField?.id || 'title')}
        >
          <ArrowUpDown />
        </Button>
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
                      const visible =
                        current ??
                        fields
                          .filter(
                            (item) =>
                              !(
                                collection.id === 'purchases' &&
                                item.id === 'description'
                              ),
                          )
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
          className="ml-auto flex flex-wrap items-center gap-1"
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
      <section
        aria-label="Current filter summary"
        className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        <div className="rounded-lg border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="text-right text-lg font-semibold tabular-nums">{filteredItems.length}</p>
        </div>
        {amountTotal !== null ? (
          <>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-right text-lg font-semibold tabular-nums">{currency(amountTotal)}</p>
            </div>
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-right text-lg font-semibold tabular-nums">{currency(amountAverage)}</p>
            </div>
          </>
        ) : null}
      </section>
      {toastMessage ? (
        <p role="status" className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-popover px-4 py-2 text-sm shadow-lg">
          {toastMessage}
          {undoAvailable ? (
            <button
              type="button"
              className="ml-3 font-medium underline"
              onClick={() => {
                void undoRemoveItems()
                setUndoAvailable(false)
                setToastMessage('Deletion undone')
              }}
            >
              Undo
            </button>
          ) : null}
          <button type="button" className="ml-3 text-muted-foreground underline" onClick={() => setToastMessage('')}>Dismiss</button>
        </p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
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
              onClick={() =>
                void removeItems(selectedIds).then((removed) => {
                  if (removed) {
                    setUndoAvailable(true)
                    setToastMessage(`Deleted ${selectedIds.length} entries`)
                  }
                })
              }
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
        display === 'table' ? (
          <CollectionTable
            items={filteredItems}
            fields={shownFields}
            selectedIds={selectedIds}
            sortField={sortField}
            sortDirection={sortDirection}
            columnWidths={columnWidths}
            onSort={toggleSort}
            onResize={(fieldId, width) =>
              void updateColumnWidth(fieldId, width)
            }
            onSelect={(itemId, selected) =>
              setSelectedIds((current) =>
                selected
                  ? [...new Set([...current, itemId])]
                  : current.filter((id) => id !== itemId),
              )
            }
            onSelectAll={(selected) =>
              setSelectedIds(
                selected ? filteredItems.map((item) => item.id) : [],
              )
            }
            onSave={updateItem}
            selectedEntryId={entryId}
            onOpen={(item) => setEntryQuery(item.id)}
            onDelete={(itemId) =>
              void removeItems([itemId]).then((removed) => {
                if (removed) {
                  setUndoAvailable(true)
                  setToastMessage('Entry deleted')
                }
              })
            }
          />
        ) : (
          <EntryView
            mode={display as Exclude<DisplayMode, 'table'>}
            items={filteredItems}
            fields={shownFields}
            onOpen={(item) => setEntryQuery(item.id)}
          />
        )
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
                  draft[field.id] ??
                  (field.type === 'date' ? localDateString() : '')
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
      {selectedEntry ? (
        <EntryDetailPanel
          item={selectedEntry}
          collection={collection}
          detail={
            entryDetails.detail ?? {
              itemId: selectedEntry.id,
              activity: [],
              subItems: [],
              files: [],
              links: [],
            }
          }
          fullPage={searchParams.get('full') === '1'}
          onClose={() => setEntryQuery(undefined, false, true)}
          onOpenFull={() =>
            setEntryQuery(
              selectedEntry.id,
              searchParams.get('full') !== '1',
              true,
            )
          }
          onSaveField={(field, value) => void saveEntryField(field, value)}
          onSaveTitle={(title) => void saveEntryTitle(title)}
          onSaveOptions={(field, options) =>
            void saveEntryOptions(field, options)
          }
          onAddNote={(note) => {
            void entryDetails.addNote(note)
            setToastMessage('Note added')
          }}
          onAddSubItem={async (title, dueDate) => {
            if (!selectedEntry) return
            const subItemId = await addSubItem(selectedEntry, title, dueDate)
            await entryDetails.addSubItem(title, subItemId, dueDate)
            setToastMessage('Sub-item added')
          }}
          onUpdateSubItem={async (id, completed) => {
            await updateSubItem(id, completed)
            await entryDetails.updateSubItem(id, completed)
            setToastMessage(completed ? 'Sub-item completed' : 'Sub-item reopened')
          }}
          onAddFile={(file) => {
            void entryDetails.addFile(file)
            setToastMessage('File added')
          }}
          onAddLink={(url) => {
            void entryDetails.addLink(url)
            setToastMessage('Link added')
          }}
          onNotify={setToastMessage}
        />
      ) : null}
    </div>
  )
}

function modeLabel(mode: DisplayMode) {
  return mode[0].toUpperCase() + mode.slice(1)
}
