import { Link } from 'react-router-dom'
import type { AreaPageSettings, Block, CollectionSchema, Item } from '@/services/api'
import { Textarea } from '@/components/ui/textarea'
import { ViewRenderer } from '@/components/areas/view-renderer'
import { cn } from '@/lib/utils'

export function AreaBlockContent({
  block,
  data,
  pageSettings,
  customizing,
  onSave,
  onOpenPicker,
}: {
  block: Block
  data: {
    pages: { id: string; name: string }[]
    collections: CollectionSchema[]
    items: Item[]
  }
  pageSettings: AreaPageSettings
  customizing: boolean
  onSave: (block: Block) => Promise<void>
  onOpenPicker: () => void
}) {
  const view = block.type === 'view' ? block.view : null
  const collection = view
    ? data.collections.find((item) => item.id === view.collectionId)
    : block.type === 'collection'
      ? data.collections.find((item) => item.id === block.collectionId)
      : null
  const items = collection
    ? data.items.filter((item) => item.collectionId === collection.id)
    : []
  const title = view?.title ?? block.title ?? block.type

  return (
    <div
      className={cn(
        'min-w-0',
        block.size === 'wide' || block.size === 'full' ? 'md:col-span-full' : '',
        block.size === 'tall' && 'min-h-64',
      )}
    >
      {view && collection ? (
        <ViewRenderer
          spec={view}
          items={items}
          fields={collection.fields}
          showTitle={pageSettings.showBlockTitles}
          plain={pageSettings.blockStyle === 'plain'}
          compact={pageSettings.density === 'compact'}
          onChangeSpec={(next) => void onSave({ ...block, view: next })}
        />
      ) : block.type === 'collection' && collection ? (
        <Link
          to={`/area/${collection.areaId}/collection/${collection.id}`}
          className={cn(
            'block rounded-xl p-4',
            pageSettings.blockStyle === 'plain'
              ? 'border-0 px-0'
              : 'border border-border hover:border-primary/40',
          )}
        >
          {pageSettings.showBlockTitles ? <h3 className="font-medium">{collection.name}</h3> : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </Link>
      ) : block.type === 'text' || block.type === 'callout' || block.type === 'heading' ? (
        <article className={cn(
          block.type === 'callout'
            ? 'rounded-lg p-4'
            : 'rounded-lg p-4',
          pageSettings.blockStyle === 'plain' ? 'border-0 bg-transparent' : 'border border-border/70',
          pageSettings.density === 'compact' && 'p-3',
        )}>
          {block.title && pageSettings.showBlockTitles ? <h3 className="mb-2 text-sm font-medium">{block.title}</h3> : null}
          {customizing ? (
            <Textarea
              aria-label={`Text in ${title}`}
              defaultValue={block.body}
              className="min-h-20 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              onBlur={(event) => event.currentTarget.value !== block.body && void onSave({ ...block, body: event.currentTarget.value })}
              onKeyDown={(event) => {
                if (event.key === '/' && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  event.preventDefault()
                  onOpenPicker()
                }
              }}
            />
          ) : block.type === 'heading' ? (
            <p className="text-lg font-semibold">{block.body}</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{block.body}</p>
          )}
        </article>
      ) : block.type === 'list' || block.type === 'checklist' ? (
        <ul className={cn(
          'flex flex-col gap-2 rounded-lg p-4',
          pageSettings.blockStyle === 'plain' ? 'border-0 bg-transparent' : 'border border-border',
          pageSettings.density === 'compact' && 'p-3',
        )}>
          {block.items.map((item, index) => (
            <li key={index} className="text-sm">
              {typeof item === 'string' ? item : <label className="flex items-center gap-2"><input type="checkbox" checked={item.checked} readOnly />{item.text}</label>}
            </li>
          ))}
        </ul>
      ) : block.type === 'image' ? (
        <figure>
          {block.imageUrl ? <img src={block.imageUrl} alt={block.caption || block.title || 'Area image'} className="max-h-96 w-full rounded-xl object-cover" /> : customizing ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Add an image from block settings.</p> : null}
          {block.caption ? <figcaption className="mt-2 text-xs text-muted-foreground">{block.caption}</figcaption> : null}
        </figure>
      ) : block.type === 'divider' ? (
        <hr className="border-border" />
      ) : block.type === 'linkedItems' ? (
        <p className="text-sm text-muted-foreground">{block.itemIds.length} linked {block.itemIds.length === 1 ? 'item' : 'items'}</p>
      ) : block.type === 'embeddedPage' ? (
        <div className={cn('rounded-lg p-4 text-sm', pageSettings.blockStyle === 'plain' ? 'border-0 bg-transparent' : 'border border-border')}>
          {data.pages.find((item) => item.id === block.pageId)?.name ?? block.title}
        </div>
      ) : null}
    </div>
  )
}
