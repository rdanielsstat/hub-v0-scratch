import type { FieldDef, ItemValue } from '@/services/api'

export const valueText = (value: ItemValue | undefined) =>
  Array.isArray(value)
    ? value.join(', ')
    : value && typeof value === 'object'
      ? value.title
      : value === null || value === undefined
        ? ''
        : String(value)

export function parseValue(field: FieldDef, value: string): ItemValue {
  if (
    field.type === 'number' ||
    field.type === 'currency' ||
    field.type === 'duration'
  )
    return value ? Number(value) : 0
  if (field.type === 'checkbox') return value === 'true'
  if (field.type === 'multiChoice')
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  return value
}

export function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function parseCsv(text: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"' && text[index + 1] === '"' && quoted) {
      currentCell += '"'
      index += 1
    } else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) {
      currentRow.push(currentCell)
      currentCell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      currentRow.push(currentCell)
      if (currentRow.some(Boolean)) rows.push(currentRow)
      currentRow = []
      currentCell = ''
    } else currentCell += character
  }
  currentRow.push(currentCell)
  if (currentRow.some(Boolean)) rows.push(currentRow)
  const [headers = [], ...values] = rows
  return values.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    ),
  )
}
