import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import type { AreaSection } from '@/services/api'
import { blockOptions, type AreaBlockType } from '@/components/areas/area-block-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function DropZone({
  id,
  enabled,
  children,
}: {
  id: string
  enabled: boolean
  children: ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: !enabled })
  return (
    <section
      ref={setNodeRef}
      className={cn('min-w-0 rounded-lg', isOver && 'outline outline-2 outline-primary/40')}
    >
      {children}
    </section>
  )
}

export function BlockPicker({
  onPick,
  onClose,
  onOpenChange,
  open,
  buttonLabel,
}: {
  onPick: (type: AreaBlockType) => void
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  open?: boolean
  buttonLabel?: string
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const isOpen = open ?? internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next)
      onOpenChange?.(next)
      if (!next) onClose?.()
    },
    [onClose, onOpenChange, open],
  )

  useEffect(() => {
    if (!isOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [isOpen, setOpen])

  return (
    <div ref={rootRef} className="group/picker relative flex min-h-5 items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add a block"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className={
          buttonLabel
            ? 'inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted'
            : 'mx-auto grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:text-foreground group-hover/picker:bg-muted group-hover/picker:text-foreground'
        }
      >
        {buttonLabel ? buttonLabel : <Plus className="size-4" />}
      </button>
      {isOpen ? (
        <div
          aria-label="Choose a block"
          className="absolute left-1/2 top-7 z-30 grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-1 gap-1 rounded-xl border border-border bg-popover p-2 shadow-xl sm:grid-cols-2"
        >
          {blockOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  onPick(option.key)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                className="flex min-w-0 items-start gap-2 rounded-lg p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function SectionMenu({
  section,
  onUpdate,
  onMove,
  onDelete,
}: {
  section: AreaSection
  onUpdate: (patch: Partial<AreaSection>) => void
  onMove: (delta: number) => void
  onDelete: () => void
}) {
  return (
    <header className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{section.title || 'Section'}</h2>
      <details className="relative">
        <summary
          aria-label={`Section options${section.title ? ` for ${section.title}` : ''}`}
          className="grid size-8 cursor-pointer list-none place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <MoreHorizontal className="size-4" />
        </summary>
        <div className="absolute right-0 top-9 z-20 flex w-64 flex-col gap-3 rounded-xl border border-border bg-popover p-3 shadow-lg">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Section title
            <Input
              aria-label="Section title"
              defaultValue={section.title ?? ''}
              onBlur={(event) => event.currentTarget.value !== section.title && onUpdate({ title: event.currentTarget.value })}
              className="h-8 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Layout
            <Select
              aria-label="Section layout"
              value={section.layout}
              onChange={(event) => onUpdate({ layout: event.target.value as AreaSection['layout'] })}
            >
              <option value="stack">Stack</option>
              <option value="grid">Grid</option>
            </Select>
          </label>
          {section.layout === 'grid' ? (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Columns
              <Select
                aria-label="Section columns"
                value={String(section.columns)}
                onChange={(event) => onUpdate({ columns: Number(event.target.value) as AreaSection['columns'] })}
              >
                {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} columns</option>)}
              </Select>
            </label>
          ) : null}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onMove(-1)}><ArrowUp />Move up</Button>
            <Button variant="outline" size="sm" onClick={() => onMove(1)}><ArrowDown />Move down</Button>
          </div>
          <Button variant="ghost" size="sm" className="justify-start text-destructive" onClick={onDelete}><Trash2 />Delete section</Button>
        </div>
      </details>
    </header>
  )
}
