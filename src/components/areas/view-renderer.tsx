import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ComponentType } from 'react'
import type {
  FieldDef,
  Item,
  ViewDisplay,
  ViewPeriod,
  ViewSpec,
} from '@/services/api'
import { aggregateView, applyViewSpec, groupView } from '@/lib/view-spec'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'

interface Props {
  spec: ViewSpec
  items: Item[]
  fields: FieldDef[]
  onChangeSpec?: (spec: ViewSpec) => void
}

const RechartsView = lazy(() => import('@/components/areas/view-charts'))
const periodLabels: Record<ViewPeriod, string> = {
  thisMonth: 'This month',
  last30Days: 'Last 30 days',
  '12Months': '12 months',
  allTime: 'All time',
}
const format = (value: unknown, field?: FieldDef) => {
  if (value === null || value === undefined || value === '') return 'Not set'
  if (field?.type === 'currency' && typeof value === 'number')
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  return `${String(value)}${field?.unit ? ` ${field.unit}` : ''}`
}

export function ViewRenderer({ spec, items, fields, onChangeSpec }: Props) {
  const visibleItems = applyViewSpec(spec, items)
  const aggregate = aggregateView(spec, visibleItems)
  const groups = groupView(spec, visibleItems)
  const columns = spec.columns?.length
    ? fields.filter((field) => spec.columns?.includes(field.id))
    : fields
  const effectiveDisplay = spec.display
  const renderers: Record<ViewDisplay, ComponentType<RenderProps>> = {
    stat: StatView,
    line: ChartView,
    bar: ChartView,
    donut: ChartView,
    table: TableView,
    cards: CardsView,
    gallery: GalleryView,
    list: ListView,
    timeline: TimelineView,
    board: BoardView,
    calendar: CalendarView,
  }
  const Renderer = renderers[effectiveDisplay]
  const collection = items[0]
  const areaId = collection?.areaId

  return (
    <Card className="group relative h-full min-w-0 p-4">
      <div className="mb-3 flex min-w-0 items-center gap-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
          {spec.title}
        </h3>
        {spec.period && onChangeSpec ? (
          <Select
            aria-label={`${spec.title} period`}
            value={spec.period}
            onChange={(event) =>
              onChangeSpec({
                ...spec,
                period: event.target.value as ViewPeriod,
              })
            }
            className="h-7 w-auto max-w-32 border-0 bg-transparent px-1 text-xs text-muted-foreground focus-visible:ring-1"
          >
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}
        {areaId ? (
          <Link
            to={`/area/${areaId}/collection/${spec.collectionId}`}
            className="shrink-0 rounded px-1.5 py-1 text-xs text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            Open
          </Link>
        ) : null}
      </div>
      <Renderer
        spec={{ ...spec, display: effectiveDisplay }}
        items={items}
        fields={fields}
        visibleItems={visibleItems}
        aggregate={aggregate}
        groups={groups}
        columns={columns}
      />
    </Card>
  )
}

type RenderProps = Props & {
  visibleItems: Item[]
  aggregate: unknown
  groups: ReturnType<typeof groupView>
  columns: FieldDef[]
}

function StatView({ spec, aggregate, fields }: RenderProps) {
  const field = fields.find((item) => item.id === spec.aggregate?.fieldId)
  return (
    <p className="text-3xl font-semibold tracking-tight tabular-nums">
      {format(aggregate, field)}
    </p>
  )
}

function ChartView({ spec, groups }: RenderProps) {
  return (
    <Suspense
      fallback={
        <div
          aria-label="Loading chart"
          className="h-52 animate-pulse rounded-lg bg-muted/40"
        />
      }
    >
      <RechartsView
        display={spec.chartType ?? spec.display}
        groups={groups.map((group) => ({
          name: group.name,
          value:
            typeof group.value === 'string' || typeof group.value === 'number'
              ? group.value
              : null,
        }))}
        title={spec.title}
      />
    </Suspense>
  )
}

function TableView({ visibleItems, columns }: RenderProps) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Name</th>
            {columns.map((field) => (
              <th key={field.id} className="py-2 pr-3 font-medium">
                {field.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => (
            <tr key={item.id} className="border-t border-border/70">
              <td className="max-w-40 truncate py-2 pr-3 font-medium">
                {item.title}
              </td>
              {columns.map((field) => (
                <td
                  key={field.id}
                  className="max-w-40 truncate py-2 pr-3 text-muted-foreground"
                >
                  {format(item.data[field.id], field)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsView({ visibleItems, columns }: RenderProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleItems.map((item) => (
        <article key={item.id} className="rounded-lg border border-border p-3">
          <h4 className="text-sm font-medium">{item.title}</h4>
          {columns.slice(0, 3).map((field) => (
            <p key={field.id} className="mt-1 text-xs text-muted-foreground">
              {field.name}: {format(item.data[field.id], field)}
            </p>
          ))}
        </article>
      ))}
    </div>
  )
}

function GalleryView({ visibleItems, columns }: RenderProps) {
  const imageField = columns.find((field) => field.type === 'image')
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visibleItems.map((item) => (
        <article
          key={item.id}
          className="overflow-hidden rounded-lg border border-border"
        >
          <div className="grid aspect-[4/3] place-items-center bg-muted">
            {imageField && typeof item.data[imageField.id] === 'string' ? (
              <img
                src={String(item.data[imageField.id])}
                alt={item.title}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                {item.title}
              </span>
            )}
          </div>
          <p className="truncate p-2 text-xs font-medium">{item.title}</p>
        </article>
      ))}
    </div>
  )
}

function ListView({ visibleItems }: RenderProps) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {visibleItems.map((item) => (
        <li key={item.id} className="py-2 text-sm">
          {item.title}
        </li>
      ))}
    </ul>
  )
}

function TimelineView({ visibleItems }: RenderProps) {
  return (
    <ol className="flex flex-col gap-3">
      {visibleItems.map((item) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          <div>
            <p className="text-sm font-medium">{item.title}</p>
            <time className="text-xs text-muted-foreground">
              {new Date(item.occurredAt ?? item.createdAt).toLocaleDateString()}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}

function BoardView({ groups }: RenderProps) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {groups.map((group) => (
        <section
          key={group.name}
          className="min-w-40 flex-1 rounded-lg bg-muted/50 p-2"
        >
          <h4 className="mb-2 text-xs font-medium">{group.name}</h4>
          {group.items.map((item) => (
            <p
              key={item.id}
              className="mb-1 rounded border border-border bg-card p-2 text-xs"
            >
              {item.title}
            </p>
          ))}
        </section>
      ))}
    </div>
  )
}

function CalendarView({ visibleItems, fields }: RenderProps) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  )
  const firstWeekday = month.getDay()
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate()
  const dateField = fields.find(
    (field) => field.type === 'date' || field.type === 'datetime',
  )
  const dayItems = new Map<number, Item[]>()
  for (const item of visibleItems) {
    const rawDate = dateField
      ? item.data[dateField.id]
      : (item.occurredAt ?? item.createdAt)
    const date = new Date(`${String(rawDate).slice(0, 10)}T00:00:00`)
    if (
      date.getFullYear() === month.getFullYear() &&
      date.getMonth() === month.getMonth()
    ) {
      const day = date.getDate()
      dayItems.set(day, [...(dayItems.get(day) ?? []), item])
    }
  }
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : index - firstWeekday + 1,
  )
  const monthName = month.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const moveMonth = (delta: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    )
  const mobileItems = [...visibleItems]
    .filter((item) => {
      const rawDate = dateField
        ? item.data[dateField.id]
        : (item.occurredAt ?? item.createdAt)
      const date = new Date(`${String(rawDate).slice(0, 10)}T00:00:00`)
      return (
        date.getFullYear() === month.getFullYear() &&
        date.getMonth() === month.getMonth()
      )
    })
    .sort((a, b) =>
      String(
        a.data[dateField?.id ?? ''] ?? a.occurredAt ?? a.createdAt,
      ).localeCompare(
        String(b.data[dateField?.id ?? ''] ?? b.occurredAt ?? b.createdAt),
      ),
    )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => moveMonth(-1)}
          className="rounded px-2 py-1 text-sm hover:bg-muted"
        >
          ‹
        </button>
        <h4 className="text-sm font-medium">{monthName}</h4>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => moveMonth(1)}
          className="rounded px-2 py-1 text-sm hover:bg-muted"
        >
          ›
        </button>
      </div>
      <div className="hidden grid-cols-7 gap-1 md:grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span
            key={day}
            className="py-1 text-center text-[10px] text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {days.map((day, index) => (
          <div
            key={index}
            className="min-h-16 rounded border border-border/60 p-1 text-xs"
          >
            {day ? (
              <>
                <span className="text-muted-foreground">{day}</span>
                {(dayItems.get(day) ?? []).slice(0, 2).map((item) => (
                  <p
                    key={item.id}
                    className="mt-1 truncate rounded bg-primary/10 px-1 py-0.5 text-[10px]"
                    title={item.title}
                  >
                    {item.title}
                  </p>
                ))}
              </>
            ) : null}
          </div>
        ))}
      </div>
      <ol className="flex flex-col divide-y divide-border md:hidden">
        {mobileItems.length ? (
          mobileItems.map((item) => (
            <li key={item.id} className="flex gap-3 py-2">
              <time className="w-12 shrink-0 text-xs text-muted-foreground">
                {new Date(
                  `${String(item.data[dateField?.id ?? ''] ?? item.occurredAt ?? item.createdAt).slice(0, 10)}T00:00:00`,
                ).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
              <span className="text-sm">{item.title}</span>
            </li>
          ))
        ) : (
          <li className="py-4 text-center text-sm text-muted-foreground">
            No entries this month
          </li>
        )}
      </ol>
    </div>
  )
}
