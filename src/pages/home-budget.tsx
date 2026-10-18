import { lazy, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import useSWR from 'swr'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  GripVertical,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import type {
  Block,
  CollectionSchema,
  Item,
  ViewDisplay,
  ViewPeriod,
} from '@/services/api'
import { areasApi, blocksApi, collectionsApi } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const SpendingChart = lazy(() =>
  import('./budget-charts').then((module) => ({
    default: module.SpendingChart,
  })),
)
const DonutChart = lazy(() =>
  import('./budget-charts').then((module) => ({ default: module.DonutChart })),
)

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const numberCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})
const periodLabels: Record<ViewPeriod, string> = {
  thisMonth: 'This month',
  last30Days: 'Last 30 days',
  '12Months': '12 months',
  allTime: 'All time',
}

interface BudgetData {
  area: Awaited<ReturnType<typeof areasApi.getArea>>
  blocks: Block[]
  purchases: Item[]
  investments: Item[]
  collections: CollectionSchema[]
}

async function loadBudget(): Promise<BudgetData> {
  const [area, blocks, purchases, investments, collections] = await Promise.all(
    [
      areasApi.getArea('home-budget'),
      blocksApi.listBlocks('home-budget'),
      collectionsApi.listCollectionItems('purchases'),
      collectionsApi.listCollectionItems('investments'),
      collectionsApi.listCollections('home-budget'),
    ],
  )
  return { area, blocks, purchases, investments, collections }
}

function dateWithinPeriod(dateValue: string, period: ViewPeriod) {
  if (period === 'allTime') return true
  const date = new Date(dateValue)
  const now = new Date()
  if (period === 'thisMonth')
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    )
  const days = period === 'last30Days' ? 30 : 365
  return now.getTime() - date.getTime() <= days * 86400000
}

function getAmount(item: Item) {
  return typeof item.data.amount === 'number' ? item.data.amount : 0
}

function getDate(item: Item) {
  return String(item.data.date ?? item.occurredAt ?? item.createdAt)
}

function countForPeriod(items: Item[], period: ViewPeriod) {
  return items.filter((item) => dateWithinPeriod(getDate(item), period))
}

function GridClass({ size, children }: { size?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'min-w-0',
        size === 'wide' && 'sm:col-span-2 lg:col-span-4',
        size === 'medium' && 'sm:col-span-1 lg:col-span-2',
        size === 'tall' && 'row-span-2',
      )}
    >
      {children}
    </div>
  )
}

function LoadingBudget() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Loading Home Budget"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-xl border border-border bg-muted/40"
        />
      ))}
    </div>
  )
}

export function HomeBudgetPage() {
  const { areaId = 'home-budget' } = useParams()
  const { data, error, isLoading, mutate } = useSWR(
    `area-${areaId}`,
    loadBudget,
  )
  const [customize, setCustomize] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const orderedBlocks = useMemo(
    () => [...(data?.blocks ?? [])].sort((a, b) => a.order - b.order),
    [data?.blocks],
  )
  const selectedBlock = orderedBlocks.find(
    (block) => block.id === selectedId && block.type === 'view',
  )
  const selectedView =
    selectedBlock?.type === 'view' ? selectedBlock.view : null

  async function updateBlock(block: Block) {
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              blocks: current.blocks.map((entry) =>
                entry.id === block.id ? block : entry,
              ),
            }
          : current,
      { revalidate: false },
    )
    await blocksApi.saveBlock(block)
  }

  async function removeBlock(block: Block) {
    await blocksApi.removeBlock(block.id)
    await mutate(
      (current) =>
        current
          ? {
              ...current,
              blocks: current.blocks.filter((entry) => entry.id !== block.id),
            }
          : current,
      { revalidate: false },
    )
    if (selectedId === block.id) setSelectedId(null)
  }

  async function moveBlock(fromId: string, toId: string) {
    if (fromId === toId) return
    const next = [...orderedBlocks]
    const fromIndex = next.findIndex((block) => block.id === fromId)
    const toIndex = next.findIndex((block) => block.id === toId)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    next.forEach((block, order) => {
      block.order = order
    })
    await mutate(
      (current) => (current ? { ...current, blocks: next } : current),
      { revalidate: false },
    )
    await blocksApi.saveBlockOrder(
      'home-budget',
      next.map((block) => block.id),
    )
  }

  async function addTile(display: ViewDisplay) {
    if (!data?.collections.length) return
    const collection =
      display === 'chart' ? data.collections[0] : data.collections[0]
    const id = `custom-view-${crypto.randomUUID()}`
    const nextOrder = orderedBlocks.length
    const block: Block = {
      id,
      areaId: 'home-budget',
      type: 'view',
      order: nextOrder,
      size: display === 'table' ? 'wide' : 'medium',
      view: {
        id,
        title: `New ${display}`,
        collectionId: collection.id,
        display,
        filter: [],
        period: 'thisMonth',
        aggregate: { operation: 'sum', fieldId: collection.fields[0]?.id },
        limit: 10,
        columns: collection.fields.slice(0, 4).map((field) => field.id),
        chartType: 'line',
        size: display === 'table' ? 'wide' : 'medium',
      },
    }
    await blocksApi.saveBlock(block)
    await mutate(
      (current) =>
        current ? { ...current, blocks: [...current.blocks, block] } : current,
      { revalidate: false },
    )
    setSelectedId(block.id)
  }

  function changeView(patch: Partial<typeof selectedView>) {
    if (!selectedBlock || selectedBlock.type !== 'view' || !selectedView) return
    const next: Block = {
      ...selectedBlock,
      view: { ...selectedView, ...patch },
    }
    void updateBlock(next)
  }

  if (isLoading) return <LoadingBudget />
  if (error)
    return (
      <EmptyState
        icon={Settings2}
        variant="page"
        tone="danger"
        title="Couldn’t load this area"
        message={error.message || 'Try again in a moment.'}
        action={
          <Button variant="outline" onClick={() => void mutate()}>
            Try again
          </Button>
        }
      />
    )
  if (!data?.area)
    return (
      <EmptyState
        icon={Settings2}
        variant="page"
        title="Area not found"
        message="This space may have been removed."
        action={
          <Button variant="outline" render={<Link to="/areas" />}>
            Back to Areas
          </Button>
        }
      />
    )

  const purchaseItems = data.purchases.filter(
    (item) => item.collectionId === 'purchases',
  )
  const investmentItems = data.investments
  const totalSpend = (period: ViewPeriod) =>
    countForPeriod(purchaseItems, period).reduce(
      (total, item) => total + getAmount(item),
      0,
    )
  const chartRows = Array.from({ length: 12 }, (_, offset) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (11 - offset))
    const year = date.getFullYear()
    const month = date.getMonth()
    const total = purchaseItems.reduce((sum, item) => {
      const itemDate = new Date(getDate(item))
      return itemDate.getFullYear() === year && itemDate.getMonth() === month
        ? sum + getAmount(item)
        : sum
    }, 0)
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      total: Math.round(total),
    }
  })
  const accountRows = investmentItems.map((item) => ({
    name: String(item.data.account ?? item.title),
    value: Number(item.data.value ?? 0),
  }))
  const categoryTotals = new Map<string, number>()
  purchaseItems.forEach((item) => {
    const category = String(item.data.category ?? 'Other')
    categoryTotals.set(
      category,
      (categoryTotals.get(category) ?? 0) + getAmount(item),
    )
  })
  const categoryRows = [...categoryTotals.entries()].map(([name, value]) => ({
    name,
    value,
  }))
  const recent = [...purchaseItems]
    .sort((a, b) => getDate(b).localeCompare(getDate(a)))
    .slice(0, 15)

  function renderTile(block: Block) {
    if (block.type !== 'view') return null
    const view = block.view
    const title = view.title
    const period = view.period ?? 'thisMonth'
    const selectedItems =
      view.collectionId === 'investments' ? investmentItems : purchaseItems
    const isSelected = selectedId === block.id
    const blockIndex = orderedBlocks.findIndex((entry) => entry.id === block.id)
    const currentTotal = totalSpend(period)
    const previousItems = purchaseItems.filter((item) => {
      const date = new Date(getDate(item))
      const now = new Date()
      return period === 'thisMonth'
        ? date.getMonth() === (now.getMonth() + 11) % 12 &&
            date.getFullYear() ===
              now.getFullYear() - (now.getMonth() === 0 ? 1 : 0)
        : Date.now() - date.getTime() > 30 * 86400000 &&
            Date.now() - date.getTime() <= 60 * 86400000
    })
    const previousTotal = previousItems.reduce(
      (sum, item) => sum + getAmount(item),
      0,
    )
    const compare = previousTotal
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
      : 0
    const amount =
      view.id === 'income' ? 6420 : view.id === 'taxes' ? 1284 : currentTotal
    const periodSelector =
      view.display === 'stat' || view.display === 'chart' ? (
        <label className="sr-only">
          {title} period
          <select
            aria-label={`${title} period`}
            value={period}
            onChange={(event) =>
              changeView({ period: event.target.value as ViewPeriod })
            }
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null

    return (
      <GridClass key={block.id} size={view.size ?? block.size}>
        <Card
          className={cn(
            'h-full min-w-0 transition-colors',
            customize && 'border-dashed',
            isSelected && customize && 'border-primary ring-1 ring-primary/30',
          )}
          draggable={customize}
          onDragStart={() => setDraggedId(block.id)}
          onDragOver={(event) => {
            if (customize) event.preventDefault()
          }}
          onDrop={() => {
            if (customize && draggedId) void moveBlock(draggedId, block.id)
            setDraggedId(null)
          }}
        >
          <CardHeader className="flex-row items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              {customize ? (
                <GripVertical
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                  aria-label="Drag to reorder"
                />
              ) : null}
              <CardTitle className="truncate text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {periodSelector}
              <Link
                to={`/area/home-budget/collection/${view.collectionId}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open ${title}`}
              >
                Open <ArrowUpRight className="size-3" />
              </Link>
              {customize ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Settings for ${title}`}
                  onClick={() => setSelectedId(block.id)}
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5">
            {view.display === 'stat' ? (
              <div className="flex flex-col gap-2">
                <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                  {currency.format(amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {view.id === 'income'
                    ? 'Income received'
                    : view.id === 'taxes'
                      ? 'Estimated set-aside'
                      : 'Across household purchases'}
                </p>
                <p
                  className={cn(
                    'text-xs tabular-nums',
                    compare <= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground',
                  )}
                >
                  {compare <= 0
                    ? `${Math.abs(compare)}% less`
                    : `${compare}% more`}{' '}
                  than previous period
                </p>
              </div>
            ) : view.display === 'chart' && view.chartType === 'donut' ? (
              <Suspense
                fallback={
                  <div
                    className="h-44 animate-pulse rounded-lg bg-muted/40"
                    aria-label="Loading donut chart"
                  />
                }
              >
                <DonutChart
                  rows={
                    view.collectionId === 'investments'
                      ? accountRows
                      : categoryRows
                  }
                  title={title}
                />
              </Suspense>
            ) : view.display === 'chart' ? (
              <Suspense
                fallback={
                  <div
                    className="h-56 animate-pulse rounded-lg bg-muted/40"
                    aria-label="Loading spending chart"
                  />
                }
              >
                <SpendingChart
                  rows={chartRows}
                  chartType={view.chartType === 'line' ? 'line' : 'bar'}
                />
              </Suspense>
            ) : view.display === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      {[
                        'Purchase',
                        'Category',
                        'Amount',
                        'Date',
                        'Related item',
                      ].map((heading) => (
                        <th key={heading} className="px-2 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.slice(0, view.limit ?? 15).map((item) => {
                      const reference = item.data.reference
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="max-w-36 truncate px-2 py-2.5 font-medium">
                            {String(item.data.merchant ?? item.title)}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {String(item.data.category ?? 'Other')}
                          </td>
                          <td className="px-2 py-2.5 tabular-nums">
                            {numberCurrency.format(getAmount(item))}
                          </td>
                          <td className="px-2 py-2.5 text-muted-foreground">
                            {new Date(getDate(item)).toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric' },
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            {typeof reference === 'object' &&
                            reference !== null &&
                            !Array.isArray(reference) ? (
                              <Link
                                to="/area/personal-inventory/collection/inventory"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                {reference.title}
                                <ArrowUpRight className="size-3" />
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedItems.slice(0, view.limit ?? 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0"
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {numberCurrency.format(
                        Number(item.data.value ?? item.data.amount ?? 0),
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {customize ? (
            <div className="flex items-center justify-between border-t border-border/70 px-4 py-2">
              <span className="text-xs text-muted-foreground">
                Move or adjust this view
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${title} up`}
                  disabled={blockIndex === 0}
                  onClick={() =>
                    void moveBlock(
                      block.id,
                      orderedBlocks[blockIndex - 1]?.id ?? block.id,
                    )
                  }
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Move ${title} down`}
                  disabled={blockIndex === orderedBlocks.length - 1}
                  onClick={() =>
                    void moveBlock(
                      block.id,
                      orderedBlocks[blockIndex + 1]?.id ?? block.id,
                    )
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${title}`}
                  onClick={() => void removeBlock(block)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </GridClass>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            to="/areas"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All areas
          </Link>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Your ongoing picture
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Home Budget
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              A steady look at the household, without turning it into a chore.
            </p>
          </div>
        </div>
        <Button
          variant={customize ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setCustomize((value) => !value)
            setSelectedId(null)
          }}
        >
          <Settings2 data-icon="inline-start" />
          {customize ? 'Done customizing' : 'Customize'}
        </Button>
      </div>

      {customize ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] p-3">
          <span className="mr-1 text-sm font-medium">Add to this area</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void addTile('stat')}
          >
            <Plus /> Stat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void addTile('chart')}
          >
            <Plus /> Chart
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void addTile('table')}
          >
            <Plus /> Table
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void addTile('gallery')}
          >
            <Plus /> Gallery
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Select a tile to edit its settings.
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4',
          customize && selectedView && 'xl:grid-cols-[minmax(0,1fr)_18rem]',
        )}
      >
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4 xl:col-span-1">
          {orderedBlocks.map(renderTile)}
          {orderedBlocks.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <EmptyState
                icon={Settings2}
                title="Nothing on this dashboard yet"
                message="Use Customize to add a view when you are ready."
              />
            </div>
          ) : null}
        </div>
        {customize && selectedView && selectedBlock?.type === 'view' ? (
          <aside
            className="rounded-xl border border-border bg-card p-4 xl:sticky xl:top-20"
            aria-label="Tile settings"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Selected view</p>
                <h2 className="font-semibold">Settings</h2>
              </div>
              <Settings2 className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Title
                <Input
                  value={selectedView.title}
                  onChange={(event) =>
                    changeView({ title: event.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Collection
                <select
                  value={selectedView.collectionId}
                  onChange={(event) => {
                    const collection = data.collections.find(
                      (entry) => entry.id === event.target.value,
                    )
                    changeView({
                      collectionId: event.target.value,
                      columns:
                        collection?.fields
                          .slice(0, 4)
                          .map((field) => field.id) ?? [],
                    })
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {data.collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Display type
                <select
                  value={selectedView.display}
                  onChange={(event) =>
                    changeView({ display: event.target.value as ViewDisplay })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {(
                    [
                      'stat',
                      'chart',
                      'table',
                      'gallery',
                      'cards',
                      'list',
                      'timeline',
                    ] as ViewDisplay[]
                  ).map((display) => (
                    <option key={display} value={display}>
                      {display[0].toUpperCase() + display.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Period
                <select
                  value={selectedView.period ?? 'thisMonth'}
                  onChange={(event) =>
                    changeView({ period: event.target.value as ViewPeriod })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(periodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Filter field
                <select
                  value={selectedView.filter[0]?.fieldId ?? ''}
                  onChange={(event) =>
                    changeView({
                      filter: [
                        {
                          fieldId: event.target.value,
                          operator:
                            selectedView.filter[0]?.operator ?? 'contains',
                          value: selectedView.filter[0]?.value,
                        },
                      ],
                    })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a field</option>
                  {data.collections
                    .find(
                      (collection) =>
                        collection.id === selectedView.collectionId,
                    )
                    ?.fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Filter rule
                <select
                  value={selectedView.filter[0]?.operator ?? 'contains'}
                  onChange={(event) =>
                    changeView({
                      filter: selectedView.filter[0]
                        ? [
                            {
                              ...selectedView.filter[0],
                              operator: event.target.value as NonNullable<
                                typeof selectedView.filter
                              >[number]['operator'],
                            },
                          ]
                        : [],
                    })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {[
                    'equals',
                    'contains',
                    'greaterThan',
                    'lessThan',
                    'isSet',
                  ].map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Filter value
                <Input
                  value={String(selectedView.filter[0]?.value ?? '')}
                  placeholder="Optional value"
                  onChange={(event) =>
                    changeView({
                      filter: selectedView.filter[0]
                        ? [
                            {
                              ...selectedView.filter[0],
                              value: event.target.value,
                            },
                          ]
                        : [],
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Group by
                <select
                  value={selectedView.groupBy ?? ''}
                  onChange={(event) =>
                    changeView({ groupBy: event.target.value || undefined })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">No grouping</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  {data.collections
                    .find(
                      (collection) =>
                        collection.id === selectedView.collectionId,
                    )
                    ?.fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Aggregate
                <select
                  value={selectedView.aggregate?.operation ?? 'sum'}
                  onChange={(event) =>
                    changeView({
                      aggregate: {
                        operation: event.target.value as NonNullable<
                          typeof selectedView.aggregate
                        >['operation'],
                        fieldId: selectedView.aggregate?.fieldId,
                      },
                    })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {['sum', 'average', 'count', 'min', 'max', 'latest'].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Aggregate field
                <select
                  value={selectedView.aggregate?.fieldId ?? ''}
                  onChange={(event) =>
                    changeView({
                      aggregate: {
                        operation: selectedView.aggregate?.operation ?? 'sum',
                        fieldId: event.target.value || undefined,
                      },
                    })
                  }
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a field</option>
                  {data.collections
                    .find(
                      (collection) =>
                        collection.id === selectedView.collectionId,
                    )
                    ?.fields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.name}
                      </option>
                    ))}
                </select>
              </label>
              {selectedView.display === 'chart' ? (
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Chart style
                  <select
                    value={selectedView.chartType ?? 'line'}
                    onChange={(event) =>
                      changeView({
                        chartType: event.target.value as NonNullable<
                          typeof selectedView.chartType
                        >,
                      })
                    }
                    className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {['line', 'bar', 'donut'].map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-xs font-medium">
                Columns
                <Input
                  value={(selectedView.columns ?? []).join(', ')}
                  placeholder="merchant, amount"
                  onChange={(event) =>
                    changeView({
                      columns: event.target.value
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Limit
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={selectedView.limit ?? 15}
                  onChange={(event) =>
                    changeView({
                      limit: Math.max(1, Number(event.target.value)),
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Tile size
                <select
                  value={selectedView.size ?? 'medium'}
                  onChange={(event) => {
                    const size = event.target.value as NonNullable<
                      typeof selectedView.size
                    >
                    void updateBlock({
                      ...selectedBlock,
                      size,
                      view: { ...selectedView, size },
                    })
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {['small', 'medium', 'wide', 'tall'].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </aside>
        ) : null}
      </div>
      {customize ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Drag a tile to reorder it, or use its settings to change the size.
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="mr-1 text-xs text-muted-foreground">Collections</span>
        {data.collections.map((collection) => (
          <Link
            key={collection.id}
            to={`/area/home-budget/collection/${collection.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collection.name}
            <ArrowUpRight className="size-3" />
          </Link>
        ))}
      </div>
    </div>
  )
}
