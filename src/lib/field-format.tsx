import { Check } from 'lucide-react'
import type { FieldDef, ItemValue } from '@/services/api'
import { formatLocalDate } from '@/lib/local-date'

export function formatFieldValue(
  value: ItemValue | undefined,
  field?: FieldDef,
): string {
  if (value === null || value === undefined || value === '') return ''
  if (field?.type === 'checkbox') return value === true ? 'checked' : ''
  if (field?.type === 'currency' && typeof value === 'number')
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  if (field?.type === 'date' && typeof value === 'string')
    return formatLocalDate(value.slice(0, 10))
  if (field?.type === 'datetime' && typeof value === 'string')
    return formatLocalDate(value, true)
  if (typeof value === 'number') {
    const formatted = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(value)
    return `${formatted}${field?.unit ? ` ${field.unit}` : ''}`
  }
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return value.title
  return String(value)
}

export function FieldValue({
  value,
  field,
}: {
  value: ItemValue | undefined
  field?: FieldDef
}) {
  if (field?.type === 'checkbox')
    return value === true ? (
      <Check aria-label="Checked" className="inline size-4" />
    ) : null
  return <>{formatFieldValue(value, field)}</>
}
