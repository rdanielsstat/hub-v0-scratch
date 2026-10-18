import { useState } from 'react'
import useSWR from 'swr'
import {
  Archive,
  ArrowRight,
  Activity,
  BookOpen,
  CirclePlus,
  Compass,
  LayoutDashboard,
  Mountain,
  NotebookPen,
  Sparkles,
  Sun,
  Wallet,
} from 'lucide-react'
import type { Area, AreaStartFrom } from '@/services/api'
import { areasApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from 'react-router-dom'

const starts: Array<{
  id: AreaStartFrom
  name: string
  description: string
  icon: typeof NotebookPen
}> = [
  {
    id: 'blank',
    name: 'Blank page',
    description: 'A quiet space to shape over time.',
    icon: NotebookPen,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'A landing page for tiles and collections.',
    icon: LayoutDashboard,
  },
  {
    id: 'collection',
    name: 'Collection',
    description: 'A new dataset, ready for your entries.',
    icon: Archive,
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'A calm stack of notes and reflections.',
    icon: BookOpen,
  },
]

const icons: Record<string, typeof NotebookPen> = {
  archive: Archive,
  wallet: Wallet,
  activity: Activity,
  mountain: Mountain,
  sun: Sun,
}

function relativeActivity(dateString: string) {
  const days = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 86400000,
  )
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function areaHref(area: Area) {
  if (area.id === 'home-budget') return `/area/${area.id}`
  const collectionId = area.collectionIds[0]
  return collectionId
    ? `/area/${area.id}/collection/${collectionId}`
    : `/area/${area.id}`
}

export function AreasDashboardPage() {
  const navigate = useNavigate()
  const {
    data: areas,
    error,
    isLoading,
    mutate,
  } = useSWR('areas-index', areasApi.listAreas)
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
      await mutate()
      setCreateOpen(false)
      setStartFrom(null)
      setName('')
      navigate(`/area/${area.id}`)
    } catch {
      setCreateError('Could not create this space. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  function closeCreate() {
    setCreateOpen(false)
    setStartFrom(null)
    setCreateError('')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            A place for the ongoing
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Areas
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            The parts of life you tend, return to, and keep learning from.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="w-fit">
          <CirclePlus data-icon="inline-start" />
          New area
        </Button>
      </div>

      {isLoading ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Loading areas"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Compass}
          tone="danger"
          title="Couldn’t load your areas"
          message={
            error.message || 'The preview is having trouble reaching its data.'
          }
          action={
            <Button variant="outline" onClick={() => void mutate()}>
              Try again
            </Button>
          }
        />
      ) : areas?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => {
            const Icon = icons[area.icon] ?? Sparkles
            return (
              <Link
                key={area.id}
                to={areaHref(area)}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="flex h-full min-h-52 flex-col overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-md">
                  <div
                    className={cn(
                      'flex h-20 items-end p-4',
                      area.coverTone === 'sage' &&
                        'bg-emerald-900/[0.07] dark:bg-emerald-200/[0.07]',
                      area.coverTone === 'sand' &&
                        'bg-amber-900/[0.06] dark:bg-amber-200/[0.06]',
                      area.coverTone === 'blue' &&
                        'bg-sky-900/[0.06] dark:bg-sky-200/[0.06]',
                      area.coverTone === 'clay' &&
                        'bg-orange-900/[0.07] dark:bg-orange-200/[0.07]',
                      area.coverTone === 'lavender' && 'bg-primary/[0.07]',
                    )}
                  >
                    <span className="grid size-9 place-items-center rounded-lg border border-border/70 bg-background/75 text-muted-foreground shadow-sm">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold tracking-tight">
                          {area.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {area.description}
                        </p>
                      </div>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-auto flex flex-col gap-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                      <span>{area.glance}</span>
                      <span>
                        Last active{' '}
                        {relativeActivity(area.lastActiveAt).toLowerCase()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
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

      <Dialog open={createOpen} onClose={closeCreate} title="Start from">
        <DialogHeader
          title="Start from"
          description="Choose a shape. You can change it as the area grows."
        />
        <DialogBody className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {starts.map((option) => {
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
                    'flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-primary bg-primary/5' : 'border-border',
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-medium">{option.name}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">
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
          <Button variant="ghost" onClick={closeCreate}>
            Cancel
          </Button>
          <Button
            disabled={!startFrom || !name.trim() || creating}
            onClick={() => void createArea()}
          >
            {creating ? 'Creating…' : 'Create area'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
