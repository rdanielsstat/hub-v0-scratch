import { useState } from 'react'
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, X } from 'lucide-react'
import type { FieldDef, Item, CollectionSchema } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { FieldValue } from '@/lib/field-format'
import { formatFieldValue } from '@/lib/field-format-utils'
import { formatLocalDate } from '@/lib/local-date'

export type DisplayMode = 'table' | 'cards' | 'gallery' | 'timeline'

export function EntryView({
  mode,
  items,
  fields,
  onOpen,
}: {
  mode: Exclude<DisplayMode, 'table'>
  items: Item[]
  fields: FieldDef[]
  onOpen: (item: Item) => void
}) {
  const imageField = fields.find((field) => field.type === 'image')
  if (mode === 'gallery') {
    const displayedImages = new Set<string>()
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const image = imageField ? item.data[imageField.id] : undefined
          const imageUrl =
            typeof image === 'string' && image && !displayedImages.has(image)
              ? image
              : null
          if (imageUrl) displayedImages.add(imageUrl)
          return (
            <button
              type="button"
              key={item.id}
              aria-label={`Open ${item.title}`}
              onClick={() => onOpen(item)}
              className="overflow-hidden rounded-xl border border-border text-left hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="grid aspect-[4/3] place-items-center bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={item.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-3 text-center text-sm text-muted-foreground">
                    <ImageIcon
                      aria-hidden="true"
                      className="size-8 opacity-50"
                    />
                    <span className="break-words">{item.title}</span>
                  </div>
                )}
              </div>
              <span className="block break-words p-3 text-sm font-medium">
                {item.title}
              </span>
            </button>
          )
        })}
      </div>
    )
  }
  if (mode === 'timeline') {
    const dateField = fields.find(
      (field) => field.type === 'date' || field.type === 'datetime',
    )
    return (
      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          const rawDate = dateField
            ? String(item.data[dateField.id] ?? '')
            : (item.occurredAt ?? item.createdAt)
          const dateLabel = dateField
            ? formatFieldValue(item.data[dateField.id], dateField)
            : formatLocalDate(rawDate, rawDate.includes('T'))
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-label={`Open ${item.title}`}
                onClick={() => onOpen(item)}
                className="flex w-full gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                <h2 className="break-words text-sm font-medium">
                  {item.title}
                </h2>
                <time className="text-xs text-muted-foreground">
                  {dateLabel}
                </time>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-label={`Open ${item.title}`}
          onClick={() => onOpen(item)}
          className="rounded-xl border border-border p-4 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mb-2 block break-words text-sm font-medium">{item.title}</span>
          {fields.slice(0, 5).map((field) => (
            <p
              key={field.id}
              className="grid grid-cols-[minmax(0,5rem)_1fr] gap-2 py-1 text-xs"
            >
              <span className="break-words text-muted-foreground">
                {field.name}
              </span>
              <span className="break-words">
                <FieldValue value={item.data[field.id]} field={field} />
              </span>
            </p>
          ))}
        </button>
      ))}
    </div>
  )
}

export function SchemaEditor({
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

export function FieldInput({
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
