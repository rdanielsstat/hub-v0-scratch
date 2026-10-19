import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Copy, ExternalLink, MoreHorizontal, X } from 'lucide-react'
import type {
  CollectionSchema,
  EntryDetail,
  FieldDef,
  Item,
} from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatLocalDate, localDateString } from '@/lib/local-date'
import { usePanelEscape } from '@/components/areas/use-panel-escape'

const keyFieldOrder: Record<string, string[]> = {
  purchases: ['merchant', 'category', 'amount'],
  inventory: ['location', 'amount', 'warrantyEnds'],
}

function submitOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  submit: () => void,
) {
  if (
    event.key === 'Enter' &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  ) {
    event.preventDefault()
    submit()
  }
}

function EntryField({
  item,
  field,
  onSave,
  onSaveOptions,
}: {
  item: Item
  field: FieldDef
  onSave: (field: FieldDef, value: string) => void
  onSaveOptions: (field: FieldDef, options: string[]) => void
}) {
  const [editingOptions, setEditingOptions] = useState(false)
  const [options, setOptions] = useState((field.options ?? []).join('\n'))
  const value = item.data[field.id]
  const overdue =
    field.type === 'date' &&
    typeof value === 'string' &&
    value < localDateString() &&
    item.data.completed !== true &&
    String(item.data.status ?? '').toLowerCase() !== 'done'
  const wide = field.type === 'text' || field.type === 'longText'
  return (
    <div
      className={`min-w-0 rounded-xl border border-border p-3 ${wide ? 'col-span-full' : ''}`}
    >
      <p className="mb-1 text-xs text-muted-foreground">{field.name}</p>
      {field.type === 'choice' ? (
        <Select
          aria-label={field.name}
          value={String(value ?? '')}
          onChange={(event) => onSave(field, event.target.value)}
          className="h-9 w-full"
        >
          <option value="">Choose</option>
          {(field.options ?? []).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
      ) : field.type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => onSave(field, String(event.target.checked))}
          />
          {value === true ? 'Complete' : 'Not complete'}
        </label>
      ) : field.type === 'currency' ? (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          >
            $
          </span>
          <Input
            key={`${item.id}-${field.id}-${String(value ?? '')}`}
            aria-label={`${field.name} in dollars`}
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={typeof value === 'number' ? value.toFixed(2) : ''}
            onBlur={(event) => {
              const next = event.currentTarget.value
              if (next !== '' && Number(next) !== value) onSave(field, next)
            }}
            className="pl-6 tabular-nums"
          />
        </div>
      ) : (
        <Input
          key={`${item.id}-${field.id}-${String(value ?? '')}`}
          aria-label={field.name}
          type={
            field.type === 'date'
              ? 'date'
              : field.type === 'number'
                ? 'number'
                : 'text'
          }
          defaultValue={String(value ?? '')}
          onBlur={(event) =>
            event.currentTarget.value !== String(value ?? '') &&
            onSave(field, event.currentTarget.value)
          }
          className={overdue ? 'text-destructive' : undefined}
        />
      )}
      {field.type === 'choice' ? (
        editingOptions ? (
          <div className="mt-2 flex flex-col gap-2">
            <Textarea
              aria-label={`Options for ${field.name}`}
              value={options}
              onChange={(event) => setOptions(event.target.value)}
            />
            <Button
              size="sm"
              onClick={() => {
                onSaveOptions(field, [
                  ...new Set(
                    options
                      .split('\n')
                      .map((option) => option.trim())
                      .filter(Boolean),
                  ),
                ])
                setEditingOptions(false)
              }}
            >
              Save options
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setEditingOptions(true)}
          >
            Edit options
          </button>
        )
      ) : null}
    </div>
  )
}

export function EntryDetailPanel({
  item,
  collection,
  detail,
  fullPage,
  onClose,
  onOpenFull,
  onSaveField,
  onSaveTitle,
  onSaveOptions,
  onAddNote,
  onAddSubItem,
  onUpdateSubItem,
  onAddFile,
  onAddLink,
  onNotify,
}: {
  item: Item
  collection: CollectionSchema
  detail: EntryDetail
  fullPage: boolean
  onClose: () => void
  onOpenFull: () => void
  onSaveField: (field: FieldDef, value: string) => void
  onSaveTitle: (title: string) => void
  onSaveOptions: (field: FieldDef, options: string[]) => void
  onAddNote: (note: string) => void
  onAddSubItem: (title: string, dueDate?: string) => void
  onUpdateSubItem: (id: string, completed: boolean) => void
  onAddFile: (file: {
    name: string
    type: string
    size: number
    url?: string
  }) => void
  onAddLink: (url: string) => void
  onNotify: (message: string) => void
}) {
  const [allFieldsOpen, setAllFieldsOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [note, setNote] = useState('')
  const [subItem, setSubItem] = useState('')
  const [subItemDueDate, setSubItemDueDate] = useState('')
  const [link, setLink] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkTarget, setLinkTarget] = useState<'file' | 'linked'>('linked')
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const latestRef = useRef<HTMLLIElement>(null)
  usePanelEscape(onClose)

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    const getFocusableElements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')
    const focusable = getFocusableElements()
    focusable[0]?.focus()

    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = getFocusableElements()
      const first = elements[0]
      const last = elements.at(-1)
      const activeIndex = elements.indexOf(
        document.activeElement as HTMLElement,
      )
      if (!first || !last) return
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeIndex === -1) {
        event.preventDefault()
        first.focus()
      } else if (!event.shiftKey && activeIndex === elements.length - 1) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => {
      document.removeEventListener('keydown', trapFocus)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])

  const orderedIds =
    keyFieldOrder[collection.id] ??
    collection.fields.slice(0, 3).map((field) => field.id)
  const keyFields = orderedIds
    .map((id) => collection.fields.find((field) => field.id === id))
    .filter((field): field is FieldDef => Boolean(field))
    .slice(0, 3)
  const rest = collection.fields.filter(
    (field) => !keyFields.some((key) => key.id === field.id),
  )
  const references = Object.values(item.data).flatMap((value) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      'itemId' in value &&
      typeof value.title === 'string'
    )
      return [value.title]
    return []
  })
  const linked = [...new Set([...detail.links, ...references])]
  const saveTitle = () => {
    const next = title.trim()
    if (next && next !== item.title) onSaveTitle(next)
    setEditingTitle(false)
  }
  const addNote = () => {
    if (!note.trim()) return
    onAddNote(note.trim())
    setNote('')
  }
  const addSub = () => {
    if (!subItem.trim()) return
    onAddSubItem(subItem.trim(), subItemDueDate || undefined)
    setSubItem('')
    setSubItemDueDate('')
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      onNotify('Link copied')
    } catch {
      onNotify('Could not copy the link')
    }
  }
  const addWebsite = () => {
    if (!/^https?:\/\//i.test(link.trim()))
      return onNotify('Enter a valid website link')
    if (linkTarget === 'file')
      onAddFile({
        name: link.trim(),
        type: 'Website link',
        size: 0,
        url: link.trim(),
      })
    else onAddLink(link.trim())
    setLink('')
    setLinkOpen(false)
  }

  return (
    <aside
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} details`}
      className={`fixed inset-0 z-40 flex flex-col border-l border-border bg-background shadow-2xl sm:inset-y-0 sm:left-auto ${fullPage ? 'sm:right-0 sm:w-full' : 'sm:right-0 sm:w-full sm:max-w-[480px]'}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onOpenFull}>
          <ExternalLink aria-hidden="true" />
          {fullPage ? 'Panel view' : 'Open full page'}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy entry link"
            onClick={() => void copyLink()}
          >
            <Copy />
          </Button>
          <details className="relative">
            <summary
              aria-label="Entry options"
              className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <MoreHorizontal />
            </summary>
            <div className="absolute right-0 top-9 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button
                type="button"
                className="whitespace-nowrap rounded px-3 py-2 text-sm hover:bg-muted"
                onClick={() => void copyLink()}
              >
                Copy link
              </button>
            </div>
          </details>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close entry details"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
        <div ref={topRef} />
        <div className="py-5">
          {editingTitle ? (
            <Input
              aria-label="Entry title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => submitOnEnter(event, saveTitle)}
              className="text-2xl font-semibold"
            />
          ) : (
            <button
              type="button"
              aria-label={`Rename ${item.title}`}
              className="break-words text-left text-2xl font-semibold tracking-tight hover:underline"
              onClick={() => {
                setTitle(item.title)
                setEditingTitle(true)
              }}
            >
              {item.title}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {keyFields.map((field) => (
            <EntryField
              key={field.id}
              item={item}
              field={field}
              onSave={onSaveField}
              onSaveOptions={onSaveOptions}
            />
          ))}
        </div>
        {rest.length ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-fit px-1 text-muted-foreground"
            aria-expanded={allFieldsOpen}
            onClick={() => setAllFieldsOpen((open) => !open)}
          >
            {allFieldsOpen
              ? 'Hide other fields'
              : `Show ${rest.length} more ${rest.length === 1 ? 'field' : 'fields'}`}
          </Button>
        ) : null}
        {allFieldsOpen ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {rest.map((field) => (
              <EntryField
                key={field.id}
                item={item}
                field={field}
                onSave={onSaveField}
                onSaveOptions={onSaveOptions}
              />
            ))}
          </div>
        ) : null}
        <nav
          aria-label="Entry detail sections"
          className="my-5 flex flex-wrap gap-2"
        >
          <a
            href="#entry-subitems"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          >
            {detail.subItems.length}{' '}
            {detail.subItems.length === 1 ? 'sub-item' : 'sub-items'}
          </a>
          <a
            href="#entry-files"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          >
            {detail.files.length} {detail.files.length === 1 ? 'file' : 'files'}
          </a>
          <a
            href="#entry-links"
            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          >
            {linked.length} {linked.length === 1 ? 'link' : 'links'}
          </a>
        </nav>
        {typeof item.data.description === 'string' && item.data.description ? (
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-medium">Description</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {item.data.description}
            </p>
          </section>
        ) : null}
        <section id="entry-subitems" className="mb-5 scroll-mt-4">
          <h2 className="mb-2 text-sm font-medium">Sub-items</h2>
          <ul className="flex flex-col gap-2">
            {detail.subItems.map((child) => (
              <li key={child.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Complete ${child.title}`}
                  checked={child.completed}
                  onChange={(event) =>
                    onUpdateSubItem(child.id, event.target.checked)
                  }
                />
                <span
                  className={
                    child.completed ? 'text-muted-foreground line-through' : ''
                  }
                >
                  {child.title}
                </span>
                {child.dueDate ? (
                  <time className="ml-auto text-xs text-muted-foreground">
                    {formatLocalDate(child.dueDate)}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              aria-label="New sub-item"
              placeholder="Add a sub-item"
              value={subItem}
              onChange={(event) => setSubItem(event.target.value)}
              onKeyDown={(event) => submitOnEnter(event, addSub)}
            />
            <Input
              aria-label="Sub-item date"
              type="date"
              value={subItemDueDate}
              onChange={(event) => setSubItemDueDate(event.target.value)}
              className="w-40"
            />
            <Button variant="outline" onClick={addSub}>
              + Sub-item
            </Button>
          </div>
        </section>
        <section id="entry-files" className="mb-5 scroll-mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Files</h2>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                Add files
              </summary>
              <div className="absolute right-0 top-8 z-10 flex min-w-40 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                <button
                  type="button"
                  className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => fileRef.current?.click()}
                >
                  From this device
                </button>
                <button
                  type="button"
                  className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    setLinkTarget('file')
                    setLinkOpen(true)
                  }}
                >
                  Website link
                </button>
              </div>
            </details>
            <input
              ref={fileRef}
              type="file"
              aria-label="Choose file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file)
                  onAddFile({
                    name: file.name,
                    type: file.type || 'File',
                    size: file.size,
                    url: file.type.startsWith('image/')
                      ? URL.createObjectURL(file)
                      : undefined,
                  })
                event.currentTarget.value = ''
              }}
            />
          </div>
          {detail.files.length ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {detail.files.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  {file.url && file.type.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="size-12 rounded object-cover"
                    />
                  ) : (
                    <span className="grid size-10 place-items-center rounded bg-muted text-xs text-muted-foreground">
                      {file.type}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 break-words">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {file.type} · {Math.max(1, Math.round(file.size / 1024))} KB
                    · {formatLocalDate(file.addedAt, true)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          )}
          {linkOpen ? (
            <div className="mt-2 flex gap-2">
              <Input
                aria-label="Website link"
                placeholder="https://example.com"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onKeyDown={(event) => submitOnEnter(event, addWebsite)}
              />
              <Button variant="outline" onClick={addWebsite}>
                Add link
              </Button>
            </div>
          ) : null}
        </section>
        <section id="entry-links" className="mb-5 scroll-mt-4">
          <h2 className="mb-2 text-sm font-medium">Linked items</h2>
          {linked.length ? (
            <ul className="flex flex-col gap-2">
              {linked.map((name) => (
                <li
                  key={name}
                  className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {/^https?:\/\//i.test(name) ? (
                    <a
                      href={name}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-primary underline-offset-4 hover:underline"
                    >
                      {name}
                    </a>
                  ) : (
                    <span className="break-words">{name}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No linked items yet.
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => {
              setLinkTarget('linked')
              setLinkOpen(true)
            }}
          >
            + Add link
          </Button>
        </section>
        <section className="pb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Activity</h2>
            {detail.activity.length > 8 ? (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() =>
                    topRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Jump to top
                </button>
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() =>
                    latestRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Latest
                </button>
              </div>
            ) : null}
          </div>
          {detail.activity.length ? (
            <ol className="flex flex-col gap-3">
              {detail.activity.map((entry) => (
                <li key={entry.id} className="border-l border-border pl-3">
                  <p className="text-sm">{entry.text}</p>
                  <time className="text-xs text-muted-foreground">
                    {formatLocalDate(entry.createdAt, true)}
                  </time>
                </li>
              ))}
              <li ref={latestRef} aria-label="Latest activity" />
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </section>
      </div>
      <form
        className="absolute inset-x-0 bottom-0 flex gap-2 border-t border-border bg-background p-3"
        onSubmit={(event) => {
          event.preventDefault()
          addNote()
        }}
      >
        <Input
          aria-label="Add a note"
          placeholder="Write a note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => submitOnEnter(event, addNote)}
        />
        <Button type="submit" disabled={!note.trim()}>
          Add note
        </Button>
      </form>
    </aside>
  )
}
