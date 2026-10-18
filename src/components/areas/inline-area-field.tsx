import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function InlineAreaField({
  value,
  label,
  as,
  className,
  initialEditing = false,
  onSave,
}: {
  value: string
  label: string
  as: 'input' | 'textarea'
  className?: string
  initialEditing?: boolean
  onSave: (value: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(initialEditing)
  const [draft, setDraft] = useState(value)
  const canceled = useRef(false)
  const saving = useRef(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else setDraft(value)
  }, [editing, value])

  async function save() {
    if (saving.current) return
    if (canceled.current) {
      canceled.current = false
      return
    }
    const next = inputRef.current?.value.trim() ?? draft.trim()
    if (next !== value) {
      saving.current = true
      try {
        await onSave(next)
      } finally {
        saving.current = false
      }
    }
    setEditing(false)
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (event.key === 'Escape') {
      canceled.current = true
      setDraft(value)
      setEditing(false)
      return
    }
    if (
      event.key === 'Enter' &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      void save()
    }
  }

  if (editing) {
    const props = {
      ref: inputRef,
      'aria-label': label,
      value: draft,
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setDraft(event.target.value),
      onKeyDown: handleKeyDown,
      onBlur: () => void save(),
      className: `rounded-md border border-input bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ''}`,
    }
    return as === 'input' ? (
      <Input {...props} />
    ) : (
      <Textarea {...props} rows={2} />
    )
  }

  return (
    <button
      type="button"
      aria-label={`${label}, edit`}
      onClick={() => setEditing(true)}
      className={`block rounded-md text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ''} ${as === 'textarea' ? 'whitespace-pre-wrap' : 'break-words'}`}
    >
      {value || <span className="text-muted-foreground">Add a description</span>}
    </button>
  )
}
