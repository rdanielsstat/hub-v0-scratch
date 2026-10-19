import type { RefObject } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { AreaPageSpec } from '@/services/api'
import { Button } from '@/components/ui/button'

/**
 * The area's page tabs. The active tab (or every tab while customizing) has
 * a "..." menu with Page settings, Rename, Move left, Move right, and Delete.
 */
export function PageTabs({
  areaName,
  pages,
  activePageId,
  customizing,
  menuPageId,
  menuRef,
  onSelect,
  onToggleMenu,
  onOpenSettings,
  onRename,
  onMove,
  onDelete,
  onAdd,
}: {
  areaName: string
  pages: AreaPageSpec[]
  activePageId?: string
  customizing: boolean
  menuPageId: string | null
  menuRef: RefObject<HTMLDivElement | null>
  onSelect: (pageId: string) => void
  onToggleMenu: (pageId: string) => void
  onOpenSettings: (page: AreaPageSpec) => void
  onRename: (page: AreaPageSpec) => void
  onMove: (page: AreaPageSpec, delta: number) => void
  onDelete: (page: AreaPageSpec) => void
  onAdd: () => void
}) {
  const ordered = [...pages].sort((left, right) => left.order - right.order)
  const onlyPage = pages.length < 2
  return (
    <nav
      className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border"
      aria-label={`${areaName} pages`}
    >
      {ordered.map((item, index) => {
        const isActive = activePageId === item.id
        const menuOpen = menuPageId === item.id
        return (
          <div
            key={item.id}
            className="relative flex shrink-0 items-center gap-1"
          >
            <button
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
            >
              {item.name}
            </button>
            {customizing || isActive ? (
              <div ref={menuOpen ? menuRef : undefined} className="relative">
                <button
                  type="button"
                  aria-label={`Options for ${item.name}`}
                  aria-expanded={menuOpen}
                  onClick={() => onToggleMenu(item.id)}
                  className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-8 z-30 flex w-44 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                    <button
                      type="button"
                      className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => onOpenSettings(item)}
                    >
                      Page settings
                    </button>
                    <button
                      type="button"
                      className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => onRename(item)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onMove(item, -1)}
                    >
                      Move left
                    </button>
                    <button
                      type="button"
                      disabled={index === ordered.length - 1}
                      className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onMove(item, 1)}
                    >
                      Move right
                    </button>
                    <button
                      type="button"
                      disabled={onlyPage}
                      title={
                        onlyPage
                          ? 'An area needs at least one page.'
                          : undefined
                      }
                      className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </button>
                    {onlyPage ? (
                      <span className="px-3 pb-2 text-xs text-muted-foreground">
                        Keep at least one page.
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
      {customizing ? (
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus />
          Add page
        </Button>
      ) : null}
    </nav>
  )
}
