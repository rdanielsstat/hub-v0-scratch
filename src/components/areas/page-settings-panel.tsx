import type { AreaPageSettings, AreaPageSpec, Block } from '@/services/api'
import { defaultAreaPageSettings } from '@/components/areas/page-settings-defaults'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { usePanelEscape } from '@/components/areas/use-panel-escape'

export function PageCustomizeMenu({
  blocks,
  hiddenBlockIds,
  onToggleBlock,
  onEditLayout,
  onOpenSettings,
}: {
  blocks: Block[]
  hiddenBlockIds: string[]
  onToggleBlock: (block: Block, visible: boolean) => void
  onEditLayout: () => void
  onOpenSettings: () => void
}) {
  return (
    <div
      aria-label="Customize page"
      className="absolute right-0 top-10 z-30 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg"
    >
      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
        Show or hide blocks
      </p>
      <div className="max-h-64 overflow-y-auto">
        {blocks.length ? (
          blocks.map((block) => {
            const title = block.type === 'view' ? block.view.title : block.title
            return (
              <label
                key={block.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={!hiddenBlockIds.includes(block.id)}
                  onChange={(event) => onToggleBlock(block, event.target.checked)}
                />
                <span className="min-w-0 flex-1 break-words">
                  {title || block.type}
                </span>
              </label>
            )
          })
        ) : (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            This page has no blocks yet.
          </p>
        )}
      </div>
      <Button variant="ghost" className="justify-start" onClick={onOpenSettings}>
        Page settings
      </Button>
      <Button variant="outline" onClick={onEditLayout}>
        Edit layout
      </Button>
    </div>
  )
}

export function PageSettingsPanel({
  page,
  onClose,
  onSave,
  onReset,
}: {
  page: AreaPageSpec
  onClose: () => void
  onSave: (settings: AreaPageSettings) => void
  onReset: () => void
}) {
  usePanelEscape(onClose)
  const settings = { ...defaultAreaPageSettings, ...page.settings }
  const update = (patch: Partial<AreaPageSettings>) =>
    onSave({ ...settings, ...patch })
  const handleReset = () => {
    if (window.confirm('Reset this page to its template settings?')) onReset()
  }

  return (
    <aside
      role="complementary"
      aria-label="Page settings"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[480px] overflow-y-auto border-l border-border bg-background p-5 shadow-xl"
    >
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Customize this page</p>
          <h2 className="font-semibold">Page settings</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Layout
          <Select
            aria-label="Page layout"
            value={settings.layout}
            onChange={(event) =>
              update({ layout: event.target.value as AreaPageSettings['layout'] })
            }
          >
            <option value="oneColumn">One column</option>
            <option value="twoColumns">Two columns</option>
            <option value="threeColumns">Three columns</option>
            <option value="grid">Grid</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Page width
          <Select
            aria-label="Page width"
            value={settings.width}
            onChange={(event) =>
              update({ width: event.target.value as AreaPageSettings['width'] })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="full">Full width</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Density
          <Select
            aria-label="Page density"
            value={settings.density}
            onChange={(event) =>
              update({ density: event.target.value as AreaPageSettings['density'] })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Block style
          <Select
            aria-label="Block style"
            value={settings.blockStyle}
            onChange={(event) =>
              update({
                blockStyle: event.target.value as AreaPageSettings['blockStyle'],
              })
            }
          >
            <option value="cards">Cards with borders</option>
            <option value="plain">Plain blocks</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showBlockTitles}
            onChange={(event) => update({ showBlockTitles: event.target.checked })}
          />
          Show block titles
        </label>
        <Button variant="outline" className="mt-2" onClick={handleReset}>
          Reset to template
        </Button>
      </div>
    </aside>
  )
}
