/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Archive, MoreHorizontal, Plus, X } from 'lucide-react'
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
  AreaPageSpec,
  AreaSection,
  AreaPageSettings,
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
import { AreaIcon } from '@/components/areas/area-icon'
import { SortableAreaBlock } from '@/components/areas/sortable-area-block'
import { blockOptions } from '@/components/areas/area-block-options'
import { AreaSettingsPanel } from '@/components/areas/area-settings-panel'
import {
  BlockPicker,
  DropZone,
  SectionMenu,
} from '@/components/areas/page-block-controls'
import { InlineAreaField } from '@/components/areas/inline-area-field'
import {
  PageCustomizeMenu,
  PageSettingsPanel,
} from '@/components/areas/page-settings-panel'
import { defaultAreaPageSettings } from '@/components/areas/page-settings-defaults'
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
  const [customizeMenuOpen, setCustomizeMenuOpen] = useState(false)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [settingsBlock, setSettingsBlock] = useState<string | null>(null)
  const [areaSettingsOpen, setAreaSettingsOpen] = useState(false)
  const [pageMenu, setPageMenu] = useState<string | null>(null)
  const [blockMenu, setBlockMenu] = useState<string | null>(null)
  const pageMenuRef = useRef<HTMLDivElement>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [picker, setPicker] = useState<{
    afterId?: string
    sectionId?: string
  } | null>(null)
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
  const pageBlocks = useMemo(
    () =>
      (data?.blocks ?? []).filter((block) =>
        sections.some(
          (section) =>
            section.id === block.sectionId ||
            (!block.sectionId && section.blockIds.includes(block.id)),
        ),
      ),
    [data?.blocks, sections],
  )
  const visibleBlocks = pageBlocks.filter(
    (block) => !page?.hiddenBlockIds?.includes(block.id),
  )
  const pageSettings = { ...defaultAreaPageSettings, ...page?.settings }

  useEffect(() => {
    const refreshArea = () => void refreshAreaData()
    window.addEventListener('hub:area-items-changed', refreshArea)
    return () =>
      window.removeEventListener('hub:area-items-changed', refreshArea)
  }, [refreshAreaData])

  useEffect(() => {
    if (!pageMenu) return
    const dismiss = (event: PointerEvent) => {
      if (!pageMenuRef.current?.contains(event.target as Node))
        setPageMenu(null)
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
      .filter(
        (block) =>
          block.sectionId === section.id ||
          (!block.sectionId && section.blockIds.includes(block.id)),
      )
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

  async function savePage(patch: Partial<AreaPageSpec>) {
    if (!page) return
    const updated = await areaLayoutApi.updatePage({ ...page, ...patch })
    resource.setData((previous) =>
      previous
        ? {
            ...previous,
            pages: previous.pages.map((current) =>
              current.id === updated.id ? updated : current,
            ),
          }
        : previous,
    )
  }

  async function togglePageBlock(block: Block, visible: boolean) {
    if (!page) return
    const hiddenBlockIds = new Set(page.hiddenBlockIds ?? [])
    if (visible) hiddenBlockIds.delete(block.id)
    else hiddenBlockIds.add(block.id)
    await savePage({ hiddenBlockIds: [...hiddenBlockIds] })
  }

  async function resetPageSettings() {
    if (!page) return
    const section = sections[0]
    const layout =
      section?.layout === 'stack'
        ? 'oneColumn'
        : section?.columns === 3
          ? 'threeColumns'
          : section?.columns === 4
            ? 'grid'
            : 'twoColumns'
    await savePage({
      settings: { ...defaultAreaPageSettings, layout },
      hiddenBlockIds: [],
    })
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
    const ordered = [...data.pages].sort(
      (left, right) => left.order - right.order,
    )
    const index = ordered.findIndex((item) => item.id === current.id)
    const target = index + delta
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    await areaLayoutApi.reorderPages(
      areaId,
      ordered.map((item) => item.id),
    )
    setPageMenu(null)
    await resource.refresh()
  }

  async function deletePage(current: AreaPageSpec) {
    if (!data || data.pages.length < 2) return
    if (
      !window.confirm(
        `Delete the page “${current.name}”? This cannot be undone.`,
      )
    )
      return
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
    <div
      className={cn(
        'mx-auto pt-3',
        pageSettings.width === 'full' ? 'max-w-none' : 'max-w-5xl',
      )}
    >
      <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <AreaIcon
              name={area.icon}
              className="size-5 shrink-0 text-primary"
            />
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
              onClick={() => setPageSettingsOpen(true)}
            >
              Page settings
            </Button>
          ) : null}
          {customizing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAreaSettingsOpen(true)}
            >
              Area settings
            </Button>
          ) : null}
          <div className="relative">
            <Button
              variant={customizing ? 'default' : 'outline'}
              size="sm"
              aria-expanded={customizeMenuOpen}
              onClick={() => {
                if (customizing) setCustomizing(false)
                else setCustomizeMenuOpen((open) => !open)
              }}
            >
              {customizing ? 'Done' : 'Customize'}
            </Button>
            {customizeMenuOpen && page ? (
              <PageCustomizeMenu
                blocks={pageBlocks}
                hiddenBlockIds={page.hiddenBlockIds ?? []}
                onToggleBlock={(block, visible) =>
                  void togglePageBlock(block, visible)
                }
                onOpenSettings={() => {
                  setCustomizeMenuOpen(false)
                  setPageSettingsOpen(true)
                }}
                onEditLayout={() => {
                  setCustomizeMenuOpen(false)
                  setCustomizing(true)
                }}
              />
            ) : null}
          </div>
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
                <div
                  key={item.id}
                  className="relative flex shrink-0 items-center gap-1"
                >
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setPageId(item.id)}
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
                  >
                    {item.name}
                  </button>
                  {showMenu ? (
                    <div
                      ref={pageMenu === item.id ? pageMenuRef : undefined}
                      className="relative"
                    >
                      <button
                        type="button"
                        aria-label={`Options for ${item.name}`}
                        aria-expanded={pageMenu === item.id}
                        onClick={() => {
                          setPicker(null)
                          setBlockMenu(null)
                          setPageMenu((current) =>
                            current === item.id ? null : item.id,
                          )
                        }}
                        className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {pageMenu === item.id ? (
                        <div className="absolute right-0 top-8 z-30 flex w-44 flex-col rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <button
                            className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setPageId(item.id)
                              setPageSettingsOpen(true)
                              setPageMenu(null)
                            }}
                          >
                            Page settings
                          </button>
                          <button
                            className="rounded px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => void renamePage(item)}
                          >
                            Rename
                          </button>
                          <button
                            disabled={index === 0}
                            className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void movePage(item, -1)}
                          >
                            Move left
                          </button>
                          <button
                            disabled={index === data.pages.length - 1}
                            className="rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void movePage(item, 1)}
                          >
                            Move right
                          </button>
                          <button
                            disabled={data.pages.length < 2}
                            title={
                              data.pages.length < 2
                                ? 'An area needs at least one page.'
                                : undefined
                            }
                            className="rounded px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void deletePage(item)}
                          >
                            Delete
                          </button>
                          {data.pages.length < 2 ? (
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
            <Button variant="ghost" size="sm" onClick={() => void addPage()}>
              <Plus />
              Add page
            </Button>
          ) : null}
        </nav>
      ) : null}
      {sections.length > 0 && pageBlocks.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="This page is empty"
          message="Add a block to give this page a starting point."
          action={
            <BlockPicker
              buttonLabel="Add a block"
              open={picker?.sectionId === sections[0].id}
              onPick={(type) => void addBlock(type, sections[0])}
              onClose={() => setPicker(null)}
              onOpenChange={(open) =>
                setPicker(open ? { sectionId: sections[0].id } : null)
              }
            />
          }
        />
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
          <div
            className={cn(
              'flex flex-col',
              pageSettings.density === 'compact' ? 'gap-3' : 'gap-5',
            )}
          >
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
                  <h2
                    className={cn(
                      'mb-3 text-sm font-semibold',
                      !section.title && 'sr-only',
                    )}
                  >
                    {section.title || 'Section'}
                  </h2>
                )}
                <SortableContext
                  items={sectionBlocks(section).map((block) => block.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div
                    className={cn(
                      'grid grid-cols-1',
                      pageSettings.density === 'compact' ? 'gap-2' : 'gap-4',
                      pageSettings.layout === 'oneColumn'
                        ? 'md:grid-cols-1'
                        : pageSettings.layout === 'threeColumns'
                          ? 'md:grid-cols-3'
                          : pageSettings.layout === 'grid'
                            ? 'md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]'
                            : 'md:grid-cols-2',
                    )}
                  >
                    {customizing &&
                    sectionBlocks(section).length === 0 &&
                    pageBlocks.length > 0 ? (
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
                        <SortableAreaBlock
                          block={block}
                          data={data}
                          pageSettings={pageSettings}
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
      {pageSettingsOpen && page ? (
        <PageSettingsPanel
          page={page}
          onClose={() => setPageSettingsOpen(false)}
          onSave={(settings) => void savePage({ settings })}
          onReset={() => void resetPageSettings()}
        />
      ) : null}
      {customizing && areaSettingsOpen ? (
        <AreaSettingsPanel
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

export function SortableBlock({
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

  useEffect(() => {
    if (!menuOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node))
        onMenuOpenChange(false)
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
          className="absolute -left-2 top-1/2 z-10 grid size-6 -translate-x-full -translate-y-1/2 touch-none place-items-center rounded text-muted-foreground hover:bg-muted"
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      ) : null}
      {customizing ? (
        <div
          ref={menuRef}
          className="absolute right-1 top-1 z-10"
        >
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
            showTitle={pageSettings.showBlockTitles}
            plain={pageSettings.blockStyle === 'plain'}
            compact={pageSettings.density === 'compact'}
            onChangeSpec={(next) => {
              if (block.type === 'view') void onSave({ ...block, view: next })
            }}
          />
        ) : block.type === 'collection' && collection ? (
          <Link
            to={`/area/${collection.areaId}/collection/${collection.id}`}
            className={cn(
              'block rounded-xl p-4',
              pageSettings.blockStyle === 'plain'
                ? 'border-0 px-0'
                : 'border border-border hover:border-primary/40',
            )}
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
            {block.title && pageSettings.showBlockTitles ? (
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
            defaultValue={
              block.type === 'view' ? block.view.title : (block.title ?? '')
            }
            onBlur={(event) => {
              const currentTitle =
                block.type === 'view' ? block.view.title : (block.title ?? '')
              if (event.currentTarget.value !== currentTitle) {
                if (block.type === 'view')
                  updateView({ title: event.currentTarget.value })
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
