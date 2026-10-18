import type { Item, ViewSpec } from '@/services/api'
import {
  localDateString,
  normalizeLocalDate,
  parseLocalDate,
} from '@/lib/local-date'

function dateOf(item: Item) {
  const dateOnly = Object.values(item.data).find(
    (value): value is string =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
  )
  if (dateOnly) return parseLocalDate(dateOnly)
  if (item.occurredAt)
    return normalizeLocalDate(parseLocalDate(item.occurredAt))
  return normalizeLocalDate(new Date(item.createdAt))
}

export function applyViewSpec(spec: ViewSpec, items: Item[], now = new Date()) {
  const today = normalizeLocalDate(now)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const cutoff = new Date(today)
  if (spec.period === 'thisMonth') cutoff.setTime(monthStart.getTime())
  if (spec.period === 'last30Days') cutoff.setDate(cutoff.getDate() - 30)
  if (spec.period === '12Months')
    cutoff.setTime(
      new Date(today.getFullYear(), today.getMonth() - 11, 1).getTime(),
    )
  let selected = items.filter((item) => {
    const itemDate = dateOf(item)
    if (
      spec.period === 'thisMonth' &&
      (itemDate < monthStart || itemDate >= nextMonth)
    )
      return false
    if (
      spec.period &&
      spec.period !== 'allTime' &&
      spec.period !== 'thisMonth' &&
      itemDate < cutoff
    )
      return false
    return spec.filter.every((filter) => {
      const value = item.data[filter.fieldId]
      if (filter.operator === 'isSet')
        return value !== null && value !== undefined && value !== ''
      const left = Array.isArray(value)
        ? value.join(' ')
        : String(value ?? '').toLowerCase()
      const right = String(filter.value ?? '').toLowerCase()
      if (filter.operator === 'equals') return left === right
      if (filter.operator === 'contains') return left.includes(right)
      if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        typeof filter.value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(filter.value)
      )
        return filter.operator === 'greaterThan'
          ? value > filter.value
          : value < filter.value
      const leftNumber = Number(value)
      const rightNumber = Number(filter.value)
      if (filter.operator === 'greaterThan')
        return Number.isFinite(leftNumber) && leftNumber > rightNumber
      return Number.isFinite(leftNumber) && leftNumber < rightNumber
    })
  })
  if (spec.sort)
    selected = [...selected].sort((a, b) => {
      const left =
        spec.sort!.fieldId === 'createdAt'
          ? a.createdAt
          : (a.data[spec.sort!.fieldId] ?? a.title)
      const right =
        spec.sort!.fieldId === 'createdAt'
          ? b.createdAt
          : (b.data[spec.sort!.fieldId] ?? b.title)
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right))
      return spec.sort!.direction === 'asc' ? result : -result
    })
  if (spec.limit && spec.limit > 0) selected = selected.slice(0, spec.limit)
  return selected
}

export function aggregateView(spec: ViewSpec, items: Item[]) {
  const operation = spec.aggregate?.operation ?? 'count'
  const fieldId = spec.aggregate?.fieldId
  if (operation === 'count') return items.length
  const values = items.flatMap((item) => {
    const value = fieldId ? item.data[fieldId] : undefined
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ value, item }]
      : []
  })
  if (operation === 'latest') {
    const latest = [...items].sort(
      (a, b) => dateOf(b).getTime() - dateOf(a).getTime(),
    )[0]
    return latest
      ? fieldId
        ? (latest.data[fieldId] ?? null)
        : localDateString(dateOf(latest))
      : null
  }
  if (!values.length) return 0
  const numbers = values.map(({ value }) => value)
  if (operation === 'sum') return numbers.reduce((sum, value) => sum + value, 0)
  if (operation === 'average')
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  if (operation === 'min') return Math.min(...numbers)
  return Math.max(...numbers)
}

export function groupView(spec: ViewSpec, items: Item[]) {
  const field = spec.groupBy
  const groups = new Map<string, Item[]>()
  for (const item of items) {
    const raw =
      field === 'month'
        ? dateOf(item).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          })
        : field
          ? item.data[field]
          : 'All items'
    const name = Array.isArray(raw)
      ? raw.join(', ')
      : String(raw ?? 'Uncategorized')
    groups.set(name, [...(groups.get(name) ?? []), item])
  }
  const result = [...groups].map(([name, groupItems]) => ({
    name,
    items: groupItems,
    value: aggregateView(spec, groupItems),
    firstDate: Math.min(...groupItems.map((item) => dateOf(item).getTime())),
  }))
  if (field === 'month')
    result.sort((left, right) => left.firstDate - right.firstDate)
  return result.map(({ name, items: groupItems, value }) => ({
    name,
    items: groupItems,
    value,
  }))
}
