/* eslint-disable react-hooks/refs */
import { useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import type { AreaPageSettings, Block, BlockSize } from '@/services/api'
import type { AreaScreenData } from '@/components/areas/area-screen-data'
import { AreaBlockContent } from '@/components/areas/area-block-content'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function SortableAreaBlock({
  block,
  data,
  pageSettings,
  customizing,
  menuOpen,
  onMenuOpenChange,
  selected,
  onSelect,
  onSave,
  onDelete,
  onDuplicate,
  onMove,
  onSettings,
  onOpenPicker,
}: {
  block: Block
  data: AreaScreenData
  pageSettings: AreaPageSettings
  customizing: boolean
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  selected: boolean
  onSelect: () => void
  onSave: (block: Block) => Promise<void>
  onDelete: (block: Block) => Promise<void>
  onDuplicate: (block: Block) => Promise<void>
  onMove: (block: Block, delta: number) => Promise<void>
  onSettings: () => void
  onOpenPicker: () => void
}) {
  const sortable = useSortable({ id: block.id, disabled: !customizing })
  const resizeStart = useRef<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const title = block.type === 'view' ? block.view.title : (block.title ?? block.type)

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onMenuOpenChange(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMenuOpenChange(false)
        menuTriggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [menuOpen, onMenuOpenChange])

  const style = {
    transform: sortable.transform
      ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0) scaleX(${sortable.transform.scaleX}) scaleY(${sortable.transform.scaleY})`
      : undefined,
    transition: sortable.transition,
  }

  return (
    <div
      id={`block-${block.id}`}
      ref={sortable.setNodeRef}
      style={style}
      className={cn('group/block relative min-w-0 rounded-lg', customizing && selected && 'outline outline-1 outline-primary/30')}
      tabIndex={-1}
      onFocusCapture={() => customizing && onSelect()}
      onClick={() => customizing && onSelect()}
    >
      {customizing ? (
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Drag ${title}`}
          className="absolute -left-2 top-1/2 z-10 grid size-6 -translate-x-full -translate-y-1/2 touch-none place-items-center rounded text-muted-foreground hover:bg-muted"
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      ) : null}
      {customizing ? (
        <div ref={menuRef} className="absolute right-1 top-1 z-10">
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label={`${title} block menu`}
            aria-expanded={menuOpen}
            onClick={() => onMenuOpenChange(!menuOpen)}
            className="grid size-8 place-items-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:bg-muted"
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-9 z-20 flex w-40 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
              <button className="rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onMenuOpenChange(false); onSettings() }}>Settings</button>
              <button className="rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onMenuOpenChange(false); void onDuplicate(block) }}>Duplicate</button>
              <label className="flex flex-col gap-1 px-3 py-2 text-xs text-muted-foreground">
                Size
                <Select aria-label={`Size ${title}`} value={block.size ?? 'medium'} onChange={(event) => void onSave({ ...block, size: event.target.value as BlockSize })} className="h-8 text-sm text-foreground">
                  <option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option><option value="tall">Tall</option><option value="full">Full</option>
                </Select>
              </label>
              <button className="rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onMenuOpenChange(false); void onMove(block, -1) }}>Move up</button>
              <button className="rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onMenuOpenChange(false); void onMove(block, 1) }}>Move down</button>
              <button className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted" onClick={() => { onMenuOpenChange(false); void onDelete(block) }}>Remove</button>
            </div>
          ) : null}
        </div>
      ) : null}
      <AreaBlockContent
        block={block}
        data={data}
        pageSettings={pageSettings}
        customizing={customizing}
        onSave={onSave}
        onOpenPicker={onOpenPicker}
      />
      {customizing ? (
        <button
          type="button"
          aria-label={`Resize ${title}`}
          title="Drag to resize"
          className="absolute bottom-1 right-1 grid size-6 touch-none cursor-nwse-resize place-items-center rounded text-muted-foreground hover:bg-muted"
          onPointerDown={(event) => {
            resizeStart.current = { x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) => {
            const start = resizeStart.current
            resizeStart.current = null
            if (!start) return
            const x = event.clientX - start.x
            const y = event.clientY - start.y
            const size: BlockSize = x > 150 ? 'full' : x > 60 ? 'wide' : x < -60 ? 'small' : y > 60 ? 'tall' : 'medium'
            void onSave({ ...block, size })
          }}
        >
          <span aria-hidden="true">⌟</span>
        </button>
      ) : null}
    </div>
  )
}
