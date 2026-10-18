/* eslint-disable react-hooks/refs */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare2,
  Columns3,
  FileText,
  GalleryHorizontal,
  Heading,
  Image,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Rows3,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
  AreaPageSpec,
  AreaSection,
  Block,
  BlockSize,
  CollectionSchema,
  Item,
  ViewDisplay,
  ViewPeriod,
  ViewSpec,
} from '@/services/api'
import {
  areaLayoutApi,
  areasApi,
  blocksApi,
  collectionsApi,
} from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { ViewRenderer } from '@/components/areas/view-renderer'
import { AreaIcon, areaIconOptions } from '@/components/areas/area-icon'
import { InlineAreaField } from '@/components/areas/inline-area-field'
import { cn } from '@/lib/utils'

interface AreaScreenData {
  area: Area | null
  pages: AreaPageSpec[]
  sections: AreaSection[]
  blocks: Block[]
  collections: CollectionSchema[]
  items: Item[]
}

const loadArea = async (areaId: string): Promise<AreaScreenData> => {
  const [area, pages, collections, blocks] = await Promise.all([
    areasApi.getArea(areaId),
    areaLayoutApi.listPages(areaId),
    collectionsApi.listCollections(areaId),
    blocksApi.listBlocks(areaId),
  ])
  const [sections, itemLists] = await Promise.all([
    Promise.all(pages.map((page) => areaLayoutApi.listSections(page.id))),
    Promise.all(
      collections.map((collection) =>
        collectionsApi.listCollectionItems(collection.id),
      ),
    ),
  ])
  return {
    area,
    pages,
    sections: sections.flat(),
    blocks,
    collections,
    items: itemLists.flat(),
  }
}

const periodLabels: Record<ViewPeriod, string> = {
  thisMonth: 'This month',
  last30Days: 'Last 30 days',
  '12Months': '12 months',
  allTime: 'All time',
}
const displayOptions: Array<[ViewDisplay, string]> = [
  ['stat', 'Number'],
  ['line', 'Line chart'],
  ['bar', 'Bar chart'],
  ['donut', 'Donut chart'],
  ['table', 'Table'],
  ['gallery', 'Gallery'],
  ['cards', 'Cards'],
  ['timeline', 'Timeline'],
  ['board', 'Board'],
  ['calendar', 'Calendar'],
  ['list', 'List'],
]
const operationOptions = [
  ['sum', 'Sum'],
  ['average', 'Average'],
  ['count', 'Count'],
  ['min', 'Lowest'],
  ['max', 'Highest'],
  ['latest', 'Latest'],
] as const
const blockOptions = [
  {
    key: 'text',
    label: 'Text',
    description: 'Add a thought, note, or longer passage.',
    icon: FileText,
  },
  {
    key: 'heading',
    label: 'Heading',
    description: 'Give a section a clear point of focus.',
    icon: Heading,
  },
  {
    key: 'list',
    label: 'List',
    description: 'Keep a few related ideas together.',
    icon: List,
  },
  {
    key: 'checklist',
    label: 'Checklist',
    description: 'Track steps as you complete them.',
    icon: CheckSquare2,
  },
  {
    key: 'image',
    label: 'Image',
    description: 'Keep a visual reference close by.',
    icon: Image,
  },
  {
    key: 'divider',
    label: 'Divider',
    description: 'Add a little breathing room.',
    icon: Rows3,
  },
  {
    key: 'callout',
    label: 'Callout',
    description: 'Set an important note apart.',
    icon: Sparkles,
  },
  {
    key: 'chart',
    label: 'Chart',
    description: 'Notice changes and patterns over time.',
    icon: BarChart3,
  },
  {
    key: 'number',
    label: 'Number',
    description: 'Keep one useful measure in view.',
    icon: Activity,
  },
  {
    key: 'table',
    label: 'Table',
    description: 'See structured entries at a glance.',
    icon: Table2,
  },
  {
    key: 'gallery',
    label: 'Gallery',
    description: 'Browse entries as a visual collection.',
    icon: GalleryHorizontal,
  },
  {
    key: 'cards',
    label: 'Cards',
    description: 'Give each entry a little more room.',
    icon: LayoutGrid,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    description: 'See events in their order.',
    icon: Rows3,
  },
  {
    key: 'board',
    label: 'Board',
    description: 'Group work into flexible columns.',
    icon: Columns3,
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Place entries on their dates.',
    icon: CalendarDays,
  },
  {
    key: 'linkedItems',
    label: 'Linked items',
    description: 'Connect related entries from a collection.',
    icon: LinkIcon,
  },
  {
    key: 'embeddedPage',
    label: 'Embedded page',
    description: 'Bring another area page into this space.',
    icon: BookOpen,
  },
] as const

export function AreaPage({ onCapture }: { onCapture: () => void }) {
  const { areaId = '' } = useParams()
  const location = useLocation()
  const [initialRename, setInitialRename] = useState(
    Boolean((location.state as { editName?: boolean } | null)?.editName),
  )
  const loader = useCallback(() => loadArea(areaId), [areaId])
  const resource = useApiResource(loader, areaId)
  const data = resource.data
  const { refresh: refreshAreaData } = resource
  const [pageId, setPageId] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const [settingsBlock, setSettingsBlock] = useState<string | null>(null)
  const [areaSettingsOpen, setAreaSettingsOpen] = useState(false)
  const [pageMenu, setPageMenu] = useState<string | null>(null)
  const [blockMenu, setBlockMenu] = useState<string | null>(null)
  const pageMenuRef = useRef<HTMLDivElement>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ afterId?: string; sectionId?: string } | null>(null)
  const [saveError, setSaveError] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const page = data?.pages.find((item) => item.id === pageId) ?? data?.pages[0]
  const sections = useMemo(
    () =>
      (data?.sections ?? [])
        .filter((section) => section.pageId === page?.id)
        .sort((a, b) => a.order - b.order),
    [data?.sections, page?.id],
  )
  const visibleBlocks = useMemo(
    () =>
      (data?.blocks ?? []).filter(
        (block) =>
          !block.sectionId ||
          sections.some((section) => section.id === block.sectionId),
      ),
    [data?.blocks, sections],
  )

  useEffect(() => {
    const refreshArea = () => void refreshAreaData()
    window.addEventListener('hub:area-items-changed', refreshArea)
    return () =>
      window.removeEventListener('hub:area-items-changed', refreshArea)
  }, [refreshAreaData])

  useEffect(() => {
    if (!pageMenu) return
    const dismiss = (event: PointerEvent) => {
      if (!pageMenuRef.current?.contains(event.target as Node)) setPageMenu(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPageMenu(null)
    }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [pageMenu])

  async function saveBlock(block: Block) {
    await blocksApi.saveBlock(block)
    await resource.refresh()
  }

  async function reorderBlocks(event: DragEndEvent) {
    if (!data || !event.over || event.active.id === event.over.id) return
    const active = data.blocks.find((block) => block.id === event.active.id)
    if (!active) return
    const over = data.blocks.find((block) => block.id === event.over?.id)
    const sourceSectionId = active.sectionId ?? sections[0]?.id
    const destinationSectionId =
      over?.sectionId ??
      (sections.some((section) => section.id === event.over?.id)
        ? String(event.over.id)
        : sections[0]?.id)
    if (!sourceSectionId || !destinationSectionId) return
    const source = sectionBlocks({
      ...sections.find((section) => section.id === sourceSectionId)!,
      id: sourceSectionId,
    })
    const destination =
      sourceSectionId === destinationSectionId
        ? source
        : sectionBlocks({
            ...sections.find((section) => section.id === destinationSectionId)!,
            id: destinationSectionId,
          })
    const movedSource = source.filter((block) => block.id !== active.id)
    const nextDestination =
      sourceSectionId === destinationSectionId ? movedSource : [...destination]
    const targetIndex = over
      ? nextDestination.findIndex((block) => block.id === over.id)
      : nextDestination.length
    nextDestination.splice(
      targetIndex < 0 ? nextDestination.length : targetIndex,
      0,
      { ...active, sectionId: destinationSectionId },
    )
    if (sourceSectionId !== destinationSectionId) {
      for (const [order, block] of movedSource.entries())
        await blocksApi.saveBlock({ ...block, order })
      await blocksApi.saveBlockOrder(
        areaId,
        movedSource.map((block) => block.id),
      )
    }
    for (const [order, block] of nextDestination.entries())
      await blocksApi.saveBlock({
        ...block,
        sectionId: destinationSectionId,
        order,
      })
    await blocksApi.saveBlockOrder(
      areaId,
      nextDestination.map((block) => block.id),
    )
    await resource.refresh()
  }

  function sectionBlocks(section: AreaSection) {
    return visibleBlocks
      .filter((block) => (block.sectionId ?? sections[0]?.id) === section.id)
      .sort((a, b) => a.order - b.order)
  }

  async function addSection() {
    if (!page) return
    await areaLayoutApi.createSection(areaId, page.id)
    await resource.refresh()
  }

  async function updateSection(
    section: AreaSection,
    patch: Partial<AreaSection>,
  ) {
    await areaLayoutApi.updateSection({ ...section, ...patch })
    await resource.refresh()
  }

  async function removeSection(section: AreaSection) {
    await areaLayoutApi.removeSection(section.id)
    await resource.refresh()
  }

  async function addPage() {
    const name = window.prompt('Page name')?.trim()
    if (!name) return
    const created = await areaLayoutApi.createPage(areaId, name)
    await areaLayoutApi.createSection(areaId, created.id)
    await resource.refresh()
    setPageId(created.id)
  }

  async function renamePage(current: AreaPageSpec) {
    const name = window.prompt('Rename page', current.name)?.trim()
    if (name) {
      await areaLayoutApi.updatePage({ ...current, name })
      setPageMenu(null)
      await resource.refresh()
    }
  }

  async function movePage(current: AreaPageSpec, delta: number) {
    if (!data) return
    const ordered = [...data.pages].sort((left, right) => left.order - right.order)
    const index = ordered.findIndex((item) => item.id === current.id)
    const target = index + delta
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    await areaLayoutApi.reorderPages(areaId, ordered.map((item) => item.id))
    setPageMenu(null)
    await resource.refresh()
  }

  async function deletePage(current: AreaPageSpec) {
    if (!data || data.pages.length < 2) return
    if (!window.confirm(`Delete the page “${current.name}”? This cannot be undone.`)) return
    await areaLayoutApi.removePage(areaId, current.id)
    setPageMenu(null)
    setPageId(data.pages.find((item) => item.id !== current.id)?.id ?? '')
    await resource.refresh()
  }

  async function moveSection(current: AreaSection, delta: number) {
    const ordered = [...sections]
    const index = ordered.findIndex((item) => item.id === current.id)
    const target = Math.max(0, Math.min(ordered.length - 1, index + delta))
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    await areaLayoutApi.reorderSections(
      current.pageId,
      ordered.map((item) => item.id),
    )
    await resource.refresh()
  }

  async function addBlock(
    type: (typeof blockOptions)[number]['key'],
    section: AreaSection,
    afterId?: string,
  ) {
    const id = `block-${crypto.randomUUID()}`
    const base = {
      id,
      areaId,
      sectionId: section.id,
      order: 0,
      size: 'medium' as const,
    }
    let block: Block
    if (type === 'text')
      block = { ...base, type, title: 'Text', body: 'Write something here.' }
    else if (type === 'heading')
      block = { ...base, type, title: 'Heading', body: 'A heading' }
    else if (type === 'list')
      block = { ...base, type, title: 'List', items: ['First item'] }
    else if (type === 'checklist')
      block = {
        ...base,
        type,
        title: 'Checklist',
        items: [{ text: 'First step', checked: false }],
      }
    else if (type === 'divider') block = { ...base, type }
    else if (type === 'callout')
      block = { ...base, type, title: 'Note', body: 'A useful note.' }
    else if (type === 'image')
      block = { ...base, type, title: 'Image', imageUrl: '', caption: '' }
    else if (type === 'linkedItems')
      block = { ...base, type, title: 'Linked items', itemIds: [] }
    else if (type === 'embeddedPage') {
      const target = data?.pages.find((item) => item.id !== page?.id)
      if (!target) return
      block = { ...base, type, title: target.name, pageId: target.id }
    } else {
      const collection = data?.collections[0]
      if (!collection) return
      const display: ViewDisplay =
        type === 'chart' ? 'line' : type === 'number' ? 'stat' : type
      const title =
        blockOptions.find((option) => option.key === type)?.label ?? 'View'
      block = {
        ...base,
        type: 'view',
        title,
        view: {
          id,
          title,
          collectionId: collection.id,
          display,
          filter: [],
          period: 'allTime',
          groupBy: display === 'line' ? 'month' : undefined,
        },
      }
    }
    const existing = sectionBlocks(section)
    const insertionIndex = afterId
      ? existing.findIndex((item) => item.id === afterId) + 1
      : existing.length
    const ordered = [...existing]
    ordered.splice(Math.max(0, insertionIndex), 0, block)
    for (const [order, item] of ordered.entries())
      await blocksApi.saveBlock({ ...item, sectionId: section.id, order })
    await blocksApi.saveBlockOrder(
      areaId,
      ordered.map((item) => item.id),
    )
    setPicker(null)
    await resource.refresh()
  }

  async function duplicateBlock(block: Block) {
    const section =
      sections.find((item) => item.id === block.sectionId) ?? sections[0]
    if (!section) return
    await addBlockFromDuplicate(block, section)
  }

  async function addBlockFromDuplicate(block: Block, section: AreaSection) {
    const existing = sectionBlocks(section)
    const index = existing.findIndex((item) => item.id === block.id)
    const copy = {
      ...structuredClone(block),
      id: `block-${crypto.randomUUID()}`,
      sectionId: section.id,
      order: index + 1,
    } as Block
    const ordered = [...existing]
    ordered.splice(index + 1, 0, copy)
    for (const [order, item] of ordered.entries())
      await blocksApi.saveBlock({ ...item, sectionId: section.id, order })
    await blocksApi.saveBlockOrder(
      areaId,
      ordered.map((item) => item.id),
    )
    await resource.refresh()
  }

  async function deleteBlock(block: Block) {
    await blocksApi.removeBlock(block.id)
    await resource.refresh()
  }

  async function moveBlock(block: Block, delta: number) {
    const section =
      sections.find((item) => item.id === block.sectionId) ?? sections[0]
    if (!section) return
    const ordered = sectionBlocks(section)
    const index = ordered.findIndex((item) => item.id === block.id)
    const target = Math.max(0, Math.min(ordered.length - 1, index + delta))
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    for (const [order, item] of ordered.entries())
      await blocksApi.saveBlock({ ...item, sectionId: section.id, order })
    await blocksApi.saveBlockOrder(
      areaId,
      ordered.map((item) => item.id),
    )
    await resource.refresh()
  }

  async function saveArea(patch: Partial<Area>) {
    if (!data?.area) return
    try {
      const updated = await areaLayoutApi.updateArea(areaId, patch)
      resource.setData((previous) =>
        previous ? { ...previous, area: updated } : previous,
      )
      window.dispatchEvent(new Event('hub:areas-changed'))
      setSaveError('')
    } catch {
      setSaveError('Could not save area settings. Try again.')
    }
  }

  function openBlockSettings(id: string) {
    setSettingsBlock(id)
  }

  function closeSettings() {
    const id = settingsBlock
    setSettingsBlock(null)
    if (id)
      requestAnimationFrame(() =>
        document.getElementById(`block-${id}`)?.focus(),
      )
  }

  if (resource.loading)
    return (
      <div aria-label="Loading area" className="grid gap-4">
        <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
        <div className="h-44 animate-pulse rounded-xl border border-border bg-muted/40" />
      </div>
    )
  if (resource.error)
    return (
      <EmptyState
        icon={Archive}
        variant="page"
        tone="danger"
        title="Could not load this area"
        message={resource.error.message}
        action={
          <Button variant="outline" onClick={() => void resource.refresh()}>
            Try again
          </Button>
        }
      />
    )
  if (!data?.area)
    return (
      <EmptyState
        icon={Archive}
        variant="page"
        title="Area not found"
        message="This space may have been removed."
      />
    )
  const area = data.area

  return (
    <div className="mx-auto max-w-5xl pt-3">
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <AreaIcon name={area.icon} className="size-5 shrink-0 text-primary" />
            <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              <InlineAreaField
                value={area.name}
                label="Area name"
                as="input"
                initialEditing={initialRename}
                className="min-w-0 w-full text-2xl font-semibold tracking-tight sm:text-3xl"
                onSave={async (name) => {
                  await saveArea({ name })
                  setInitialRename(false)
                }}
              />
            </h1>
          </div>
          <InlineAreaField
            value={area.description}
            label="Area description"
            as="textarea"
            className="max-w-2xl text-sm text-muted-foreground"
            onSave={(description) => saveArea({ description })}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {customizing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAreaSettingsOpen(true)}
            >
              Area settings
            </Button>
          ) : null}
          <Button
            variant={customizing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCustomizing((value) => !value)}
          >
            {customizing ? 'Done' : 'Customize'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCapture}>
            Quick capture
          </Button>
        </div>
      </header>
      {saveError ? (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
      {data.pages.length ? (
        <nav
          className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border"
          aria-label={`${area.name} pages`}
        >
          {[...data.pages]
            .sort((left, right) => left.order - right.order)
            .map((item, index) => {
              const isActive = page?.id === item.id
              const showMenu = customizing || isActive
              return (
                <div key={item.id} className="relative flex shrink-0 items-center gap-1">
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setPageId(item.id)}
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
                  >
                    {item.name}
                  </button>
                  {showMenu ? (
                    <div ref={pageMenu === item.id ? pageMenuRef : undefined} className="relative">
                      <button
                        type="button"
                        aria-label={`Options for ${item.name}`}
                        aria-expanded={pageMenu === item.id}
                        onClick={() => {
                          setPicker(null)
                          setBlockMenu(null)
                          setPageMenu((current) => current === item.id ? null : item.id)
                        }}
                        className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {pageMenu === item.id ? (
                        <div className="absolute right-0 top-8 z-30 flex w-44 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <button className="rounded px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => void renamePage(item)}>Rename</button>
                          <button disabled={index === 0} className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void movePage(item, -1)}>Move left</button>
                          <button disabled={index === data.pages.length - 1} className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void movePage(item, 1)}>Move right</button>
                          <button
                            disabled={data.pages.length < 2}
                            title={data.pages.length < 2 ? 'An area needs at least one page.' : undefined}
                            className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void deletePage(item)}
                          >Delete</button>
                          {data.pages.length < 2 ? <span className="px-3 pb-2 text-xs text-muted-foreground">Keep at least one page.</span> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          {customizing ? (
            <Button variant="ghost" size="sm" onClick={() => void addPage()}>
              <Plus />
              Add page
            </Button>
          ) : null}
        </nav>
      ) : null}
      {!sections.length ? (
        <EmptyState
          icon={Plus}
          title="A quiet place to begin"
          message="Add a section, collection, or view to shape this page."
          action={
            customizing ? (
              <Button onClick={() => void addSection()}>Add section</Button>
            ) : null
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void reorderBlocks(event)}
        >
          <div className="flex flex-col gap-5">
            {sections.map((section) => (
              <DropZone key={section.id} id={section.id} enabled={customizing}>
                {customizing ? (
                  <SectionMenu
                    section={section}
                    onUpdate={(patch) => void updateSection(section, patch)}
                    onMove={(delta) => void moveSection(section, delta)}
                    onDelete={() => void removeSection(section)}
                  />
                ) : (
                  <h2 className={cn('mb-3 text-sm font-semibold', !section.title && 'sr-only')}>
                    {section.title || 'Section'}
                  </h2>
                )}
                <SortableContext
                  items={sectionBlocks(section).map((block) => block.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className={
                      section.layout === 'grid'
                        ? `grid grid-cols-1 gap-4 ${section.columns === 2 ? 'md:grid-cols-2' : section.columns === 3 ? 'md:grid-cols-3' : section.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-1'}`
                        : 'flex flex-col gap-4'
                    }
                  >
                    {customizing && sectionBlocks(section).length === 0 ? (
                      <BlockPicker
                        open={picker?.sectionId === section.id}
                        onPick={(type) => void addBlock(type, section)}
                        onClose={() => setPicker(null)}
                        onOpenChange={(open) => {
                          setPageMenu(null)
                          setBlockMenu(null)
                          setPicker(open ? { sectionId: section.id } : null)
                        }}
                      />
                    ) : null}
                    {sectionBlocks(section).map((block) => (
                      <div key={block.id} className="min-w-0">
                        <SortableBlock
                          block={block}
                          data={data}
                          customizing={customizing}
                          menuOpen={blockMenu === block.id}
                          onMenuOpenChange={(open) => {
                            if (open) {
                              setPageMenu(null)
                              setPicker(null)
                            }
                            setBlockMenu(open ? block.id : null)
                          }}
                          selected={selectedBlock === block.id}
                          onSelect={() => setSelectedBlock(block.id)}
                          onSave={saveBlock}
                          onDelete={deleteBlock}
                          onDuplicate={duplicateBlock}
                          onMove={moveBlock}
                          onSettings={() => openBlockSettings(block.id)}
                          onOpenPicker={() => {
                            setPageMenu(null)
                            setBlockMenu(null)
                            setPicker({ afterId: block.id })
                          }}
                        />
                        {customizing ? (
                          <BlockPicker
                            open={picker?.afterId === block.id}
                            onPick={(type) =>
                              void addBlock(type, section, block.id)
                            }
                            onClose={() => setPicker(null)}
                            onOpenChange={(open) => {
                              setPageMenu(null)
                              setBlockMenu(null)
                              setPicker(open ? { afterId: block.id } : null)
                            }}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DropZone>
            ))}
          </div>
        </DndContext>
      )}
      {customizing ? (
        <Button
          variant="ghost"
          className="mt-5 text-muted-foreground"
          onClick={() => void addSection()}
        >
          <Plus />
          Add section
        </Button>
      ) : null}
      {customizing && areaSettingsOpen ? (
        <AreaSettings
          area={area}
          onClose={() => setAreaSettingsOpen(false)}
          onSave={saveArea}
        />
      ) : null}
      {customizing && settingsBlock ? (
        <BlockSettings
          block={data.blocks.find((item) => item.id === settingsBlock)}
          collections={data.collections}
          onClose={closeSettings}
          onSave={saveBlock}
        />
      ) : null}
    </div>
  )
}

function DropZone({
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
      className={cn(
        'min-w-0 rounded-lg',
        isOver && 'outline outline-2 outline-primary/40',
      )}
    >
      {children}
    </section>
  )
}

function BlockPicker({
  onPick,
  onClose,
  onOpenChange,
  open,
}: {
  onPick: (type: (typeof blockOptions)[number]['key']) => void
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  open?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const isOpen = open ?? internalOpen

  function setOpen(next: boolean) {
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
    if (!next) onClose?.()
  }

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
  }, [isOpen])

  return (
    <div ref={rootRef} className="group/picker relative flex min-h-5 items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Add a block"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className="mx-auto grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:text-foreground group-hover/picker:bg-muted group-hover/picker:text-foreground"
      >
        <Plus className="size-4" />
      </button>
      {isOpen ? (
        <div aria-label="Choose a block" className="absolute left-1/2 top-7 z-30 grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-1 gap-1 rounded-xl border border-border bg-popover p-2 shadow-xl sm:grid-cols-2">
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

function SectionMenu({
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
      <h2 className="text-sm font-medium text-muted-foreground">
        {section.title || 'Section'}
      </h2>
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
              onBlur={(event) =>
                event.currentTarget.value !== section.title &&
                onUpdate({ title: event.currentTarget.value })
              }
              className="h-8 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Layout
            <Select
              aria-label="Section layout"
              value={section.layout}
              onChange={(event) =>
                onUpdate({
                  layout: event.target.value as AreaSection['layout'],
                })
              }
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
                onChange={(event) =>
                  onUpdate({
                    columns: Number(
                      event.target.value,
                    ) as AreaSection['columns'],
                  })
                }
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count} columns
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => onMove(-1)}>
              <ArrowUp />
              Move up
            </Button>
            <Button variant="outline" size="sm" onClick={() => onMove(1)}>
              <ArrowDown />
              Move down
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
            Delete section
          </Button>
        </div>
      </details>
    </header>
  )
}

function SortableBlock({
  block,
  data,
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
  const view = block.type === 'view' ? block.view : null
  const collection = view
    ? data.collections.find((item) => item.id === view.collectionId)
    : block.type === 'collection'
      ? data.collections.find((item) => item.id === block.collectionId)
      : null
  const items = collection
    ? data.items.filter((item) => item.collectionId === collection.id)
    : []
  const title =
    block.type === 'view' ? block.view.title : (block.title ?? block.type)

  return (
    <div
      id={`block-${block.id}`}
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        'group/block relative min-w-0 rounded-lg',
        customizing && selected && 'outline outline-1 outline-primary/30',
      )}
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
          className="absolute -left-2 top-1/2 z-10 grid size-6 -translate-x-full -translate-y-1/2 touch-none place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted focus-visible:opacity-100 group-hover/block:opacity-100"
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      ) : null}
      {customizing ? (
        <div ref={menuRef} className="absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover/block:opacity-100 focus-within:opacity-100">
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
              <button
                className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMenuOpenChange(false)
                  onSettings()
                }}
              >
                Settings
              </button>
              <button
                className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMenuOpenChange(false)
                  void onDuplicate(block)
                }}
              >
                Duplicate
              </button>
              <label className="flex flex-col gap-1 px-3 py-2 text-xs text-muted-foreground">
                Size
                <Select
                  aria-label={`Size ${title}`}
                  value={block.size ?? 'medium'}
                  onChange={(event) =>
                    void onSave({
                      ...block,
                      size: event.target.value as BlockSize,
                    })
                  }
                  className="h-8 text-sm text-foreground"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="wide">Wide</option>
                  <option value="tall">Tall</option>
                  <option value="full">Full</option>
                </Select>
              </label>
              <button
                className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMenuOpenChange(false)
                  void onMove(block, -1)
                }}
              >
                Move up
              </button>
              <button
                className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onMenuOpenChange(false)
                  void onMove(block, 1)
                }}
              >
                Move down
              </button>
              <button
                className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                onClick={() => {
                  onMenuOpenChange(false)
                  void onDelete(block)
                }}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          'min-w-0',
          block.size === 'wide' || block.size === 'full'
            ? 'md:col-span-full'
            : '',
          block.size === 'tall' && 'min-h-64',
        )}
      >
        {view && collection ? (
          <ViewRenderer
            spec={view}
            items={items}
            fields={collection.fields}
            onChangeSpec={(next) => {
              if (block.type === 'view') void onSave({ ...block, view: next })
            }}
          />
        ) : block.type === 'collection' && collection ? (
          <Link
            to={`/area/${collection.areaId}/collection/${collection.id}`}
            className="block rounded-xl border border-border p-4 hover:border-primary/40"
          >
            <h3 className="font-medium">{collection.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          </Link>
        ) : block.type === 'text' ||
          block.type === 'callout' ||
          block.type === 'heading' ? (
          <article
            className={
              block.type === 'callout'
                ? 'rounded-lg border-l-2 border-primary bg-muted/50 p-4'
                : 'rounded-lg border border-border/70 p-4'
            }
          >
            {block.title ? (
              <h3 className="mb-2 text-sm font-medium">{block.title}</h3>
            ) : null}
            {customizing ? (
              <Textarea
                aria-label={`Text in ${title}`}
                defaultValue={block.body}
                className="min-h-20 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onBlur={(event) =>
                  event.currentTarget.value !== block.body &&
                  void onSave({ ...block, body: event.currentTarget.value })
                }
                onKeyDown={(event) => {
                  if (
                    event.key === '/' &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  ) {
                    event.preventDefault()
                    onOpenPicker()
                  }
                }}
              />
            ) : block.type === 'heading' ? (
              <p className="text-lg font-semibold">{block.body}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {block.body}
              </p>
            )}
          </article>
        ) : block.type === 'list' || block.type === 'checklist' ? (
          <ul className="flex flex-col gap-2 rounded-lg border border-border p-4">
            {block.items.map((item, index) => (
              <li key={index} className="text-sm">
                {typeof item === 'string' ? (
                  item
                ) : (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.checked} readOnly />
                    {item.text}
                  </label>
                )}
              </li>
            ))}
          </ul>
        ) : block.type === 'image' ? (
          <figure>
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt={block.caption || block.title || 'Area image'}
                className="max-h-96 w-full rounded-xl object-cover"
              />
            ) : customizing ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Add an image from block settings.
              </p>
            ) : null}
            {block.caption ? (
              <figcaption className="mt-2 text-xs text-muted-foreground">
                {block.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : block.type === 'divider' ? (
          <hr className="border-border" />
        ) : block.type === 'linkedItems' ? (
          <p className="text-sm text-muted-foreground">
            {block.itemIds.length} linked{' '}
            {block.itemIds.length === 1 ? 'item' : 'items'}
          </p>
        ) : block.type === 'embeddedPage' ? (
          <div className="rounded-lg border border-border p-4 text-sm">
            {data.pages.find((item) => item.id === block.pageId)?.name ??
              block.title}
          </div>
        ) : null}
      </div>
      {customizing ? (
        <button
          type="button"
          aria-label={`Resize ${title}`}
          title="Drag to resize"
          className="absolute bottom-1 right-1 grid size-6 touch-none cursor-nwse-resize place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted focus-visible:opacity-100 group-hover/block:opacity-100"
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
            const size: BlockSize =
              x > 150
                ? 'full'
                : x > 60
                  ? 'wide'
                  : x < -60
                    ? 'small'
                    : y > 60
                      ? 'tall'
                      : 'medium'
            void onSave({ ...block, size })
          }}
        >
          <span aria-hidden="true">⌟</span>
        </button>
      ) : null}
    </div>
  )
}

const areaEmojiOptions = ['📚', '🌿', '🏠', '💰', '🏃', '🧭', '🎨', '✨', '☀️', '🎵']

function AreaSettings({
  area,
  onClose,
  onSave,
}: {
  area: Area
  onClose: () => void
  onSave: (patch: Partial<Area>) => Promise<void>
}) {
  usePanelEscape(onClose)
  return (
    <aside
      aria-label="Area settings"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-5 shadow-xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Customize this space</p>
          <h2 className="font-semibold">Area settings</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close area settings"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Name
          <Input
            aria-label="Area name"
            defaultValue={area.name}
            onBlur={(event) =>
              event.currentTarget.value !== area.name &&
              void onSave({ name: event.currentTarget.value })
            }
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Icon</legend>
          <button
            type="button"
            aria-pressed={!area.icon}
            onClick={() => void onSave({ icon: '' })}
            className="w-fit rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            No icon
          </button>
          <div className="grid grid-cols-8 gap-1" aria-label="Emoji icons">
            {areaEmojiOptions.map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`Use ${emoji} icon`}
                aria-pressed={area.icon === emoji}
                onClick={() => void onSave({ icon: emoji })}
                className="grid size-9 place-items-center rounded-md border border-border text-lg hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {areaIconOptions.map(({ name, icon: Icon }) => (
              <button
                type="button"
                key={name}
                aria-label={`Use ${name} icon`}
                aria-pressed={area.icon === name}
                onClick={() => void onSave({ icon: name })}
                className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                <Icon aria-hidden="true" className="size-4" />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm">
          Description
          <Textarea
            aria-label="Area description"
            defaultValue={area.description}
            onBlur={(event) =>
              event.currentTarget.value !== area.description &&
              void onSave({ description: event.currentTarget.value })
            }
          />
        </label>
      </div>
    </aside>
  )
}

function BlockSettings({
  block,
  collections,
  onClose,
  onSave,
}: {
  block?: Block
  collections: CollectionSchema[]
  onClose: () => void
  onSave: (block: Block) => Promise<void>
}) {
  usePanelEscape(onClose)
  if (!block) return null
  const updateBlock = (patch: Partial<Block>) =>
    void onSave({ ...block, ...patch } as Block)
  const view = block.type === 'view' ? block.view : null
  const collection = view
    ? collections.find((item) => item.id === view.collectionId)
    : undefined
  const fields = collection?.fields ?? []
  const firstFilter = view?.filter[0]
  const updateView = (patch: Partial<ViewSpec>) => {
    if (block.type === 'view' && view)
      void onSave({ ...block, view: { ...view, ...patch } })
  }
  const updateFilter = (patch: Partial<NonNullable<typeof firstFilter>>) => {
    if (!view) return
    const next = Object.assign(
      firstFilter
        ? { ...firstFilter }
        : { fieldId: fields[0]?.id ?? '', operator: 'isSet' as const },
      patch,
    )
    updateView({ filter: next.fieldId ? [next] : [] })
  }

  return (
    <aside
      aria-label="Block settings"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-5 shadow-xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Adjust this block</p>
          <h2 className="font-semibold">Settings</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close settings"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <Input
            aria-label="Block title"
            defaultValue={block.type === 'view' ? block.view.title : (block.title ?? '')}
            onBlur={(event) => {
              const currentTitle = block.type === 'view' ? block.view.title : (block.title ?? '')
              if (event.currentTarget.value !== currentTitle) {
                if (block.type === 'view') updateView({ title: event.currentTarget.value })
                else updateBlock({ title: event.currentTarget.value })
              }
            }}
          />
        </label>
        {view ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Collection
              <Select
                aria-label="Collection"
                value={view.collectionId}
                onChange={(event) =>
                  updateView({ collectionId: event.target.value })
                }
              >
                {collections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Display
              <Select
                aria-label="Display"
                value={view.display}
                onChange={(event) =>
                  updateView({ display: event.target.value as ViewDisplay })
                }
              >
                {displayOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Period
              <Select
                aria-label="Period"
                value={view.period ?? 'allTime'}
                onChange={(event) =>
                  updateView({ period: event.target.value as ViewPeriod })
                }
              >
                {Object.entries(periodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Group by
              <Select
                aria-label="Group by"
                value={view.groupBy ?? ''}
                onChange={(event) =>
                  updateView({ groupBy: event.target.value || undefined })
                }
              >
                <option value="">No grouping</option>
                <option value="month">Month</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Calculation
              <Select
                aria-label="Calculation"
                value={view.aggregate?.operation ?? 'count'}
                onChange={(event) =>
                  updateView({
                    aggregate: {
                      ...view.aggregate,
                      operation: event.target.value as NonNullable<
                        typeof view.aggregate
                      >['operation'],
                    },
                  })
                }
              >
                {operationOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Calculation field
              <Select
                aria-label="Calculation field"
                value={view.aggregate?.fieldId ?? ''}
                onChange={(event) =>
                  updateView({
                    aggregate: {
                      operation: view.aggregate?.operation ?? 'count',
                      fieldId: event.target.value || undefined,
                    },
                  })
                }
              >
                <option value="">Item count</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Filter field
              <Select
                aria-label="Filter field"
                value={firstFilter?.fieldId ?? ''}
                onChange={(event) =>
                  updateFilter({ fieldId: event.target.value })
                }
              >
                <option value="">No filter</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </Select>
            </label>
            {firstFilter ? (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Filter rule
                  <Select
                    aria-label="Filter rule"
                    value={firstFilter.operator}
                    onChange={(event) =>
                      updateFilter({
                        operator: event.target.value as NonNullable<
                          typeof firstFilter
                        >['operator'],
                      })
                    }
                  >
                    <option value="equals">Is</option>
                    <option value="contains">Contains</option>
                    <option value="greaterThan">Greater than</option>
                    <option value="lessThan">Less than</option>
                    <option value="isSet">Is set</option>
                  </Select>
                </label>
                {firstFilter.operator !== 'isSet' ? (
                  <label className="flex flex-col gap-1 text-sm">
                    Filter value
                    <Input
                      aria-label="Filter value"
                      value={String(firstFilter.value ?? '')}
                      onChange={(event) =>
                        updateFilter({ value: event.target.value })
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              Sort by
              <Select
                aria-label="Sort by"
                value={view.sort?.fieldId ?? ''}
                onChange={(event) =>
                  updateView({
                    sort: event.target.value
                      ? {
                          fieldId: event.target.value,
                          direction: view.sort?.direction ?? 'asc',
                        }
                      : undefined,
                  })
                }
              >
                <option value="">Default order</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </Select>
            </label>
            {view.sort ? (
              <label className="flex flex-col gap-1 text-sm">
                Sort direction
                <Select
                  aria-label="Sort direction"
                  value={view.sort.direction}
                  onChange={(event) =>
                    updateView({
                      sort: {
                        fieldId: view.sort?.fieldId ?? '',
                        direction: event.target.value as 'asc' | 'desc',
                      },
                    })
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </Select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              Item limit
              <Input
                aria-label="Item limit"
                type="number"
                min="1"
                value={view.limit ?? ''}
                onChange={(event) =>
                  updateView({
                    limit: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </label>
            {fields.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Visible columns</legend>
                {fields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={
                        !view.columns?.length || view.columns.includes(field.id)
                      }
                      onChange={(event) => {
                        const current = view.columns?.length
                          ? view.columns
                          : fields.map((entry) => entry.id)
                        updateView({
                          columns: event.target.checked
                            ? [...new Set([...current, field.id])]
                            : current.filter((id) => id !== field.id),
                        })
                      }}
                    />
                    {field.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}
        {block.type === 'text' ||
        block.type === 'heading' ||
        block.type === 'callout' ? (
          <label className="flex flex-col gap-1 text-sm">
            Text
            <Textarea
              aria-label="Block content"
              defaultValue={block.body}
              onBlur={(event) =>
                event.currentTarget.value !== block.body &&
                updateBlock({ body: event.currentTarget.value })
              }
            />
          </label>
        ) : null}
        {block.type === 'image' ? (
          <label className="flex flex-col gap-1 text-sm">
            Image URL
            <Input
              aria-label="Image URL"
              defaultValue={block.imageUrl}
              onBlur={(event) =>
                event.currentTarget.value !== block.imageUrl &&
                updateBlock({ imageUrl: event.currentTarget.value })
              }
            />
          </label>
        ) : null}
      </div>
    </aside>
  )
}

function usePanelEscape(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      ↗
    </span>
  )
}
