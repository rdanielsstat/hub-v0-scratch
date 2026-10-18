export function localDateString(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseLocalDate(value: string): Date {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly)
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  return new Date(value)
}

export function normalizeLocalDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function formatLocalDate(value: string, includeTime = false): string {
  const date = parseLocalDate(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
