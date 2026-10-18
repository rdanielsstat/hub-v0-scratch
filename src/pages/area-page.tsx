import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Archive, Plus, Settings2, Trash2 } from 'lucide-react'
import type { Area, AreaPageSpec, AreaSection, Block, BlockSize, CollectionSchema, Item, ViewSpec } from '@/services/api'
import { areaLayoutApi, areasApi, blocksApi, collectionsApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { ViewRenderer } from '@/components/areas/view-renderer'

interface AreaScreenData { area: Area | null; pages: AreaPageSpec[]; sections: AreaSection[]; blocks: Block[]; collections: CollectionSchema[]; items: Item[] }
const loadArea = async (areaId: string): Promise<AreaScreenData> => {
  const [area, pages, collections, blocks] = await Promise.all([areasApi.getArea(areaId), areaLayoutApi.listPages(areaId), collectionsApi.listCollections(areaId), blocksApi.listBlocks(areaId)])
  const [sections, itemLists] = await Promise.all([Promise.all(pages.map((page) => areaLayoutApi.listSections(page.id))), Promise.all(collections.map((collection) => collectionsApi.listCollectionItems(collection.id)))])
  return { area, pages, sections: sections.flat(), blocks, collections, items: itemLists.flat() }
}

export function AreaPage({ onCapture }: { onCapture: () => void }) {
  const { areaId = '' } = useParams()
  const loader = useCallback(() => loadArea(areaId), [areaId])
  const resource = useApiResource(loader, areaId)
  const data = resource.data
  useEffect(() => {
    const refreshArea = () => void resource.refresh()
    window.addEventListener('hub:area-items-changed', refreshArea)
    return () => window.removeEventListener('hub:area-items-changed', refreshArea)
  }, [resource.refresh])
  const [pageId, setPageId] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const [settingsBlock, setSettingsBlock] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const page = data?.pages.find((item) => item.id === pageId) ?? data?.pages[0]
  const sections = useMemo(() => (data?.sections ?? []).filter((section) => section.pageId === page?.id).sort((a, b) => a.order - b.order), [data?.sections, page?.id])
  const visibleBlocks = useMemo(() => (data?.blocks ?? []).filter((block) => !block.sectionId || sections.some((section) => section.id === block.sectionId)), [data?.blocks, sections])

  async function saveBlock(block: Block) { await blocksApi.saveBlock(block); await resource.refresh() }
  async function reorderBlocks(event: DragEndEvent) {
    if (!data || !event.over || event.active.id === event.over.id) return
    const active = data.blocks.find((block) => block.id === event.active.id)
    const overBlock = data.blocks.find((block) => block.id === event.over!.id)
    if (!active) return
    const destination = overBlock ? overBlock.sectionId ?? sections[0]?.id : String(event.over.id)
    if (!sections.some((section) => section.id === destination)) return
    const next = data.blocks.map((block) => block.id === active.id ? { ...block, sectionId: destination } : block)
    const destinationBlocks = next.filter((block) => (block.sectionId ?? sections[0]?.id) === destination)
    const from = destinationBlocks.findIndex((block) => block.id === active.id)
    const to = overBlock ? destinationBlocks.findIndex((block) => block.id === overBlock.id) : destinationBlocks.length - 1
    if (from >= 0 && to >= 0 && from !== to) { const [moved] = destinationBlocks.splice(from, 1); destinationBlocks.splice(to, 0, moved) }
    for (const [order, block] of destinationBlocks.entries()) await blocksApi.saveBlock({ ...block, sectionId: destination, order })
    await blocksApi.saveBlockOrder(areaId, destinationBlocks.map((block) => block.id))
    await resource.refresh()
  }

  async function addSection() {
    if (!page) return
    await areaLayoutApi.createSection(areaId, page.id)
    await resource.refresh()
  }
  async function updateSection(section: AreaSection, patch: Partial<AreaSection>) { await areaLayoutApi.updateSection({ ...section, ...patch }); await resource.refresh() }
  async function removeSection(section: AreaSection) { await areaLayoutApi.removeSection(section.id); await resource.refresh() }
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
    if (name) { await areaLayoutApi.updatePage({ ...current, name }); await resource.refresh() }
  }
  async function deletePage(current: AreaPageSpec) {
    if (!data || data.pages.length < 2) return
    await areaLayoutApi.removePage(areaId, current.id)
    setPageId(data.pages.find((item) => item.id !== current.id)?.id ?? '')
    await resource.refresh()
  }
  async function movePage(current: AreaPageSpec, delta: number) {
    if (!data) return
    const ordered = [...data.pages].sort((a, b) => a.order - b.order)
    const index = ordered.findIndex((item) => item.id === current.id)
    const target = Math.max(0, Math.min(ordered.length - 1, index + delta))
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    await areaLayoutApi.reorderPages(areaId, ordered.map((item) => item.id))
    await resource.refresh()
  }
  async function moveSection(current: AreaSection, delta: number) {
    const ordered = [...sections]
    const index = ordered.findIndex((item) => item.id === current.id)
    const target = Math.max(0, Math.min(ordered.length - 1, index + delta))
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    await areaLayoutApi.reorderSections(current.pageId, ordered.map((item) => item.id))
    await resource.refresh()
  }
  async function addBlock(type: Block['type'], section: AreaSection) {
    const id = `block-${crypto.randomUUID()}`
    let block: Block
    const base = { id, areaId, sectionId: section.id, order: data?.blocks.length ?? 0, size: 'medium' as const }
    if (type === 'text') block = { ...base, type, title: 'Text', body: 'Write something here.' }
    else if (type === 'heading') block = { ...base, type, title: 'Heading', body: 'A heading' }
    else if (type === 'list') block = { ...base, type, title: 'List', items: ['First item'] }
    else if (type === 'checklist') block = { ...base, type, title: 'Checklist', items: [{ text: 'First step', checked: false }] }
    else if (type === 'divider') block = { ...base, type }
    else if (type === 'callout') block = { ...base, type, title: 'Note', body: 'A useful note.' }
    else if (type === 'image') block = { ...base, type, title: 'Image', imageUrl: '', caption: '' }
    else if (type === 'collection') { const collection = data?.collections[0]; if (!collection) return; block = { ...base, type, title: collection.name, collectionId: collection.id } }
    else if (type === 'view') { const collection = data?.collections[0]; if (!collection) return; block = { ...base, type, title: 'New view', view: { id, title: 'New view', collectionId: collection.id, display: 'table', filter: [] } } }
    else if (type === 'linkedItems') block = { ...base, type, title: 'Linked items', itemIds: [] }
    else { const target = data?.pages.find((item) => item.id !== page?.id); if (!target) return; block = { ...base, type: 'embeddedPage', title: target.name, pageId: target.id } }
    await blocksApi.saveBlock(block)
    await resource.refresh()
  }
  async function duplicateBlock(block: Block) {
    const copy = { ...structuredClone(block), id: `block-${crypto.randomUUID()}`, order: visibleBlocks.length } as Block
    await blocksApi.saveBlock(copy)
    await resource.refresh()
  }
  async function deleteBlock(block: Block) { await blocksApi.removeBlock(block.id); await resource.refresh() }
  async function moveBlock(block: Block, delta: number) {
    const list = visibleBlocks.filter((item) => (item.sectionId ?? sections[0]?.id) === (block.sectionId ?? sections[0]?.id))
    const index = list.findIndex((item) => item.id === block.id)
    const target = Math.max(0, Math.min(list.length - 1, index + delta))
    ;[list[index], list[target]] = [list[target], list[index]]
    await blocksApi.saveBlockOrder(areaId, list.map((item) => item.id))
    await resource.refresh()
  }
  async function saveArea(patch: Partial<Area>) {
    if (!data?.area) return
    try { await areaLayoutApi.updateArea(areaId, patch); setSaveError(''); await resource.refresh() }
    catch { setSaveError('Could not save area settings. Try again.') }
  }

  if (resource.loading) return <div aria-label="Loading area" className="grid gap-4"><div className="h-16 animate-pulse rounded-xl bg-muted/50" /><div className="h-44 animate-pulse rounded-xl border border-border bg-muted/40" /></div>
  if (resource.error) return <EmptyState icon={Archive} variant="page" tone="danger" title="Could not load this area" message={resource.error.message} action={<Button variant="outline" onClick={() => void resource.refresh()}>Try again</Button>} />
  if (!data?.area) return <EmptyState icon={Archive} variant="page" title="Area not found" message="This space may have been removed." />
  const area = data.area
  const sectionBlocks = (section: AreaSection) => visibleBlocks.filter((block) => (block.sectionId ?? sections[0]?.id) === section.id).sort((a, b) => a.order - b.order)

  return <div className="mx-auto max-w-5xl border-t-2 pt-3" style={{ borderTopColor: `var(--${area.accent || 'primary'})` }}>
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span aria-hidden="true" className="text-xl">{area.icon}</span><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Area</p></div>{customizing ? <Input aria-label="Area name" defaultValue={area.name} onBlur={(event) => event.currentTarget.value !== area.name && void saveArea({ name: event.currentTarget.value })} className="h-auto max-w-xl border-0 px-0 text-2xl font-semibold shadow-none sm:text-3xl" /> : <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{area.name}</h1>}{customizing ? <Input aria-label="Area description" defaultValue={area.description} onBlur={(event) => event.currentTarget.value !== area.description && void saveArea({ description: event.currentTarget.value })} className="mt-2 max-w-xl" /> : <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{area.description}</p>}</div>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={onCapture}><Plus />Capture</Button><Button variant={customizing ? 'default' : 'outline'} size="sm" onClick={() => setCustomizing((value) => !value)}><Settings2 />{customizing ? 'Done' : 'Customize'}</Button></div>
    </header>
    {saveError ? <p role="alert" className="mb-3 text-sm text-destructive">{saveError}</p> : null}
    {data.pages.length ? <div className="mb-5 flex items-center gap-2 overflow-x-auto border-b border-border" role="tablist" aria-label={`${area.name} pages`}>
      {data.pages.map((item) => <div key={item.id} className="group flex items-center gap-1"><button role="tab" aria-selected={page?.id === item.id} onClick={() => setPageId(item.id)} onDoubleClick={() => customizing && void renamePage(item)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${page?.id === item.id ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}>{item.name}</button>{customizing ? <><button aria-label={`Rename ${item.name}`} onClick={() => void renamePage(item)} className="text-xs text-muted-foreground">Edit</button><button aria-label={`Move ${item.name} left`} onClick={() => void movePage(item, -1)} className="text-xs text-muted-foreground">←</button><button aria-label={`Move ${item.name} right`} onClick={() => void movePage(item, 1)} className="text-xs text-muted-foreground">→</button><button aria-label={`Delete ${item.name}`} onClick={() => void deletePage(item)} className="text-xs text-muted-foreground">×</button></> : null}</div>)}{customizing ? <Button variant="ghost" size="sm" onClick={() => void addPage()}><Plus />Add page</Button> : null}
    </div> : null}
    {customizing && page ? <div className="mb-4 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void addSection()}><Plus />Add section</Button><Button variant="outline" size="sm" onClick={() => void saveArea({ icon: window.prompt('Icon or emoji', area.icon) ?? area.icon })}>Area icon</Button><Select aria-label="Area accent" value={area.accent} onChange={(event) => void saveArea({ accent: event.target.value })} className="h-9 w-36"><option value="primary">Primary</option><option value="chart-1">Accent 1</option><option value="chart-2">Accent 2</option><option value="chart-3">Accent 3</option><option value="chart-4">Accent 4</option><option value="chart-5">Accent 5</option></Select></div> : null}
    {!sections.length ? <EmptyState icon={Plus} title="A quiet place to begin" message="Add a section, collection, or view to shape this page." action={customizing ? <Button onClick={() => void addSection()}>Add section</Button> : null} /> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorderBlocks(event)}>
      <div className="flex flex-col gap-5">{sections.map((section) => <DropZone key={section.id} id={section.id} enabled={customizing}>
        {customizing ? <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-2"><Input aria-label="Section title" defaultValue={section.title ?? ''} placeholder="Section title" onBlur={(event) => event.currentTarget.value !== (section.title ?? '') && void updateSection(section, { title: event.currentTarget.value })} className="h-8 max-w-52" /><Select aria-label="Section layout" value={section.layout} onChange={(event) => void updateSection(section, { layout: event.target.value as AreaSection['layout'] })} className="h-8 w-28"><option value="stack">Stack</option><option value="grid">Grid</option></Select>{section.layout === 'grid' ? <Select aria-label="Section columns" value={String(section.columns)} onChange={(event) => void updateSection(section, { columns: Number(event.target.value) as AreaSection['columns'] })} className="h-8 w-24">{[1,2,3,4].map((count) => <option key={count} value={count}>{count} columns</option>)}</Select> : null}<Button variant="ghost" size="xs" aria-label={`Move section ${section.order} up`} onClick={() => void moveSection(section, -1)}>↑</Button><Button variant="ghost" size="xs" aria-label={`Move section ${section.order} down`} onClick={() => void moveSection(section, 1)}>↓</Button><Button variant="ghost" size="icon-sm" aria-label="Delete section" onClick={() => void removeSection(section)}><Trash2 /></Button><div className="flex flex-wrap gap-1">{(['text','heading','list','checklist','image','divider','callout','view','linkedItems','embeddedPage','collection'] as Block['type'][]).map((type) => <Button key={type} variant="secondary" size="xs" onClick={() => void addBlock(type, section)}>{type}</Button>)}</div></div> : section.title ? <h2 className="mb-3 text-sm font-semibold">{section.title}</h2> : null}
        <SortableContext items={sectionBlocks(section).map((block) => block.id)} strategy={verticalListSortingStrategy}>
          <div className={section.layout === 'grid' ? `grid grid-cols-1 gap-4 ${section.columns === 2 ? 'md:grid-cols-2' : section.columns === 3 ? 'md:grid-cols-3' : section.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-1'}` : 'flex flex-col gap-4'}>{sectionBlocks(section).map((block) => <SortableBlock key={block.id} block={block} data={data} customizing={customizing} onSave={saveBlock} onDelete={deleteBlock} onDuplicate={duplicateBlock} onMove={moveBlock} onSettings={setSettingsBlock} />)}</div>
        </SortableContext>
      </DropZone>)}</div>
    </DndContext>}
    {customizing && settingsBlock ? <ViewSettings block={data.blocks.find((item) => item.id === settingsBlock)} collections={data.collections} onClose={() => setSettingsBlock(null)} onSave={saveBlock} /> : null}
  </div>
}

function DropZone({ id, enabled, children }: { id: string; enabled: boolean; children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: !enabled })
  return <section ref={setNodeRef} className={`min-w-0 rounded-lg ${isOver ? 'outline outline-2 outline-primary/40' : ''}`}>{children}</section>
}

function SortableBlock({ block, data, customizing, onSave, onDelete, onDuplicate, onMove, onSettings }: { block: Block; data: AreaScreenData; customizing: boolean; onSave: (block: Block) => Promise<void>; onDelete: (block: Block) => Promise<void>; onDuplicate: (block: Block) => Promise<void>; onMove: (block: Block, delta: number) => Promise<void>; onSettings: (id: string) => void }) {
  const sortable = useSortable({ id: block.id, disabled: !customizing })
  const transform = sortable.transform
  const style = { transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})` : undefined, transition: sortable.transition }
  const view = block.type === 'view' ? block.view : null
  const collection = view ? data.collections.find((item) => item.id === view.collectionId) : block.type === 'collection' ? data.collections.find((item) => item.id === block.collectionId) : null
  const items = collection ? data.items.filter((item) => item.collectionId === collection.id) : []
  return <div ref={sortable.setNodeRef} style={style} className={`min-w-0 ${block.size === 'wide' || block.size === 'full' ? 'md:col-span-full' : ''} ${block.size === 'tall' ? 'min-h-64' : ''}`} {...sortable.attributes}>
    {customizing ? <div className="mb-1 flex flex-wrap items-center gap-1"><button type="button" {...sortable.listeners} aria-label={`Drag ${block.title ?? block.type}`} className="cursor-grab rounded border border-border px-2 py-1 text-xs text-muted-foreground">Move</button><Button variant="ghost" size="xs" onClick={() => void onMove(block, -1)}>Move up</Button><Button variant="ghost" size="xs" onClick={() => void onMove(block, 1)}>Move down</Button><Select aria-label={`Size ${block.title ?? block.type}`} value={block.size ?? 'medium'} onChange={(event) => void onSave({ ...block, size: event.target.value as BlockSize })} className="h-7 w-24"><option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option><option value="tall">Tall</option><option value="full">Full</option></Select><Button variant="ghost" size="xs" onClick={() => void onDuplicate(block)}>Duplicate</Button><Button variant="ghost" size="xs" onClick={() => void onDelete(block)}>Remove</Button>{view ? <Button variant="ghost" size="xs" onClick={() => onSettings(block.id)}>View settings</Button> : null}</div> : null}
    {customizing && block.type !== 'view' && block.type !== 'collection' && block.title ? <Input aria-label={`Block title ${block.title}`} defaultValue={block.title} onBlur={(event) => event.currentTarget.value !== block.title && void onSave({ ...block, title: event.currentTarget.value })} className="mb-2 h-8" /> : null}
    {customizing && (block.type === 'text' || block.type === 'heading' || block.type === 'callout') ? <Textarea aria-label={`Block content ${block.title ?? block.type}`} defaultValue={block.body} onBlur={(event) => event.currentTarget.value !== block.body && void onSave({ ...block, body: event.currentTarget.value })} className="mb-2" /> : null}
    {customizing && block.type === 'image' ? <Input aria-label="Image URL" defaultValue={block.imageUrl} placeholder="Image URL" onBlur={(event) => event.currentTarget.value !== block.imageUrl && void onSave({ ...block, imageUrl: event.currentTarget.value })} className="mb-2" /> : null}
    {block.type === 'view' && collection ? <ViewRenderer spec={block.view} items={items} fields={collection.fields} />
      : block.type === 'collection' && collection ? <a href={`/area/${collection.areaId}/collection/${collection.id}`} className="block rounded-xl border border-border p-4 hover:border-primary/40"><h3 className="font-medium">{collection.name}</h3><p className="mt-1 text-sm text-muted-foreground">{items.length} items</p></a>
        : block.type === 'text' || block.type === 'callout' || block.type === 'heading' ? <article className={block.type === 'callout' ? 'rounded-lg border-l-2 border-primary bg-muted/50 p-4' : 'rounded-lg border border-border/70 p-4'}>{block.title ? <h3 className="mb-2 text-sm font-medium">{block.title}</h3> : null}<p className="whitespace-pre-wrap text-sm leading-relaxed">{block.body}</p></article>
          : block.type === 'list' || block.type === 'checklist' ? <ul className="flex flex-col gap-2 rounded-lg border border-border p-4">{block.items.map((item, index) => <li key={index} className="text-sm">{typeof item === 'string' ? item : <label className="flex items-center gap-2"><input type="checkbox" checked={item.checked} readOnly />{item.text}</label>}</li>)}</ul>
            : block.type === 'image' ? <figure>{block.imageUrl ? <img src={block.imageUrl} alt={block.caption || block.title || 'Area image'} className="max-h-96 w-full rounded-xl object-cover" /> : customizing ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Add an image URL from block settings.</p> : null}{block.caption ? <figcaption className="mt-2 text-xs text-muted-foreground">{block.caption}</figcaption> : null}</figure>
              : block.type === 'divider' ? <hr className="border-border" />
                : block.type === 'linkedItems' ? <p className="text-sm text-muted-foreground">{block.itemIds.length} linked items</p>
                  : block.type === 'embeddedPage' ? <div className="rounded-lg border border-border p-4 text-sm">{data.pages?.find((page) => page.id === block.pageId)?.name ?? block.title}</div> : null}
  </div>
}

function ViewSettings({ block, collections, onClose, onSave }: { block?: Block; collections: CollectionSchema[]; onClose: () => void; onSave: (block: Block) => Promise<void> }) {
  if (!block || block.type !== 'view') return null
  const update = (patch: Partial<ViewSpec>) => { if (block.type === 'view') void onSave({ ...block, view: { ...block.view, ...patch } }) }
  const collection = collections.find((item) => item.id === block.view.collectionId)
  const fields = collection?.fields ?? []
  const firstFilter = block.view.filter[0]
  function updateFilter(patch: Partial<NonNullable<typeof firstFilter>>) {
    const next = firstFilter ? { ...firstFilter, ...patch } : { fieldId: patch.fieldId ?? fields[0]?.id ?? '', operator: patch.operator ?? 'isSet' as const, ...patch }
    update({ filter: next.fieldId ? [next] : [] })
  }
  return <aside aria-label="View settings" className="fixed inset-y-0 right-0 z-30 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-5 shadow-xl">
    <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">View settings</h2><Button variant="ghost" size="sm" onClick={onClose}>Close</Button></div>
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">Title<Input defaultValue={block.view.title} onBlur={(event) => event.currentTarget.value !== block.view.title && update({ title: event.currentTarget.value })} /></label>
      <label className="flex flex-col gap-1 text-sm">Collection<Select value={block.view.collectionId} onChange={(event) => update({ collectionId: event.target.value })}>{collections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Display<Select value={block.view.display} onChange={(event) => update({ display: event.target.value as ViewSpec['display'] })}>{['stat','line','bar','donut','table','cards','gallery','list','timeline','board','calendar'].map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Period<Select value={block.view.period ?? 'allTime'} onChange={(event) => update({ period: event.target.value as ViewSpec['period'] })}>{['thisMonth','last30Days','12Months','allTime'].map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Group by<Select value={block.view.groupBy ?? ''} onChange={(event) => update({ groupBy: event.target.value || undefined })}><option value="">No grouping</option><option value="month">Month</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Aggregate<Select value={block.view.aggregate?.operation ?? 'count'} onChange={(event) => update({ aggregate: { ...block.view.aggregate, operation: event.target.value as NonNullable<typeof block.view.aggregate>['operation'] } })}>{['sum','average','count','min','max','latest'].map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Aggregate field<Select value={block.view.aggregate?.fieldId ?? ''} onChange={(event) => update({ aggregate: { operation: block.view.aggregate?.operation ?? 'count', fieldId: event.target.value || undefined } })}><option value="">Item count</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></label>
      <label className="flex flex-col gap-1 text-sm">Filter field<Select value={firstFilter?.fieldId ?? ''} onChange={(event) => updateFilter({ fieldId: event.target.value })}><option value="">No filter</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></label>
      {firstFilter ? <><label className="flex flex-col gap-1 text-sm">Filter rule<Select value={firstFilter.operator} onChange={(event) => updateFilter({ operator: event.target.value as NonNullable<typeof firstFilter>['operator'] })}>{['equals','contains','greaterThan','lessThan','isSet'].map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>{firstFilter.operator !== 'isSet' ? <label className="flex flex-col gap-1 text-sm">Filter value<Input defaultValue={String(firstFilter.value ?? '')} onBlur={(event) => updateFilter({ value: event.currentTarget.value })} /></label> : null}</> : null}
      <label className="flex flex-col gap-1 text-sm">Sort by<Select value={block.view.sort?.fieldId ?? ''} onChange={(event) => update({ sort: event.target.value ? { fieldId: event.target.value, direction: block.view.sort?.direction ?? 'asc' } : undefined })}><option value="">Default order</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</Select></label>
      {block.view.sort ? <label className="flex flex-col gap-1 text-sm">Sort direction<Select value={block.view.sort.direction} onChange={(event) => update({ sort: { ...block.view.sort!, direction: event.target.value as 'asc' | 'desc' } })}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></label> : null}
      <label className="flex flex-col gap-1 text-sm">Item limit<Input type="number" min="1" value={block.view.limit ?? ''} onChange={(event) => update({ limit: event.target.value ? Number(event.target.value) : undefined })} /></label>
      {fields.length ? <fieldset className="flex flex-col gap-2"><legend className="text-sm font-medium">Visible columns</legend>{fields.map((field) => <label key={field.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!block.view.columns?.length || block.view.columns.includes(field.id)} onChange={(event) => { const current = block.view.columns?.length ? block.view.columns : fields.map((entry) => entry.id); update({ columns: event.target.checked ? [...new Set([...current, field.id])] : current.filter((id) => id !== field.id) }) }} />{field.name}</label>)}</fieldset> : null}
    </div>
  </aside>
}
