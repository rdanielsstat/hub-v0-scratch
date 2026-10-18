import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Archive, ArrowLeft, Plus, Search, Trash2 } from 'lucide-react'
import type { Area, CollectionSchema, FieldDef, Item, ItemValue } from '@/services/api'
import { areasApi, collectionsApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'

interface CollectionData { area: Area | null; collection: CollectionSchema | null; items: Item[] }
const dateToday = () => new Date().toISOString().slice(0, 10)
const loadCollection = async (areaId: string, collectionId: string): Promise<CollectionData> => {
  const [area, collection, items] = await Promise.all([areasApi.getArea(areaId), collectionsApi.getCollection(collectionId), collectionsApi.listCollectionItems(collectionId)])
  return { area, collection, items }
}
const valueText = (value: ItemValue | undefined) => Array.isArray(value) ? value.join(', ') : value && typeof value === 'object' ? value.title : value === null || value === undefined ? '' : String(value)

export function CollectionPage() {
  const { areaId = '', collectionId = '' } = useParams()
  const loader = useCallback(() => loadCollection(areaId, collectionId), [areaId, collectionId])
  const resource = useApiResource(loader, `${areaId}:${collectionId}`)
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const collection = resource.data?.collection
  const fields = collection?.fields ?? []
  const items = useMemo(() => (resource.data?.items ?? []).filter((item) => `${item.title} ${Object.values(item.data).map(valueText).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())), [resource.data?.items, query])

  async function addItem() {
    if (!collection || saving) return
    setSaving(true)
    setFormError('')
    try {
      const data: Record<string, ItemValue> = {}
      for (const field of fields) {
        const value = draft[field.id] ?? (field.type === 'date' ? dateToday() : '')
        if (field.type === 'number' || field.type === 'currency' || field.type === 'duration') data[field.id] = value ? Number(value) : 0
        else if (field.type === 'checkbox') data[field.id] = value === 'true'
        else if (field.type === 'multiChoice') data[field.id] = value.split(',').map((part) => part.trim()).filter(Boolean)
        else data[field.id] = value
      }
      const titleField = fields.find((field) => Boolean(data[field.id]))
      const title = titleField ? valueText(data[titleField.id]) : 'Untitled item'
      await collectionsApi.createItem({ areaId, collectionId, title, type: collectionId, occurredAt: String(data[fields.find((field) => field.type === 'date')?.id ?? ''] ?? dateToday()), data })
      setDraft({})
      setDialogOpen(false)
      await resource.refresh()
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'Could not add this item.') }
    finally { setSaving(false) }
  }
  async function removeItem(item: Item) { await collectionsApi.deleteItems([item.id]); await resource.refresh() }
  async function updateValue(item: Item, field: FieldDef, value: string) {
    const parsed: ItemValue = field.type === 'number' || field.type === 'currency' || field.type === 'duration' ? Number(value) || 0 : field.type === 'checkbox' ? value === 'true' : value
    await collectionsApi.updateItem(item.id, { data: { ...item.data, [field.id]: parsed } })
    await resource.refresh()
  }

  if (resource.loading) return <div aria-label="Loading collection" className="grid gap-3"><div className="h-12 animate-pulse rounded-lg bg-muted/50" /><div className="h-64 animate-pulse rounded-lg border border-border bg-muted/40" /></div>
  if (resource.error) return <EmptyState variant="page" icon={Archive} tone="danger" title="Could not load this collection" message={resource.error.message} action={<Button variant="outline" onClick={() => void resource.refresh()}>Try again</Button>} />
  if (!resource.data?.area || !collection) return <EmptyState variant="page" icon={Archive} title="Collection not found" message="This collection may have been removed." />
  return <div className="mx-auto max-w-6xl">
    <Link to={`/area/${areaId}`} className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />{resource.data.area.name}</Link>
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs text-muted-foreground">{resource.data.area.name}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{collection.name}</h1><p className="mt-1 text-sm text-muted-foreground">{collection.description}</p></div><div className="flex gap-2"><label className="relative"><span className="sr-only">Search collection</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entries" className="pl-9" /></label><Button onClick={() => setDialogOpen(true)}><Plus />Add item</Button></div></header>
    <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
    {items.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-3 font-medium">Title</th>{fields.map((field) => <th key={field.id} className="px-3 py-3 font-medium">{field.name}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-border/70"><th scope="row" className="max-w-56 truncate px-3 py-3 font-medium">{item.title}</th>{fields.map((field) => <td key={field.id} className="px-3 py-2"><FieldValue field={field} value={item.data[field.id]} onChange={(value) => void updateValue(item, field, value)} /></td>)}<td className="px-2"><Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.title}`} onClick={() => void removeItem(item)}><Trash2 /></Button></td></tr>)}</tbody></table></div> : <EmptyState icon={query ? Search : Plus} title={query ? 'No matching items' : 'No items yet'} message={query ? 'Try a different search.' : 'Add the first entry to this collection.'} action={!query ? <Button onClick={() => setDialogOpen(true)}><Plus />Add item</Button> : null} />}
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={`Add to ${collection.name}`}><DialogHeader title={`Add to ${collection.name}`} description="Enter the details for this item." /><DialogBody className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">{fields.map((field) => <label key={field.id} className="flex flex-col gap-1.5 text-sm"><Label htmlFor={`new-${field.id}`}>{field.name}</Label><FieldInput field={field} value={draft[field.id] ?? (field.type === 'date' ? dateToday() : '')} onChange={(value) => setDraft((previous) => ({ ...previous, [field.id]: value }))} id={`new-${field.id}`} /></label>)}{formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}</DialogBody><DialogFooter><Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={saving} onClick={() => void addItem()}>{saving ? 'Saving' : 'Add item'}</Button></DialogFooter></Dialog>
  </div>
}

function FieldValue({ field, value, onChange }: { field: FieldDef; value: ItemValue | undefined; onChange: (value: string) => void }) {
  const current = valueText(value)
  if (field.type === 'checkbox') return <input type="checkbox" aria-label={field.name} checked={current === 'true'} onChange={(event) => onChange(String(event.target.checked))} />
  if (field.type === 'choice' && field.options?.length) return <Select aria-label={field.name} value={current} onChange={(event) => onChange(event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</Select>
  return <Input aria-label={field.name} type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' || field.type === 'duration' ? 'number' : 'text'} value={current} onChange={(event) => onChange(event.target.value)} className="h-8 min-w-28" />
}
function FieldInput({ field, value, onChange, id }: { field: FieldDef; value: string; onChange: (value: string) => void; id: string }) {
  if (field.type === 'choice' && field.options?.length) return <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Choose</option>{field.options.map((option) => <option key={option}>{option}</option>)}</Select>
  if (field.type === 'checkbox') return <input id={id} type="checkbox" checked={value === 'true'} onChange={(event) => onChange(String(event.target.checked))} />
  return <Input id={id} type={field.type === 'date' ? 'date' : field.type === 'number' || field.type === 'currency' || field.type === 'duration' ? 'number' : 'text'} value={value} onChange={(event) => onChange(event.target.value)} />
}
