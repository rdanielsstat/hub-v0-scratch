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

const chartColors = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]
const numberCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export interface SpendingPoint {
  month: string
  total: number
}

export interface AccountPoint {
  name: string
  value: number
}

export function SpendingChart({
  rows,
  chartType,
}: {
  rows: SpendingPoint[]
  chartType: 'line' | 'bar'
}) {
  const description = rows
    .map((row) => `${row.month} ${numberCurrency.format(row.total)}`)
    .join(', ')
  return (
    <div
      className="h-56 min-w-0"
      role="img"
      aria-label={`Monthly household spending: ${description}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'line' ? (
          <LineChart
            data={rows}
            margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
            />
            <Tooltip
              formatter={(value) => numberCurrency.format(Number(value))}
              contentStyle={{
                background: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                borderRadius: 12,
              }}
            />
            <Line
              dataKey="total"
              name="Spending"
              type="monotone"
              stroke="var(--color-chart-1)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        ) : (
          <BarChart
            data={rows}
            margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
            />
            <Tooltip
              formatter={(value) => numberCurrency.format(Number(value))}
              contentStyle={{
                background: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                borderRadius: 12,
              }}
            />
            <Bar
              dataKey="total"
              name="Spending"
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({
  rows,
  title,
}: {
  rows: AccountPoint[]
  title: string
}) {
  const description = rows
    .map((row) => `${row.name} ${numberCurrency.format(row.value)}`)
    .join(', ')
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div
        className="h-44 min-w-0 flex-1"
        role="img"
        aria-label={`${title}: ${description}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={3}
              stroke="none"
            >
              {rows.map((row, index) => (
                <Cell
                  key={row.name}
                  fill={chartColors[index % chartColors.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => numberCurrency.format(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 text-xs sm:min-w-32">
        {rows.map((row, index) => (
          <div
            key={row.name}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: chartColors[index % chartColors.length],
                }}
              />
              {row.name}
            </span>
            <span className="font-medium tabular-nums">
              {numberCurrency.format(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
