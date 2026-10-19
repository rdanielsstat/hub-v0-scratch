import { X } from 'lucide-react'
import type { Area } from '@/services/api'
import { areaIconOptions } from '@/components/areas/area-icon-options'
import { usePanelEscape } from '@/components/areas/use-panel-escape'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const areaEmojiOptions = [
  '📚',
  '🌿',
  '🏠',
  '💰',
  '🏃',
  '🧭',
  '🎨',
  '✨',
  '☀️',
  '🎵',
]

export function AreaSettingsPanel({
  area,
  onClose,
  onSave,
}: {
  area: Area
  onClose: () => void
  onSave: (patch: Partial<Area>) => Promise<void>
}) {
  usePanelEscape(onClose)
  return (
    <aside
      aria-label="Area settings"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l border-border bg-background p-5 shadow-xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Customize this space</p>
          <h2 className="font-semibold">Area settings</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close area settings"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Name
          <Input
            aria-label="Area name"
            defaultValue={area.name}
            onBlur={(event) =>
              event.currentTarget.value !== area.name &&
              void onSave({ name: event.currentTarget.value })
            }
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Icon</legend>
          <button
            type="button"
            aria-pressed={!area.icon}
            onClick={() => void onSave({ icon: '' })}
            className="w-fit rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            No icon
          </button>
          <div className="grid grid-cols-8 gap-1" aria-label="Emoji icons">
            {areaEmojiOptions.map((emoji) => (
              <button
                type="button"
                key={emoji}
                aria-label={`Use ${emoji} icon`}
                aria-pressed={area.icon === emoji}
                onClick={() => void onSave({ icon: emoji })}
                className="grid size-9 place-items-center rounded-md border border-border text-lg hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {areaIconOptions.map(({ name, icon: Icon }) => (
              <button
                type="button"
                key={name}
                aria-label={`Use ${name} icon`}
                aria-pressed={area.icon === name}
                onClick={() => void onSave({ icon: name })}
                className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary"
              >
                <Icon aria-hidden="true" className="size-4" />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm">
          Description
          <Textarea
            aria-label="Area description"
            defaultValue={area.description}
            onBlur={(event) =>
              event.currentTarget.value !== area.description &&
              void onSave({ description: event.currentTarget.value })
            }
          />
        </label>
      </div>
    </aside>
  )
}
