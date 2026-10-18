import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      const active = as === 'input' ? inputRef.current : textareaRef.current
      active?.focus()
      active?.select()
    } else setDraft(value)
  }, [editing, value])

  async function save() {
    if (saving.current) return
    if (canceled.current) {
      canceled.current = false
      return
    }
    const next = (as === 'input' ? inputRef.current?.value : textareaRef.current?.value)?.trim() ?? draft.trim()
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
    const inputClassName = `rounded-md border border-input bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ''}`
    return as === 'input' ? (
      <Input
        ref={inputRef}
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void save()}
        className={inputClassName}
      />
    ) : (
      <Textarea
        ref={textareaRef}
        aria-label={label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => void save()}
        className={inputClassName}
        rows={2}
      />
    )
  }

  return (
    <button
      type="button"
      aria-label={`${value || label}, edit`}
      onClick={() => setEditing(true)}
      className={`block rounded-md text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ''} ${as === 'textarea' ? 'whitespace-pre-wrap' : 'break-words'}`}
    >
      {value || <span className="text-muted-foreground">Add a description</span>}
    </button>
  )
}
