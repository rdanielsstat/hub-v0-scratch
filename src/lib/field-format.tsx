import { Check } from 'lucide-react'
import type { FieldDef, ItemValue } from '@/services/api'
import { formatFieldValue } from '@/lib/field-format-utils'

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
