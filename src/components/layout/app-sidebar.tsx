/* eslint-disable react-hooks/refs */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Compass,
  GripVertical,
  Plus,
  X,
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
import type { Area, AreaGroup, Status } from '@/services/api'
import {
  areaLayoutApi,
  areasApi,
  savedFiltersApi,
  STATUSES,
} from '@/services/api'
import type { ProjectFilterState, SavedProjectFilter } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AreaIcon } from '@/components/areas/area-icon'
import { useStore } from '@/use-store'

const sorts: ProjectFilterState['sort'][] = [
  'updated',
  'opportunity',
  'excitement',
  'effort',
  'target',
  'name',
]
const emptyAreas: Area[] = []
function projectHref(filter: ProjectFilterState) {
  const query = new URLSearchParams()
  if (filter.status !== 'all') query.set('status', filter.status)
  if (filter.tag) query.set('tag', filter.tag)
  if (filter.q) query.set('q', filter.q)
  if (filter.sort !== 'updated') query.set('sort', filter.sort)
  return query.size ? `/?${query}` : '/'
}

export function AppSidebar({
  open = true,
  mobile = false,
  onClose,
}: {
  open?: boolean
  mobile?: boolean
  onClose?: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
  } = useStore()
  const loadAreas = useCallback(() => areasApi.listAreas(), [])
  const loadSaved = useCallback(() => savedFiltersApi.list(), [])
  const loadGroups = useCallback(() => areaLayoutApi.listGroups(), [])
  const areasState = useApiResource<Area[]>(loadAreas, 'areas')
  const savedState = useApiResource<SavedProjectFilter[]>(
    loadSaved,
    'saved-filters',
  )
  const groupsState = useApiResource<AreaGroup[]>(loadGroups, 'area-groups')
  const { setData: setSavedFilters } = savedState
  const refreshAreasData = areasState.refresh
  useEffect(() => {
    const refreshSavedFilters = () => {
      void savedFiltersApi.list().then((filters) => setSavedFilters(filters))
    }
    const refreshAreas = () => void refreshAreasData()
    window.addEventListener('hub:saved-filters-changed', refreshSavedFilters)
    window.addEventListener('hub:areas-changed', refreshAreas)
    return () => {
      window.removeEventListener(
        'hub:saved-filters-changed',
        refreshSavedFilters,
      )
      window.removeEventListener('hub:areas-changed', refreshAreas)
    }
  }, [refreshAreasData, setSavedFilters])
  const areas = areasState.data ?? emptyAreas
  const saved = savedState.data ?? []
  const groups = groupsState.data ?? []
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const params = new URLSearchParams(location.search)
  const rawStatus = params.get('status')
  const status = (STATUSES as readonly string[]).includes(rawStatus ?? '')
    ? (rawStatus as Status)
    : 'all'
  const current: ProjectFilterState = {
    status,
    tag: params.get('tag'),
    q: params.get('q') ?? '',
    sort: sorts.includes(params.get('sort') as ProjectFilterState['sort'])
      ? (params.get('sort') as ProjectFilterState['sort'])
      : 'updated',
  }
  const orderedAreas = useMemo(
    () =>
      [...areas].sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          (a.order ?? 0) - (b.order ?? 0),
      ),
    [areas],
  )
  if (!open && !mobile) return null

  async function saveFilter() {
    const name = window.prompt('Name this filter')?.trim()
    if (name) {
      const filter = await savedFiltersApi.create({ ...current, name })
      savedState.setData((previous) => [...(previous ?? []), filter])
    }
  }
  async function renameFilter(filter: SavedProjectFilter) {
    const name = window.prompt('Rename saved filter', filter.name)?.trim()
    if (!name) return
    const updated = await savedFiltersApi.update(filter.id, { name })
    if (updated)
      savedState.setData((previous) =>
        (previous ?? []).map((item) =>
          item.id === filter.id ? updated : item,
        ),
      )
  }
  async function deleteFilter(id: string) {
    await savedFiltersApi.remove(id)
    savedState.setData((previous) =>
      (previous ?? [])
        .filter((item) => item.id !== id)
        .map((item, order) => ({ ...item, order })),
    )
  }
  async function reorderSaved(id: string, delta: number) {
    const next = [...saved].sort((a, b) => a.order - b.order)
    const index = next.findIndex((item) => item.id === id)
    const target = Math.max(0, Math.min(next.length - 1, index + delta))
    ;[next[index], next[target]] = [next[target], next[index]]
    await savedFiltersApi.reorder(next.map((item) => item.id))
    savedState.setData(next.map((item, order) => ({ ...item, order })))
  }
  async function updateArea(area: Area, patch: Partial<Area>) {
    const updated = await areaLayoutApi.updateArea(area.id, patch)
    areasState.setData((previous) =>
      (previous ?? []).map((item) => (item.id === area.id ? updated : item)),
    )
  }
  async function renameArea(area: Area) {
    const name = window.prompt('Rename area', area.name)?.trim()
    if (name && name !== area.name) await updateArea(area, { name })
  }
  async function deleteArea(area: Area) {
    if (!window.confirm(`Delete “${area.name}”? This cannot be undone.`)) return
    await areasApi.removeArea(area.id)
    areasState.setData((previous) =>
      (previous ?? []).filter((item) => item.id !== area.id),
    )
  }
  async function reorderAreas(next: Area[]) {
    await areaLayoutApi.reorderAreas(next.map((item) => item.id))
    areasState.setData(next.map((item, order) => ({ ...item, order })))
  }
  async function shiftArea(index: number, delta: number) {
    const next = [...orderedAreas]
    const target = Math.max(0, Math.min(next.length - 1, index + delta))
    ;[next[index], next[target]] = [next[target], next[index]]
    await reorderAreas(next)
  }
  async function createGroup() {
    const name = window.prompt('Area group name')?.trim()
    if (!name) return
    const group = await areaLayoutApi.createGroup(name)
    groupsState.setData((previous) => [...(previous ?? []), group])
  }
  async function updateGroup(group: AreaGroup, patch: Partial<AreaGroup>) {
    const updated = await areaLayoutApi.updateGroup({ ...group, ...patch })
    groupsState.setData((previous) =>
      (previous ?? []).map((item) => (item.id === group.id ? updated : item)),
    )
  }
  async function renameGroup(group: AreaGroup) {
    const name = window.prompt('Rename group', group.name)?.trim()
    if (name) await updateGroup(group, { name })
  }
  async function deleteGroup(group: AreaGroup) {
    await areaLayoutApi.removeGroup(group.id)
    groupsState.setData((previous) =>
      (previous ?? []).filter((item) => item.id !== group.id),
    )
    areasState.setData((previous) =>
      (previous ?? []).map((area) =>
        area.groupId === group.id ? { ...area, groupId: null } : area,
      ),
    )
  }
  async function reorderGroup(group: AreaGroup, delta: number) {
    const next = [...groups].sort((a, b) => a.order - b.order)
    const index = next.findIndex((item) => item.id === group.id)
    const target = Math.max(0, Math.min(next.length - 1, index + delta))
    ;[next[index], next[target]] = [next[target], next[index]]
    await areaLayoutApi.reorderGroups(next.map((item) => item.id))
    groupsState.setData(next.map((item, order) => ({ ...item, order })))
  }
  async function handleAreaDrag(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return
    const activeId = String(event.active.id)
    const overId = String(event.over.id)
    const [activeType, activeKey] = [
      activeId.slice(0, activeId.indexOf(':')),
      activeId.slice(activeId.indexOf(':') + 1),
    ]
    const [overType, overKey] = [
      overId.slice(0, overId.indexOf(':')),
      overId.slice(overId.indexOf(':') + 1),
    ]
    if (activeType === 'group' && overType === 'group') {
      const next = [...groups].sort((a, b) => a.order - b.order)
      const from = next.findIndex((group) => group.id === activeKey)
      const to = next.findIndex((group) => group.id === overKey)
      if (from < 0 || to < 0) return
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      await areaLayoutApi.reorderGroups(next.map((group) => group.id))
      groupsState.setData(next.map((group, order) => ({ ...group, order })))
      return
    }
    if (activeType !== 'area') return
    const moved = areas.find((area) => area.id === activeKey)
    if (!moved) return
    if (overType === 'group') {
      await updateArea(moved, { groupId: overKey })
      return
    }
    if (overType !== 'area') return
    const targetArea = areas.find((area) => area.id === overKey)
    if (!targetArea) return
    const next = [...orderedAreas]
    const from = next.findIndex((area) => area.id === activeKey)
    const to = next.findIndex((area) => area.id === overKey)
    if (from < 0 || to < 0) return
    const [dragged] = next.splice(from, 1)
    next.splice(to, 0, { ...dragged, groupId: targetArea.groupId })
    await areaLayoutApi.updateArea(moved.id, { groupId: targetArea.groupId })
    await reorderAreas(next)
  }
  const statusFor = (item: Status) =>
    projects.filter((project) => project.status === item).length
  const currentHref = location.pathname === '/' ? projectHref(current) : ''

  return (
    <>
      {mobile ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={onClose}
        />
      ) : null}
      <aside
        aria-label="Sidebar navigation"
        className={
          mobile
            ? 'fixed inset-y-0 left-0 z-50 flex h-dvh w-[252px] flex-col border-r border-border bg-sidebar text-sidebar-foreground shadow-xl'
            : 'sticky top-14 flex h-[calc(100dvh-3.5rem)] w-[252px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground'
        }
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </span>
          {mobile ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              onClick={onClose}
            >
              <X />
            </Button>
          ) : null}
        </div>
        <nav
          aria-label="Workspace"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-6"
        >
          <Section
            title="Projects"
            collapsed={collapsed.Projects}
            onToggle={() =>
              setCollapsed((value) => ({ ...value, Projects: !value.Projects }))
            }
          >
            {projectsLoading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Loading projects
              </p>
            ) : projectsError ? (
              <p role="alert" className="px-2 py-2 text-xs text-destructive">
                Could not load project counts
              </p>
            ) : (
              <>
                <NavLine
                  href="/"
                  label="All projects"
                  count={projects.length}
                  active={
                    location.pathname === '/' &&
                    !params.has('status') &&
                    !params.has('tag') &&
                    !params.has('q') &&
                    !params.has('sort')
                  }
                  onClick={onClose}
                />
                {STATUSES.map((item) => (
                  <NavLine
                    key={item}
                    href={projectHref({
                      status: item,
                      tag: null,
                      q: '',
                      sort: 'updated',
                    })}
                    label={item}
                    count={statusFor(item)}
                    active={
                      currentHref ===
                      projectHref({
                        status: item,
                        tag: null,
                        q: '',
                        sort: 'updated',
                      })
                    }
                    onClick={onClose}
                  />
                ))}
              </>
            )}
          </Section>
          <Section
            title="Saved filters"
            collapsed={collapsed.Saved}
            onToggle={() =>
              setCollapsed((value) => ({ ...value, Saved: !value.Saved }))
            }
            action={
              <button
                type="button"
                aria-label="Save current filter"
                title="Save current filter"
                onClick={() => void saveFilter()}
                className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent"
              >
                <Plus className="size-3.5" />
              </button>
            }
          >
            {savedState.loading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Loading saved filters
              </p>
            ) : savedState.error ? (
              <p role="alert" className="px-2 py-2 text-xs text-destructive">
                Could not load saved filters
              </p>
            ) : saved.length ? (
              saved.map((filter) => (
                <div key={filter.id} className="group flex items-center gap-1">
                  <Link
                    to={projectHref(filter)}
                    onClick={onClose}
                    className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    {filter.name}
                  </Link>
                  <div className="hidden group-hover:flex group-focus-within:flex">
                    <button
                      aria-label={`Move ${filter.name} up`}
                      onClick={() => void reorderSaved(filter.id, -1)}
                      className="px-1 text-xs"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`Move ${filter.name} down`}
                      onClick={() => void reorderSaved(filter.id, 1)}
                      className="px-1 text-xs"
                    >
                      ↓
                    </button>
                    <button
                      aria-label={`Rename ${filter.name}`}
                      onClick={() => void renameFilter(filter)}
                      className="px-1 text-xs"
                    >
                      ···
                    </button>
                    <button
                      aria-label={`Delete ${filter.name}`}
                      onClick={() => void deleteFilter(filter.id)}
                      className="px-1 text-xs"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No saved filters
              </p>
            )}
          </Section>
          <Section
            title="Areas"
            collapsed={collapsed.Areas}
            onToggle={() =>
              setCollapsed((value) => ({ ...value, Areas: !value.Areas }))
            }
            action={
              <div className="flex">
                <button
                  aria-label="Create area group"
                  title="Create group"
                  onClick={() => void createGroup()}
                  className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  aria-label="Create area"
                  title="Create area"
                  onClick={() => navigate('/areas')}
                  className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent"
                >
                  <Compass className="size-3.5" />
                </button>
              </div>
            }
          >
            {areasState.loading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Loading areas
              </p>
            ) : areasState.error ? (
              <p role="alert" className="px-2 py-2 text-xs text-destructive">
                Could not load areas
              </p>
            ) : null}
            {groupsState.loading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Loading area groups
              </p>
            ) : groupsState.error ? (
              <p role="alert" className="px-2 py-2 text-xs text-destructive">
                Could not load groups
              </p>
            ) : null}
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleAreaDrag(event)}
            >
              <SortableContext
                items={[
                  ...groups.map((group) => `group:${group.id}`),
                  ...orderedAreas.map((area) => `area:${area.id}`),
                ]}
                strategy={verticalListSortingStrategy}
              >
                {groups.map((group) => (
                  <SidebarGroup
                    key={group.id}
                    group={group}
                    onToggle={() =>
                      void updateGroup(group, { collapsed: !group.collapsed })
                    }
                    onMove={(delta) => void reorderGroup(group, delta)}
                    onRename={() => void renameGroup(group)}
                    onDelete={() => void deleteGroup(group)}
                  >
                    {!group.collapsed ? (
                      <SortableContext
                        items={orderedAreas
                          .filter((area) => area.groupId === group.id)
                          .map((area) => `area:${area.id}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        {orderedAreas
                          .filter((area) => area.groupId === group.id)
                          .map((area) => (
                            <AreaNav
                              key={area.id}
                              area={area}
                              groups={groups}
                              onClick={onClose}
                              onPin={() =>
                                void updateArea(area, { pinned: !area.pinned })
                              }
                              onMove={(delta) =>
                                void shiftArea(
                                  orderedAreas.indexOf(area),
                                  delta,
                                )
                              }
                              onGroupChange={(groupId) =>
                                void updateArea(area, {
                                  groupId: groupId || null,
                                })
                              }
                              onRename={() => void renameArea(area)}
                              onDelete={() => void deleteArea(area)}
                            />
                          ))}
                      </SortableContext>
                    ) : null}
                  </SidebarGroup>
                ))}
                <div className="mt-1 rounded-md">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ungrouped
                  </p>
                  <SortableContext
                    items={orderedAreas
                      .filter(
                        (area) =>
                          !area.groupId ||
                          !groups.some((group) => group.id === area.groupId),
                      )
                      .map((area) => `area:${area.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedAreas
                      .filter(
                        (area) =>
                          !area.groupId ||
                          !groups.some((group) => group.id === area.groupId),
                      )
                      .map((area) => (
                        <AreaNav
                          key={area.id}
                          area={area}
                          groups={groups}
                          onClick={onClose}
                          onPin={() =>
                            void updateArea(area, { pinned: !area.pinned })
                          }
                          onMove={(delta) =>
                            void shiftArea(orderedAreas.indexOf(area), delta)
                          }
                          onGroupChange={(groupId) =>
                            void updateArea(area, { groupId: groupId || null })
                          }
                          onRename={() => void renameArea(area)}
                          onDelete={() => void deleteArea(area)}
                        />
                      ))}
                  </SortableContext>
                </div>
              </SortableContext>
            </DndContext>
            {!areas.length && !areasState.loading && !areasState.error ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No areas yet
              </p>
            ) : null}
            <Link
              to="/areas"
              onClick={onClose}
              className="mt-1 block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent"
            >
              Manage areas
            </Link>
          </Section>
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground">
          Toggle with Ctrl or ⌘ + B
        </div>
      </aside>
    </>
  )
}

function SidebarGroup({
  group,
  onToggle,
  onMove,
  onRename,
  onDelete,
  children,
}: {
  group: AreaGroup
  onToggle: () => void
  onMove: (delta: number) => void
  onRename: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const sortable = useSortable({ id: `group:${group.id}` })
  const style = {
    transform: sortable.transform
      ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
      : undefined,
    transition: sortable.transition,
  }
  return (
    <section ref={sortable.setNodeRef} style={style} className="group mt-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reorder ${group.name}`}
          className="touch-none rounded p-1 text-muted-foreground opacity-40 hover:bg-sidebar-accent hover:opacity-100 focus-visible:opacity-100"
        >
          <GripVertical className="size-3" />
        </button>
        <button
          aria-expanded={!group.collapsed}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent"
        >
          {group.collapsed ? (
            <ChevronRight className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          {group.name}
        </button>
        <div className="hidden group-hover:flex group-focus-within:flex">
          <button
            aria-label={`Move ${group.name} up`}
            onClick={() => onMove(-1)}
            className="px-1 text-xs"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${group.name} down`}
            onClick={() => onMove(1)}
            className="px-1 text-xs"
          >
            ↓
          </button>
          <button
            aria-label={`Rename ${group.name}`}
            onClick={onRename}
            className="px-1 text-xs"
          >
            ···
          </button>
          <button
            aria-label={`Delete ${group.name}`}
            onClick={onDelete}
            className="px-1 text-xs"
          >
            ×
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

function AreaNav({
  area,
  groups,
  onClick,
  onPin,
  onMove,
  onGroupChange,
  onRename,
  onDelete,
}: {
  area: Area
  groups: AreaGroup[]
  onClick?: () => void
  onPin: () => void
  onMove: (delta: number) => void
  onGroupChange: (groupId: string) => void
  onRename: () => void
  onDelete: () => void
}) {
  const sortable = useSortable({ id: `area:${area.id}` })
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuOpensUp, setMenuOpensUp] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const style = {
    transform: sortable.transform
      ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
      : undefined,
    transition: sortable.transition,
  }

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [menuOpen])

  function action(callback: () => void) {
    setMenuOpen(false)
    callback()
  }

  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false)
      return
    }
    const bottom = triggerRef.current?.getBoundingClientRect().bottom ?? 0
    setMenuOpensUp(bottom + 300 > window.innerHeight)
    setMenuOpen(true)
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="group relative flex min-w-0 items-start gap-1"
    >
      <button
        type="button"
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={`Reorder ${area.name}`}
        className="touch-none rounded p-1 text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripVertical className="size-3" />
      </button>
      <Link
        to={`/area/${area.id}`}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        <AreaIcon name={area.icon} className="mt-0.5 size-3.5 shrink-0" />
        <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal break-words leading-4">
          {area.name}
        </span>
      </Link>
      <div ref={menuRef} className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Options for ${area.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={toggleMenu}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">···</span>
        </button>
        {menuOpen ? (
          <div
            aria-label={`${area.name} options`}
            className={cn(
              'absolute right-0 z-30 flex max-h-[calc(100dvh-2rem)] w-48 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto overscroll-contain rounded-lg border border-sidebar-border bg-sidebar p-1 shadow-lg',
              menuOpensUp ? 'bottom-full mb-1' : 'top-8',
            )}
          >
            <button
              className="rounded px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
              onClick={() => action(onRename)}
            >
              Rename
            </button>
            <button
              className="rounded px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
              onClick={() => action(onPin)}
            >
              {area.pinned ? 'Unpin' : 'Pin'}
            </button>
            <label className="flex flex-col gap-1 px-3 py-2 text-xs text-muted-foreground">
              Move to group
              <Select
                aria-label={`Move ${area.name} to group`}
                value={area.groupId ?? ''}
                onChange={(event) =>
                  action(() => onGroupChange(event.target.value))
                }
                className="h-8 w-full"
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </label>
            <button
              className="rounded px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
              onClick={() => action(() => onMove(-1))}
            >
              Move up
            </button>
            <button
              className="rounded px-3 py-2 text-left text-sm hover:bg-sidebar-accent"
              onClick={() => action(() => onMove(1))}
            >
              Move down
            </button>
            <button
              className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-sidebar-accent"
              onClick={() => action(onDelete)}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Section({
  title,
  collapsed,
  onToggle,
  action,
  children,
}: {
  title: string
  collapsed: boolean | undefined
  onToggle: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center px-2 py-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
          {title}
        </button>
        {action}
      </div>
      {!collapsed ? (
        <div className="flex flex-col gap-0.5">{children}</div>
      ) : null}
    </section>
  )
}
function NavLine({
  href,
  label,
  count,
  active,
  onClick,
}: {
  href: string
  label: string
  count: number
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
        active && 'bg-sidebar-accent font-medium text-sidebar-foreground',
      )}
    >
      <span>{label}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </Link>
  )
}
