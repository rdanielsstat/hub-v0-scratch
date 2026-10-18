import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Archive, BookOpen, CalendarDays, CirclePlus, Compass, LayoutDashboard, ListChecks, NotebookPen, Sparkles, Columns3 } from 'lucide-react'
import type { Area, AreaStartFrom } from '@/services/api'
import { areasApi } from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

const templates: Array<{ id: AreaStartFrom; name: string; description: string; icon: typeof NotebookPen }> = [
  { id: 'blank', name: 'Blank', description: 'A clear space, ready to shape.', icon: NotebookPen },
  { id: 'dashboard', name: 'Dashboard', description: 'A page to arrange useful views.', icon: LayoutDashboard },
  { id: 'collection', name: 'Collection', description: 'A structured set of entries.', icon: Archive },
  { id: 'journal', name: 'Journal', description: 'A quiet place for notes.', icon: BookOpen },
  { id: 'tracker', name: 'Tracker', description: 'Record measures over time.', icon: Activity },
  { id: 'routine', name: 'Routine', description: 'Keep repeatable steps together.', icon: ListChecks },
  { id: 'wiki', name: 'Wiki', description: 'Organize notes and references.', icon: Sparkles },
  { id: 'board', name: 'Board', description: 'Group work into flexible columns.', icon: Columns3 },
  { id: 'calendar', name: 'Calendar', description: 'Capture entries around dates.', icon: CalendarDays },
]

export function AreasDashboardPage() {
  const navigate = useNavigate()
  const loadAreas = useCallback(() => areasApi.listAreas(), [])
  const resource = useApiResource<Area[]>(loadAreas, 'areas-index')
  const [createOpen, setCreateOpen] = useState(false)
  const [startFrom, setStartFrom] = useState<AreaStartFrom | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  async function createArea() {
    if (!startFrom || !name.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const area = await areasApi.createArea({ name: name.trim(), startFrom })
      setCreateOpen(false)
      setName('')
      setStartFrom(null)
      navigate(`/area/${area.id}`)
    } catch { setCreateError('Could not create this area. Try again.') }
    finally { setCreating(false) }
  }
  const sortedAreas = [...(resource.data ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return <div className="mx-auto max-w-4xl">
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Ongoing spaces</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Areas</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">The parts of life you tend, return to, and keep learning from.</p></div><Button size="sm" onClick={() => setCreateOpen(true)}><CirclePlus />New area</Button></header>
    {resource.loading ? <div aria-label="Loading areas" className="flex flex-col gap-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border bg-muted/40" />)}</div> : resource.error ? <EmptyState icon={Compass} tone="danger" title="Could not load areas" message={resource.error.message} action={<Button variant="outline" onClick={() => void resource.refresh()}>Try again</Button>} /> : sortedAreas.length ? <ul className="divide-y divide-border rounded-xl border border-border">{sortedAreas.map((area) => <AreaRow key={area.id} area={area} />)}</ul> : <EmptyState icon={Compass} title="No areas yet" message="Start a calm space for something you want to keep tending." action={<Button onClick={() => setCreateOpen(true)}>Create your first area</Button>} />}
    <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New area"><DialogHeader title="New area" description="Choose a starting template. Every part can be changed later." /><DialogBody className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{templates.map((option) => { const Icon = option.icon; const selected = startFrom === option.id; return <button key={option.id} type="button" aria-pressed={selected} onClick={() => { setStartFrom(option.id); setName((current) => current || option.name) }} className={cn('flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected ? 'border-primary bg-primary/5' : 'border-border')}><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span><span className="flex min-w-0 flex-col gap-1"><span className="text-sm font-medium">{option.name}</span><span className="text-xs text-muted-foreground">{option.description}</span></span></button> })}</div>{startFrom ? <label className="flex flex-col gap-1.5 text-sm font-medium">Area name<Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label> : null}{createError ? <p role="alert" className="text-sm text-destructive">{createError}</p> : null}</DialogBody><DialogFooter><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!startFrom || !name.trim() || creating} onClick={() => void createArea()}>{creating ? 'Creating' : 'Create area'}</Button></DialogFooter></Dialog>
  </div>
}
function AreaRow({ area }: { area: Area }) {
  return <li><Link to={`/area/${area.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm" aria-hidden="true">{area.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{area.name}</span><span className="block truncate text-xs text-muted-foreground">{area.description}</span></span><span className="text-xs text-muted-foreground">{area.collectionIds.length} collections</span></Link></li>
}
