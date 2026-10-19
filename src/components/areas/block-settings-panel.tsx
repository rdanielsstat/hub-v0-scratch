import { X } from 'lucide-react'
import type {
  Block,
  CollectionSchema,
  ViewDisplay,
  ViewPeriod,
  ViewSpec,
} from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { usePanelEscape } from '@/components/areas/use-panel-escape'

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

/** Side panel for one block: its title, and for views, what they show. */
export function BlockSettings({
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
