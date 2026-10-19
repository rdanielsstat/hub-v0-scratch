import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Archive, Plus } from 'lucide-react'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type {
  Area,
  AreaPageSpec,
  AreaSection,
  Block,
  ViewDisplay,
} from '@/services/api'
import {
  areaLayoutApi,
  areasApi,
  blocksApi,
  collectionsApi,
} from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
import type { AreaScreenData } from '@/components/areas/area-screen-data'
import { BlockSettings } from '@/components/areas/block-settings-panel'
import { PageTabs } from '@/components/areas/page-tabs'
import { cn } from '@/lib/utils'

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
        <PageTabs
          areaName={area.name}
          pages={data.pages}
          activePageId={page?.id}
          customizing={customizing}
          menuPageId={pageMenu}
          menuRef={pageMenuRef}
          onSelect={setPageId}
          onToggleMenu={(id) => {
            setPicker(null)
            setBlockMenu(null)
            setPageMenu((current) => (current === id ? null : id))
          }}
          onOpenSettings={(item) => {
            setPageId(item.id)
            setPageSettingsOpen(true)
            setPageMenu(null)
          }}
          onRename={(item) => void renamePage(item)}
          onMove={(item, delta) => void movePage(item, delta)}
          onDelete={(item) => void deletePage(item)}
          onAdd={() => void addPage()}
        />
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
