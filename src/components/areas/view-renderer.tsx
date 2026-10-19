import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  ExternalLink,
  Image as ImageIcon,
  Table2,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type {
  CollectionSchema,
  FieldDef,
  Item,
  ItemValue,
  ViewDisplay,
  ViewPeriod,
  ViewSpec,
} from '@/services/api'
import { aggregateView, applyViewSpec, groupView } from '@/lib/view-spec'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { FieldValue } from '@/lib/field-format'
import { formatLocalDate } from '@/lib/local-date'

interface Props {
  spec: ViewSpec
  items: Item[]
  fields: FieldDef[]
  /** The collection's money direction, for signing and coloring currency totals. */
  flow?: CollectionSchema['flow']
  onChangeSpec?: (spec: ViewSpec) => void
  showTitle?: boolean
  plain?: boolean
  compact?: boolean
}

const RechartsView = lazy(() => import('@/components/areas/view-charts'))
const periodLabels: Record<ViewPeriod, string> = {
  thisMonth: 'This month',
  last30Days: 'Last 30 days',
  '12Months': '12 months',
  allTime: 'All time',
}
export function ViewRenderer({
  spec,
  items,
  fields,
  flow,
  onChangeSpec,
  showTitle = true,
  plain = false,
  compact = false,
}: Props) {
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
  const areaId = items[0]?.areaId
  const chartKinds = ['line', 'bar', 'donut'] as const
  const asChart = chartKinds.find((kind) => kind === spec.display)
  const isChart = asChart !== undefined
  const chartDisplay = asChart ?? spec.chartType ?? 'line'
  // Only charts (or a chart switched to its table) can flip between the two;
  // a single number or a list has nothing to chart.
  const canToggleChart =
    isChart || (spec.display === 'table' && !!spec.chartType)
  const setDisplay = (display: ViewDisplay) =>
    onChangeSpec?.({
      ...spec,
      chartType:
        display === 'table' && canToggleChart ? chartDisplay : spec.chartType,
      display,
    })

  return (
    <Card
      className={`group relative h-full min-w-0 ${compact ? 'p-3' : 'p-4'} ${plain ? 'border-0 bg-transparent shadow-none' : ''}`}
    >
      <header className="mb-3 flex flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          {showTitle ? (
            <h3 className="min-w-0 flex-1 break-words text-xs font-medium leading-snug text-muted-foreground">
              {spec.title}
            </h3>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {canToggleChart && onChangeSpec ? (
              <div
                role="group"
                aria-label={`${spec.title} display`}
                className="flex"
              >
                <button
                  type="button"
                  aria-label={`${spec.title} chart view`}
                  aria-pressed={spec.display !== 'table'}
                  onClick={() => setDisplay(chartDisplay)}
                  className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
                >
                  <BarChart3 aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`${spec.title} table view`}
                  aria-pressed={spec.display === 'table'}
                  onClick={() => setDisplay('table')}
                  className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground"
                >
                  <Table2 aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {areaId ? (
              <Link
                to={`/area/${areaId}/collection/${spec.collectionId}`}
                aria-label={`Open ${spec.title} collection`}
                title="Open collection"
                className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted"
              >
                <ExternalLink aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <Renderer
        spec={{ ...spec, display: effectiveDisplay }}
        items={items}
        fields={fields}
        flow={flow}
        visibleItems={visibleItems}
        aggregate={aggregate}
        groups={groups}
        columns={columns}
      />
      {spec.period && onChangeSpec ? (
        <Select
          aria-label={`${spec.title} period`}
          value={spec.period}
          onChange={(event) =>
            onChangeSpec({ ...spec, period: event.target.value as ViewPeriod })
          }
          containerClassName="mt-2 w-fit"
          className="h-7 w-auto min-w-0 border-0 bg-transparent pl-1 pr-7 text-xs text-muted-foreground focus-visible:ring-1"
        >
          {Object.entries(periodLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      ) : null}
    </Card>
  )
}

type RenderProps = Props & {
  visibleItems: Item[]
  aggregate: unknown
  groups: ReturnType<typeof groupView>
  columns: FieldDef[]
}

const currencyParts = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function StatView({ aggregate, fields, spec, flow }: RenderProps) {
  const field = fields.find((item) => item.id === spec.aggregate?.fieldId)
  if (field?.type === 'currency' && typeof aggregate === 'number') {
    // "$28,180" with the cents set apart, so they can sit smaller and raised.
    const parts = currencyParts.formatToParts(Math.abs(aggregate))
    const whole = parts
      .filter((part) => part.type !== 'decimal' && part.type !== 'fraction')
      .map((part) => part.value)
      .join('')
    const cents = parts.find((part) => part.type === 'fraction')?.value ?? '00'
    const sign = flow === 'outgoing' ? '−' : flow === 'incoming' ? '+' : ''
    return (
      <p
        className={`text-3xl font-semibold tracking-tight tabular-nums ${flow === 'incoming' ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
      >
        <span className="sr-only">
          {currencyParts.format(flow === 'outgoing' ? -aggregate : aggregate)}
        </span>
        <span aria-hidden="true">
          {sign}
          {whole}
          <sup className="ml-0.5 align-super text-sm font-medium">.{cents}</sup>
        </span>
      </p>
    )
  }
  return (
    <p className="text-3xl font-semibold tracking-tight tabular-nums">
      <FieldValue value={aggregate as ItemValue} field={field} />
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fieldLimit, setFieldLimit] = useState(columns.length)
  useEffect(() => {
    const element = scrollRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const updateLimit = () => {
      const availableWidth = element.clientWidth
      const fittingFields = Math.max(1, Math.floor((availableWidth - 90) / 100))
      setFieldLimit(Math.min(columns.length, fittingFields))
    }
    updateLimit()
    const observer = new ResizeObserver(updateLimit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [columns.length])
  const fittedColumns = columns.slice(0, fieldLimit)
  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      aria-label="Collection entries"
      className="max-h-72 overflow-y-auto overflow-x-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full table-fixed text-left text-xs">
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr>
            <th className="whitespace-normal break-words py-2 pr-2 font-medium">
              Name
            </th>
            {fittedColumns.map((field) => (
              <th
                key={field.id}
                className="whitespace-normal break-words py-2 pr-2 font-medium"
              >
                {field.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => (
            <tr key={item.id} className="border-t border-border/70">
              <td className="whitespace-normal break-words py-2 pr-2 font-medium">
                {item.title}
              </td>
              {fittedColumns.map((field) => (
                <td
                  key={field.id}
                  className="whitespace-normal break-words py-2 pr-2 text-muted-foreground"
                >
                  <FieldValue value={item.data[field.id]} field={field} />
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
            <p
              key={field.id}
              className="mt-1 break-words text-xs text-muted-foreground"
            >
              <span>{field.name}: </span>
              <FieldValue value={item.data[field.id]} field={field} />
            </p>
          ))}
        </article>
      ))}
    </div>
  )
}

function GalleryView({ visibleItems, columns }: RenderProps) {
  const imageField = columns.find((field) => field.type === 'image')
  const displayedImages = new Set<string>()
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visibleItems.map((item) => {
        const image = imageField ? item.data[imageField.id] : undefined
        const imageUrl =
          typeof image === 'string' && image && !displayedImages.has(image)
            ? image
            : null
        if (imageUrl) displayedImages.add(imageUrl)
        return (
          <article
            key={item.id}
            className="overflow-hidden rounded-lg border border-border"
          >
            <div className="grid aspect-[4/3] place-items-center bg-muted">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 px-3 text-center text-xs text-muted-foreground">
                  <ImageIcon aria-hidden="true" className="size-8 opacity-50" />
                  <span className="break-words">{item.title}</span>
                </div>
              )}
            </div>
            <p className="break-words p-2 text-xs font-medium">{item.title}</p>
          </article>
        )
      })}
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
              {formatLocalDate(
                item.occurredAt ?? item.createdAt,
                (item.occurredAt ?? item.createdAt).includes('T'),
              )}
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
