/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  Archive,
  BookOpen,
  CalendarDays,
  CirclePlus,
  Compass,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  Pin,
  Sparkles,
} from 'lucide-react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type {
  Area,
  AreaGroup,
  AreaStartFrom,
  AreasListPreferences,
} from '@/services/api'
import { areaLayoutApi, areasApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { AreaIcon } from '@/components/areas/area-icon'

const templates: Array<{
  id: AreaStartFrom
  name: string
  description: string
  icon: typeof NotebookPen
}> = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'A clear space, ready to shape.',
    icon: NotebookPen,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'A page to arrange useful views.',
    icon: LayoutDashboard,
  },
  {
    id: 'collection',
    name: 'Collection',
    description: 'A structured set of entries.',
    icon: Archive,
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'A quiet place for notes.',
    icon: BookOpen,
  },
  {
    id: 'tracker',
    name: 'Tracker',
    description: 'Record measures over time.',
    icon: Activity,
  },
  {
    id: 'routine',
    name: 'Routine',
    description: 'Keep repeatable steps together.',
    icon: ListChecks,
  },
  {
    id: 'wiki',
    name: 'Wiki',
    description: 'Organize notes and references.',
    icon: Sparkles,
  },
  {
    id: 'board',
    name: 'Board',
    description: 'Group work into flexible columns.',
    icon: Compass,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Capture entries around dates.',
    icon: CalendarDays,
  },
]

const defaultPreferences: AreasListPreferences = {
  density: 'comfortable',
  sort: 'manual',
  groupBy: 'none',
  details: {
    description: true,
    collectionCount: true,
    itemCount: true,
    lastActive: true,
  },
}

export function AreasDashboardPage() {
  const navigate = useNavigate()
  const loadAreas = useCallback(() => areasApi.listAreas(), [])
  const loadGroups = useCallback(() => areaLayoutApi.listGroups(), [])
  const loadPreferences = useCallback(
    () => areaLayoutApi.getAreasPreferences(),
    [],
  )
  const resource = useApiResource<Area[]>(loadAreas, 'areas-index')
  const groupsResource = useApiResource<AreaGroup[]>(loadGroups, 'area-groups')
  const preferencesResource = useApiResource<AreasListPreferences>(
    loadPreferences,
    'areas-list-preferences',
  )
  const preferences = preferencesResource.data ?? defaultPreferences
  const refreshAreasData = resource.refresh
  useEffect(() => {
    const refreshAreas = () => void refreshAreasData()
    window.addEventListener('hub:areas-changed', refreshAreas)
    return () => window.removeEventListener('hub:areas-changed', refreshAreas)
  }, [refreshAreasData])
  const [createOpen, setCreateOpen] = useState(false)
  const [startFrom, setStartFrom] = useState<AreaStartFrom | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  async function updatePreferences(patch: Partial<AreasListPreferences>) {
    const next = {
      ...preferences,
      ...patch,
      details: { ...preferences.details, ...patch.details },
    }
    preferencesResource.setData(next)
    await areaLayoutApi.saveAreasPreferences(next)
  }

  async function createArea() {
    if (!startFrom || !name.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const area = await areasApi.createArea({ name: name.trim(), startFrom })
      window.dispatchEvent(new Event('hub:areas-changed'))
      setCreateOpen(false)
      setName('')
      setStartFrom(null)
      navigate(`/area/${area.id}`, { state: { editName: true } })
    } catch {
      setCreateError('Could not create this area. Try again.')
    } finally {
      setCreating(false)
    }
  }

  const orderedAreas = useMemo(() => {
    const areas = [...(resource.data ?? [])]
    if (preferences.sort === 'name')
      return areas.sort((a, b) => a.name.localeCompare(b.name))
    if (preferences.sort === 'lastActive')
      return areas.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
    return areas.sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        (a.order ?? 0) - (b.order ?? 0),
    )
  }, [resource.data, preferences.sort])

  async function reorderAreas(event: DragEndEvent) {
    if (
      preferences.sort !== 'manual' ||
      !event.over ||
      event.active.id === event.over.id
    )
      return
    const next = [...orderedAreas]
    const from = next.findIndex((area) => area.id === event.active.id)
    const to = next.findIndex((area) => area.id === event.over?.id)
    if (from < 0 || to < 0) return
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    await areaLayoutApi.reorderAreas(next.map((area) => area.id))
    resource.setData(next.map((area, order) => ({ ...area, order })))
  }

  async function togglePin(area: Area) {
    const updated = await areaLayoutApi.updateArea(area.id, {
      pinned: !area.pinned,
    })
    resource.setData((previous) =>
      (previous ?? []).map((item) => (item.id === area.id ? updated : item)),
    )
  }

  const groups = groupsResource.data ?? []
  const renderedGroups =
    preferences.groupBy === 'sidebar'
      ? [
          ...groups.map((group) => ({
            id: group.id,
            name: group.name,
            areas: orderedAreas.filter((area) => area.groupId === group.id),
          })),
          {
            id: 'ungrouped',
            name: 'Ungrouped',
            areas: orderedAreas.filter(
              (area) => !groups.some((group) => group.id === area.groupId),
            ),
          },
        ].filter((group) => group.areas.length)
      : [{ id: 'all-areas', name: '', areas: orderedAreas }]

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Ongoing spaces
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Areas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            The parts of life you tend, return to, and keep learning from.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <CirclePlus />
          New area
        </Button>
      </header>

      {!resource.loading && !resource.error && orderedAreas.length > 0 ? (
        <section
          aria-label="Area list preferences"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 p-3"
        >
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Density
            <Select
              aria-label="Areas density"
              value={preferences.density}
              onChange={(event) =>
                void updatePreferences({
                  density: event.target
                    .value as AreasListPreferences['density'],
                })
              }
              className="h-8 w-36"
            >
              <option value="compact">Compact list</option>
              <option value="comfortable">Comfortable list</option>
              <option value="cards">Cards</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Sort
            <Select
              aria-label="Sort areas"
              value={preferences.sort}
              onChange={(event) =>
                void updatePreferences({
                  sort: event.target.value as AreasListPreferences['sort'],
                })
              }
              className="h-8 w-36"
            >
              <option value="manual">Manual</option>
              <option value="name">Name</option>
              <option value="lastActive">Last active</option>
            </Select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Group
            <Select
              aria-label="Group areas"
              value={preferences.groupBy}
              onChange={(event) =>
                void updatePreferences({
                  groupBy: event.target
                    .value as AreasListPreferences['groupBy'],
                })
              }
              className="h-8 w-44"
            >
              <option value="none">No grouping</option>
              <option value="sidebar">My sidebar groups</option>
            </Select>
          </label>
          <details className="relative ml-auto">
            <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              Glance details
            </summary>
            <div className="absolute right-0 top-8 z-20 flex min-w-44 flex-col gap-2 rounded-lg border border-border bg-popover p-3 shadow-lg">
              {(
                [
                  'description',
                  'collectionCount',
                  'itemCount',
                  'lastActive',
                ] as const
              ).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={preferences.details[key]}
                    onChange={(event) =>
                      void updatePreferences({
                        details: {
                          ...preferences.details,
                          [key]: event.target.checked,
                        },
                      })
                    }
                  />
                  {detailLabel(key)}
                </label>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {resource.loading ? (
        <div aria-label="Loading areas" className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : resource.error ? (
        <EmptyState
          icon={Compass}
          tone="danger"
          title="Could not load areas"
          message={resource.error.message}
          action={
            <Button variant="outline" onClick={() => void resource.refresh()}>
              Try again
            </Button>
          }
        />
      ) : orderedAreas.length ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void reorderAreas(event)}
        >
          <div className="flex flex-col gap-5">
            {renderedGroups.map((group) => (
              <section key={group.id} aria-label={group.name || 'Areas'}>
                {group.name ? (
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </h2>
                ) : null}
                <SortableContext
                  items={group.areas.map((area) => area.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul
                    className={cn(
                      'border-border',
                      preferences.density === 'cards'
                        ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                        : 'divide-y rounded-xl border',
                      preferences.density === 'compact' && 'divide-y-0',
                    )}
                  >
                    {group.areas.map((area) => (
                      <AreaRow
                        key={area.id}
                        area={area}
                        density={preferences.density}
                        details={preferences.details}
                        canReorder={preferences.sort === 'manual'}
                        onPin={() => void togglePin(area)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </section>
            ))}
          </div>
        </DndContext>
      ) : (
        <EmptyState
          icon={Compass}
          title="No areas yet"
          message="Start a calm space for something you want to keep tending."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              Create your first area
            </Button>
          }
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New area"
      >
        <DialogHeader
          title="New area"
          description="Choose a starting template. Every part can be changed later."
        />
        <DialogBody className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {templates.map((option) => {
              const Icon = option.icon
              const selected = startFrom === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setStartFrom(option.id)
                    setName((current) => current || option.name)
                  }}
                  className={cn(
                    'flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium">{option.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          {startFrom ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Area name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </label>
          ) : null}
          {createError ? (
            <p role="alert" className="text-sm text-destructive">
              {createError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!startFrom || !name.trim() || creating}
            onClick={() => void createArea()}
          >
            {creating ? 'Creating' : 'Create area'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}

function detailLabel(key: keyof AreasListPreferences['details']) {
  return {
    description: 'Description',
    collectionCount: 'Collection count',
    itemCount: 'Item count',
    lastActive: 'Last active',
  }[key]
}

function AreaRow({
  area,
  density,
  details,
  canReorder,
  onPin,
}: {
  area: Area
  density: AreasListPreferences['density']
  details: AreasListPreferences['details']
  canReorder: boolean
  onPin: () => void
}) {
  const sortable = useSortable({ id: area.id, disabled: !canReorder })
  const style = {
    transform: sortable.transform
      ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0) scaleX(${sortable.transform.scaleX}) scaleY(${sortable.transform.scaleY})`
      : undefined,
    transition: sortable.transition,
  }
  const compact = density === 'compact'
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'group min-w-0',
        density === 'cards' ? 'rounded-xl border bg-card' : 'border-border',
        compact && 'rounded-lg border',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 items-center gap-3',
          compact ? 'px-3 py-2' : density === 'cards' ? 'p-4' : 'px-4 py-3',
        )}
      >
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reorder ${area.name}`}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground opacity-50 hover:bg-muted hover:opacity-100 focus-visible:opacity-100"
        >
          ⋮⋮
        </button>
        <Link
          to={`/area/${area.id}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AreaIcon name={area.icon} className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {area.name}
            </span>
            {details.description && area.description ? (
              <span className="block truncate text-xs text-muted-foreground">
                {area.description}
              </span>
            ) : null}
            {details.collectionCount ||
            details.itemCount ||
            details.lastActive ? (
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {details.collectionCount ? (
                  <span>
                    {area.collectionIds.length}{' '}
                    {area.collectionIds.length === 1
                      ? 'collection'
                      : 'collections'}
                  </span>
                ) : null}
                {details.itemCount ? (
                  <span>
                    {area.itemCount.toLocaleString()}{' '}
                    {area.itemCount === 1 ? 'item' : 'items'}
                  </span>
                ) : null}
                {details.lastActive ? (
                  <span>Active {relativeDate(area.lastActiveAt)}</span>
                ) : null}
              </span>
            ) : null}
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${area.pinned ? 'Unpin' : 'Pin'} ${area.name}`}
          onClick={onPin}
          className="opacity-50 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Pin
            className={cn('size-4', area.pinned && 'fill-current text-primary')}
          />
        </Button>
      </div>
    </li>
  )
}

function relativeDate(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  )
  if (!Number.isFinite(days) || days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
