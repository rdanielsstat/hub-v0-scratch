import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ViewDisplay } from '@/services/api'

interface ChartGroup {
  name: string
  value: number | string | null
}

interface Props {
  display: ViewDisplay
  groups: ChartGroup[]
  title: string
}

const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]
const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

export default function ViewCharts({ display, groups, title }: Props) {
  const values = groups.map((group) => ({
    name: group.name,
    value: Number(group.value) || 0,
  }))
  const highest = values.reduce<ChartGroup | null>(
    (result, item) =>
      !result || item.value > Number(result.value) ? item : result,
    null,
  )
  const summary = values.length
    ? `${title}, ${values[0].name} to ${values[values.length - 1].name}, highest in ${highest?.name ?? 'no period'}`
    : `${title}, no data to display`

  return (
    <div className="min-w-0">
      <p className="sr-only" role="img" aria-label={summary}>
        {summary}
      </p>
      <div className="h-52 min-w-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {display === 'donut' ? (
            <PieChart>
              <Pie
                data={values}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {values.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => numberFormat.format(Number(value))}
              />
            </PieChart>
          ) : display === 'line' ? (
            <LineChart
              data={values}
              margin={{ top: 8, right: 10, bottom: 2, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => numberFormat.format(Number(value))}
              />
              <Tooltip
                formatter={(value) => numberFormat.format(Number(value))}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={title}
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          ) : (
            <BarChart
              data={values}
              margin={{ top: 8, right: 10, bottom: 2, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => numberFormat.format(Number(value))}
              />
              <Tooltip
                formatter={(value) => numberFormat.format(Number(value))}
              />
              <Bar
                dataKey="value"
                name={title}
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {display === 'donut' && values.length > 1 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {values.map((group, index) => (
            <li
              key={group.name}
              className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="truncate">{group.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
