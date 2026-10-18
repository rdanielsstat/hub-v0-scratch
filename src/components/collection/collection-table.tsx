import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Trash2 } from 'lucide-react'
import type { FieldDef, Item, ItemValue } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FieldValue, formatFieldValue } from '@/lib/field-format'

export interface CollectionTableProps {
  items: Item[]
  fields: FieldDef[]
  selectedIds: string[]
  sortField: string
  sortDirection: 'asc' | 'desc'
  columnWidths: Record<string, number>
  onSort: (fieldId: string) => void
  onResize: (fieldId: string, width: number) => void
  onSelect: (itemId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onSave: (item: Item, field: FieldDef | null, value: string) => Promise<void>
  onDelete: (itemId: string) => void
}

const minimumWidth = (field?: FieldDef) => {
  if (!field) return 150
  if (field.type === 'checkbox') return 64
  if (field.type === 'currency' || field.type === 'number' || field.type === 'duration') return 96
  if (field.type === 'date' || field.type === 'datetime') return 128
  if (field.type === 'image') return 100
  if (field.type === 'choice') return 118
  if (field.type === 'longText') return 200
  return 132
}

function fittedWidth(key: string, field: FieldDef | undefined, items: Item[]) {
  const values = items.map((item) =>
    key === 'title' ? item.title : formatFieldValue(item.data[key], field),
  )
  const longest = Math.max(key === 'title' ? 4 : (field?.name.length ?? 4), ...values.map((value) => value.length))
  return Math.min(420, Math.max(minimumWidth(field), longest * 8 + 36))
}

function CellEditor({
  value,
  field,
  ariaLabel,
  onCommit,
  onCancel,
}: {
  value: ItemValue | undefined
  field?: FieldDef
  ariaLabel: string
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => {
    if (field?.type === 'checkbox') return value === true ? 'true' : 'false'
    if (Array.isArray(value)) return value.join(', ')
    if (value && typeof value === 'object') return value.title
    return String(value ?? '')
  })

  if (field?.type === 'choice' && field.options?.length)
    return (
      <Select aria-label={ariaLabel} autoFocus value={draft} onChange={(event) => onCommit(event.target.value)} className="h-8 min-w-24">
        <option value="">Choose</option>
        {field.options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    )
  if (field?.type === 'checkbox')
    return (
      <input
        type="checkbox"
        aria-label={ariaLabel}
        autoFocus
        checked={draft === 'true'}
        onChange={(event) => onCommit(String(event.target.checked))}
      />
    )
  return (
    <Input
      aria-label={ariaLabel}
      autoFocus
      type={field?.type === 'date' ? 'date' : field?.type === 'number' || field?.type === 'currency' || field?.type === 'duration' ? 'number' : 'text'}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault()
          onCommit(draft)
        }
      }}
      className="h-8 min-w-24"
    />
  )
}

function EditableCell({
  item,
  field,
  onSave,
}: {
  item: Item
  field: FieldDef | null
  onSave: CollectionTableProps['onSave']
}) {
  const [editing, setEditing] = useState(false)
  const committed = useRef(false)
  const rawValue = field ? item.data[field.id] : item.title
  const text = field ? formatFieldValue(rawValue, field) : item.title
  if (editing)
    return (
      <CellEditor
        value={rawValue}
        field={field ?? undefined}
        ariaLabel={`${field?.name ?? 'Name'} ${item.title}`}
        onCommit={(value) => {
          if (committed.current) return
          committed.current = true
          setEditing(false)
          if (value !== String(rawValue ?? '')) void onSave(item, field, value)
        }}
        onCancel={() => {
          committed.current = true
          setEditing(false)
        }}
      />
    )
  return (
    <button
      type="button"
      aria-label={`${field?.name ?? 'Name'} ${item.title}, edit`}
      className="block w-full whitespace-normal break-words rounded px-1 py-1 text-left text-sm hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        committed.current = false
        setEditing(true)
      }}
    >
      {field?.type === 'checkbox' ? (
        rawValue === true ? <Check aria-label="Checked" className="size-4" /> : null
      ) : text}
    </button>
  )
}

function ResizeHandle({
  fieldId,
  width,
  field,
  items,
  onResize,
}: {
  fieldId: string
  width: number
  field?: FieldDef
  items: Item[]
  onResize: (width: number) => void
}) {
  const start = useRef<{ x: number; width: number } | null>(null)
  return (
    <>
      <button
        type="button"
        aria-label={`Resize ${field?.name ?? 'Name'} column`}
        title="Drag to resize, double-click to fit content"
        onPointerDown={(event) => {
          start.current = { x: event.clientX, width }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!start.current) return
          onResize(Math.max(minimumWidth(field), start.current.width + event.clientX - start.current.x))
        }}
        onPointerUp={() => { start.current = null }}
        onDoubleClick={() => onResize(fittedWidth(fieldId, field, items))}
        className="absolute inset-y-0 right-0 z-10 w-2 touch-none cursor-col-resize bg-transparent hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <details className="absolute right-2 top-1 z-20">
        <summary aria-label={`${field?.name ?? 'Name'} column options`} className="grid size-5 cursor-pointer list-none place-items-center rounded text-muted-foreground hover:bg-muted">
          <ChevronDown className="size-3" />
        </summary>
        <div className="absolute right-0 top-6 flex w-36 flex-col rounded-md border border-border bg-popover p-1 shadow-lg">
          <button className="rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onResize(width + 20)}>Wider</button>
          <button className="rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onResize(Math.max(minimumWidth(field), width - 20))}>Narrower</button>
          <button className="rounded px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onResize(fittedWidth(fieldId, field, items))}>Fit to content</button>
        </div>
      </details>
    </>
  )
}

export function CollectionTable({
  items,
  fields,
  selectedIds,
  sortField,
  sortDirection,
  columnWidths,
  onSort,
  onResize,
  onSelect,
  onSelectAll,
  onSave,
  onDelete,
}: CollectionTableProps) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.id))
  const columns = [
    { id: '__selection', width: 40 },
    { id: 'title', width: columnWidths.title ?? 185 },
    ...fields.map((field) => ({ id: field.id, width: columnWidths[field.id] ?? minimumWidth(field), field })),
    { id: '__delete', width: 44 },
  ]
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  return (
    <>
      <div tabIndex={0} aria-label="Collection table" className="hidden max-h-[65vh] overflow-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:block">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>{columns.map((column) => <col key={column.id} style={{ width: column.width }} />)}</colgroup>
          <thead className="sticky top-0 z-10 bg-muted/90 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-2"><input type="checkbox" aria-label="Select all items" checked={allSelected} onChange={(event) => onSelectAll(event.target.checked)} /></th>
              <th scope="col" aria-sort={sortField === 'title' ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} className="relative whitespace-normal break-words px-3 py-2 font-medium">
                <button type="button" onClick={() => onSort('title')} className="flex items-center gap-1 text-left">Name{sortField === 'title' ? sortDirection === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}</button>
                <ResizeHandle fieldId="title" width={columnWidths.title ?? 185} items={items} onResize={(width) => onResize('title', width)} />
              </th>
              {fields.map((field) => (
                <th key={field.id} scope="col" aria-sort={sortField === field.id ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} className="relative whitespace-normal break-words px-3 py-2 font-medium">
                  <button type="button" onClick={() => onSort(field.id)} className="flex items-center gap-1 text-left">{field.name}{sortField === field.id ? sortDirection === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}</button>
                  <ResizeHandle fieldId={field.id} width={columnWidths[field.id] ?? minimumWidth(field)} field={field} items={items} onResize={(width) => onResize(field.id, width)} />
                </th>
              ))}
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-border/70">
                <td className="px-2 py-1 text-center"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.includes(item.id)} onChange={(event) => onSelect(item.id, event.target.checked)} /></td>
                <td className="px-2 py-1"><EditableCell item={item} field={null} onSave={onSave} /></td>
                {fields.map((field) => <td key={field.id} className="px-2 py-1"><EditableCell item={item} field={field} onSave={onSave} /></td>)}
                <td className="px-1 py-1 text-center"><Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 md:hidden" aria-label="Collection entries as cards">
        {items.map((item) => {
          const expanded = expandedIds.includes(item.id)
          const visibleFields = expanded ? fields : fields.slice(0, 4)
          return (
            <article key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex min-w-0 items-start gap-2">
                <input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedIds.includes(item.id)} onChange={(event) => onSelect(item.id, event.target.checked)} />
                <div className="min-w-0 flex-1"><EditableCell item={item} field={null} onSave={onSave} /></div>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 /></Button>
              </div>
              {visibleFields.map((field) => (
                <div key={field.id} className="grid min-w-0 grid-cols-[minmax(0,6rem)_minmax(0,1fr)] items-start gap-2 border-t border-border/60 py-1.5">
                  <span className="break-words text-xs text-muted-foreground">{field.name}</span>
                  <div className="min-w-0"><EditableCell item={item} field={field} onSave={onSave} /></div>
                </div>
              ))}
              {fields.length > 4 ? <button type="button" aria-expanded={expanded} className="mt-2 text-xs font-medium text-primary" onClick={() => setExpandedIds((current) => expanded ? current.filter((id) => id !== item.id) : [...current, item.id])}>{expanded ? 'Show fewer' : 'Show all'}</button> : null}
            </article>
          )
        })}
      </div>
    </>
  )
}
