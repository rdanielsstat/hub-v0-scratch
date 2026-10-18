import type { FieldDef } from '@/services/api'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export function QuickCaptureField({
  id,
  field,
  value,
  onChange,
}: {
  id: string
  field: FieldDef
  value: string
  onChange: (value: string) => void
}) {
  if (field.type === 'choice' && field.options?.length)
    return (
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        {field.options.map((option) => <option key={option}>{option}</option>)}
      </Select>
    )
  if (field.type === 'checkbox')
    return (
      <input
        id={id}
        type="checkbox"
        checked={value === 'true'}
        onChange={(event) => onChange(String(event.target.checked))}
      />
    )
  return (
    <Input
      id={id}
      type={field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'number' || field.type === 'currency' || field.type === 'duration' ? 'number' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
