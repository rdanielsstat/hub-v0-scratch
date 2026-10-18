import type { ComponentType } from 'react'
import type { Item, ViewDisplay, ViewSpec } from '@/services/api'
import type { FieldDef } from '@/services/api'
import { aggregateView, applyViewSpec, groupView } from '@/lib/view-spec'
import { Card } from '@/components/ui/card'

interface Props { spec: ViewSpec; items: Item[]; fields: FieldDef[] }
const format = (value: unknown, field?: FieldDef) => {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (field?.type === 'currency' && typeof value === 'number') return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  return `${String(value)}${field?.unit ? ` ${field.unit}` : ''}`
}

export function ViewRenderer({ spec, items, fields }: Props) {
  const visibleItems = applyViewSpec(spec, items)
  const aggregate = aggregateView(spec, visibleItems)
  const groups = groupView(spec, visibleItems)
  const columns = spec.columns?.length ? fields.filter((field) => spec.columns?.includes(field.id)) : fields
  const renderers: Record<ViewDisplay, ComponentType<Props & { visibleItems: Item[]; aggregate: unknown; groups: ReturnType<typeof groupView>; columns: FieldDef[] }>> = {
    stat: StatView,
    line: LineView,
    bar: BarView,
    donut: DonutView,
    table: TableView,
    cards: CardsView,
    gallery: GalleryView,
    list: ListView,
    timeline: TimelineView,
    board: BoardView,
    calendar: CalendarView,
  }
  const Renderer = renderers[spec.display]
  return <Card className="h-full min-w-0 p-4"><div className="mb-3 flex items-start justify-between gap-3"><h3 className="text-sm font-medium">{spec.title}</h3><span className="text-xs text-muted-foreground">{visibleItems.length}</span></div><Renderer spec={spec} items={items} fields={fields} visibleItems={visibleItems} aggregate={aggregate} groups={groups} columns={columns} /></Card>
}

type RenderProps = Props & { visibleItems: Item[]; aggregate: unknown; groups: ReturnType<typeof groupView>; columns: FieldDef[] }
function StatView({ spec, aggregate, fields }: RenderProps) {
  const field = fields.find((item) => item.id === spec.aggregate?.fieldId)
  return <p className="text-3xl font-semibold tracking-tight tabular-nums">{format(aggregate, field)}</p>
}
function BarView({ groups }: RenderProps) {
  const max = Math.max(1, ...groups.map((group) => Number(group.value) || 0))
  return <div className="flex min-h-36 items-end gap-2 overflow-x-auto pb-1">{groups.map((group) => <div key={group.name} className="flex min-w-8 flex-1 flex-col items-center gap-2"><div className="w-full rounded-t bg-primary/75" style={{ height: `${Math.max(4, (Number(group.value) / max) * 112)}px` }} title={`${group.name}: ${group.value}`} /><span className="max-w-16 truncate text-[10px] text-muted-foreground">{group.name}</span></div>)}</div>
}
function LineView({ groups }: RenderProps) {
  const max = Math.max(1, ...groups.map((group) => Number(group.value) || 0))
  const points = groups.map((group, index) => `${groups.length < 2 ? 50 : (index / (groups.length - 1)) * 100},${96 - (Number(group.value) / max) * 84}`).join(' ')
  return <div className="min-h-36"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-28 w-full overflow-visible" role="img" aria-label={`${specTitle(groups)} trend`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" /></svg><div className="flex justify-between gap-2 text-[10px] text-muted-foreground">{groups.filter((_, index) => index === 0 || index === groups.length - 1).map((group) => <span key={group.name}>{group.name}</span>)}</div></div>
}
function specTitle(groups: ReturnType<typeof groupView>) { return groups.map((group) => group.name).join(', ') || 'Data' }
function DonutView({ groups }: RenderProps) {
  const total = groups.reduce((sum, group) => sum + Math.max(0, Number(group.value) || 0), 0)
  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
  const segments = groups.reduce<{ stops: string[]; offset: number }>((result, group, index) => {
    const start = result.offset
    const offset = start + (total ? Math.max(0, Number(group.value) || 0) / total * 100 : 0)
    result.stops.push(`${colors[index % colors.length]} ${start}% ${offset}%`)
    result.offset = offset
    return result
  }, { stops: [], offset: 0 }).stops
  return <div className="flex items-center gap-4"><div role="img" aria-label="Grouped values" className="size-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${segments.join(', ')})` }} /><ul className="flex min-w-0 flex-col gap-1">{groups.map((group, index) => <li key={group.name} className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full" style={{ background: colors[index % colors.length] }} /> <span className="truncate">{group.name}</span><span className="ml-auto tabular-nums">{format(group.value)}</span></li>)}</ul></div>
}
function TableView({ visibleItems, columns }: RenderProps) {
  return <div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Name</th>{columns.map((field) => <th key={field.id} className="py-2 pr-3 font-medium">{field.name}</th>)}</tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id} className="border-t border-border/70"><td className="max-w-40 truncate py-2 pr-3 font-medium">{item.title}</td>{columns.map((field) => <td key={field.id} className="max-w-40 truncate py-2 pr-3 text-muted-foreground">{format(item.data[field.id], field)}</td>)}</tr>)}</tbody></table></div>
}
function CardsView({ visibleItems, columns }: RenderProps) { return <div className="grid gap-2 sm:grid-cols-2">{visibleItems.map((item) => <article key={item.id} className="rounded-lg border border-border p-3"><h4 className="text-sm font-medium">{item.title}</h4>{columns.slice(0, 3).map((field) => <p key={field.id} className="mt-1 text-xs text-muted-foreground">{field.name}: {format(item.data[field.id], field)}</p>)}</article>)}</div> }
function GalleryView({ visibleItems, columns }: RenderProps) { const imageField = columns.find((field) => field.type === 'image'); return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleItems.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-border"><div className="grid aspect-[4/3] place-items-center bg-muted">{imageField && typeof item.data[imageField.id] === 'string' ? <img src={String(item.data[imageField.id])} alt={item.title} className="size-full object-cover" /> : <span className="text-xs text-muted-foreground">{item.title}</span>}</div><p className="truncate p-2 text-xs font-medium">{item.title}</p></article>)}</div> }
function ListView({ visibleItems }: RenderProps) { return <ul className="flex flex-col divide-y divide-border">{visibleItems.map((item) => <li key={item.id} className="py-2 text-sm">{item.title}</li>)}</ul> }
function TimelineView({ visibleItems }: RenderProps) { return <ol className="flex flex-col gap-3">{visibleItems.map((item) => <li key={item.id} className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /><div><p className="text-sm font-medium">{item.title}</p><time className="text-xs text-muted-foreground">{new Date(item.occurredAt ?? item.createdAt).toLocaleDateString()}</time></div></li>)}</ol> }
function BoardView({ groups }: RenderProps) { return <div className="flex gap-2 overflow-x-auto">{groups.map((group) => <section key={group.name} className="min-w-40 flex-1 rounded-lg bg-muted/50 p-2"><h4 className="mb-2 text-xs font-medium">{group.name}</h4>{group.items.map((item) => <p key={item.id} className="mb-1 rounded border border-border bg-card p-2 text-xs">{item.title}</p>)}</section>)}</div> }
function CalendarView({ groups }: RenderProps) { return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{groups.map((group) => <section key={group.name} className="rounded-lg border border-border p-3"><h4 className="mb-2 text-xs font-semibold">{group.name}</h4>{group.items.map((item) => <p key={item.id} className="py-1 text-xs">{item.title}</p>)}</section>)}</div> }
