import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { ScorePicker } from '@/components/score-meter'
import { useStore } from '@/use-store'
import {
  areasApi,
  collectionsApi,
  STATUSES,
  type Area,
  type CollectionSchema,
  type ItemValue,
  type Status,
} from '@/services/api'
import { useApiResource } from '@/hooks/use-api-resource'
import { cn } from '@/lib/utils'
import { QuickCaptureField } from '@/components/collection/quick-capture-field'
import { localDateString } from '@/lib/local-date'
import {
  DESCRIPTION_MAX_LENGTH,
  NEXT_ACTION_MAX_LENGTH,
  PITCH_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  TAG_LIST_INPUT_MAX_LENGTH,
} from '@/lib/limits'

interface Props {
  open: boolean
  onClose: () => void
  defaultAreaId?: string
}

let lastAreaCollection = ''
let lastCaptureTarget: 'project' | 'area' = 'project'

const empty = {
  name: '',
  pitch: '',
  description: '',
  status: 'Inbox' as Status,
  tags: '',
  nextAction: '',
  excitement: 3,
  effort: 3,
  potential: 3,
}

const quickFieldsFor = (collection: CollectionSchema) => {
  const fields = collection.fields
  const titleField = fields.find((field) => field.type === 'text') ?? fields[0]
  const preferred = [
    titleField,
    fields.find((field) => field.id === 'amount' || /amount|total|price/i.test(field.name)),
    fields.find((field) => field.id === 'category' || /category/i.test(field.name)),
    fields.find((field) => field.type === 'date'),
  ].filter((field): field is NonNullable<typeof field> => Boolean(field))
  return [...new Map(preferred.map((field) => [field.id, field])).values()].slice(0, 4)
}

export function QuickCaptureDialog({ open, onClose, defaultAreaId }: Props) {
  const { createProject } = useStore()
  const navigate = useNavigate()
  const [targetOverride, setTargetOverride] = useState<
    'project' | 'area' | null
  >(null)
  const target = targetOverride ?? (defaultAreaId ? 'area' : lastCaptureTarget)
  const [areaId, setAreaId] = useState(defaultAreaId ?? '')
  const activeAreaId =
    defaultAreaId && targetOverride === null ? defaultAreaId : areaId
  const [collectionId, setCollectionId] = useState(lastAreaCollection)
  const [areaDraft, setAreaDraft] = useState<Record<string, string>>({})
  const [areaError, setAreaError] = useState('')
  const areasLoader = useCallback(() => areasApi.listAreas(), [])
  const collectionsLoader = useCallback(
    () => collectionsApi.listCollections(activeAreaId),
    [activeAreaId],
  )
  const areasState = useApiResource<Area[]>(areasLoader, 'capture-areas')
  const collectionsState = useApiResource<CollectionSchema[]>(
    collectionsLoader,
    `capture-collections:${activeAreaId}`,
  )
  const areas = areasState.data ?? []
  const collections = collectionsState.data ?? []
  const selectedCollection =
    collections.find((collection) => collection.id === collectionId) ??
    collections[0]
  const quickFields = selectedCollection ? quickFieldsFor(selectedCollection) : []
  const visibleAreaFields = expanded
    ? (selectedCollection?.fields ?? [])
    : quickFields
  const [form, setForm] = useState(empty)
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setForm(empty)
    setExpanded(false)
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    setAreaDraft({})
    setAreaError('')
    setTargetOverride(null)
    if (defaultAreaId) setAreaId(defaultAreaId)
    onClose()
  }

  async function handleAreaSubmit() {
    if (!selectedCollection || !activeAreaId || submitting) return
    setSubmitting(true)
    lastCaptureTarget = 'area'
    setAreaError('')
    try {
      const data: Record<string, ItemValue> = {}
      for (const field of selectedCollection.fields) {
        const value =
          areaDraft[field.id] ??
          (field.type === 'date' ? localDateString() : '')
        if (
          field.type === 'number' ||
          field.type === 'currency' ||
          field.type === 'duration'
        )
          data[field.id] = value ? Number(value) : 0
        else if (field.type === 'checkbox') data[field.id] = value === 'true'
        else if (field.type === 'multiChoice')
          data[field.id] = value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
        else data[field.id] = value
      }
      const titleField =
        selectedCollection.fields.find((field) => field.type === 'text') ??
        selectedCollection.fields[0]
      const titleValue = titleField ? data[titleField.id] : undefined
      const dateField = selectedCollection.fields.find((field) => field.type === 'date')
      const occurredAt = dateField ? String(data[dateField.id] ?? localDateString()) : localDateString()
      await collectionsApi.createItem({
        areaId: activeAreaId,
        collectionId: selectedCollection.id,
        title: titleValue === undefined || titleValue === ''
          ? 'Untitled item'
          : Array.isArray(titleValue)
            ? titleValue.join(', ')
            : String(titleValue),
        type: selectedCollection.id,
        occurredAt,
        data,
      })
      lastAreaCollection = selectedCollection.id
      window.dispatchEvent(new Event('hub:area-items-changed'))
      setAreaDraft({})
      reset()
      onClose()
    } catch (caught) {
      setAreaError(
        caught instanceof Error ? caught.message : 'Could not add this item.',
      )
      setSubmitting(false)
    }
  }

  async function handleSubmit(goToDetail: boolean) {
    if (!form.name.trim() || submitting) return
    setSubmitting(true)
    try {
      const created = await createProject({
        name: form.name,
        pitch: form.pitch,
        description: form.description,
        status: form.status,
        tags: form.tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        nextAction: form.nextAction,
        excitement: form.excitement,
        effort: form.effort,
        potential: form.potential,
      })
      reset()
      onClose()
      if (goToDetail) navigate(`/project/${created.id}`)
    } catch {
      // store already showed a toast; leave the dialog open with the
      // form data intact so nothing typed is lost
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Quick capture">
      <DialogHeader
        title="Quick capture"
        description={target === 'project'
          ? 'Get it out of your head. Only a name is required.'
          : 'Add a quick entry to an area with only the key fields in view.'}
      />
      <DialogBody className="flex flex-col gap-4">
        <div
          className="flex w-full gap-2"
          role="group"
          aria-label="Capture destination"
        >
          <Button
            className="h-9 flex-1"
            variant={target === 'project' ? 'default' : 'outline'}
            aria-pressed={target === 'project'}
            onClick={() => {
              setTargetOverride('project')
              lastCaptureTarget = 'project'
            }}
          >
            New project
          </Button>
          <Button
            className="h-9 flex-1"
            variant={target === 'area' ? 'default' : 'outline'}
            aria-pressed={target === 'area'}
            onClick={() => {
              setTargetOverride('area')
              if (defaultAreaId) {
                setAreaId(defaultAreaId)
                setCollectionId('')
              }
              lastCaptureTarget = 'area'
            }}
          >
            Add to an area
          </Button>
        </div>
        {target === 'project' ? (
          <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qc-name">Name</Label>
            <Input
              id="qc-name"
              maxLength={PROJECT_NAME_MAX_LENGTH}
              autoFocus
              placeholder="e.g. Chess improvement analytics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  void handleSubmit(false)
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qc-pitch">One-line pitch</Label>
            <Input
              id="qc-pitch"
              maxLength={PITCH_MAX_LENGTH}
              placeholder="The scannable version"
              value={form.pitch}
              onChange={(e) => setForm({ ...form, pitch: e.target.value })}
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                expanded && 'rotate-180',
              )}
            />
            {expanded ? 'Fewer details' : 'More details'}
          </button>

          {expanded ? (
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qc-desc">Brain dump</Label>
                <Textarea
                  id="qc-desc"
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  placeholder="Everything you're thinking about this…"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qc-status">Status</Label>
                  <Select
                    id="qc-status"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as Status })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="qc-tags">Tags</Label>
                  <Input
                    id="qc-tags"
                    maxLength={TAG_LIST_INPUT_MAX_LENGTH}
                    placeholder="stats, chess"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qc-next">Next action</Label>
                <Input
                  id="qc-next"
                  maxLength={NEXT_ACTION_MAX_LENGTH}
                  placeholder="The single next concrete step"
                  value={form.nextAction}
                  onChange={(e) =>
                    setForm({ ...form, nextAction: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ScorePicker
                  label="Excitement"
                  tone="excitement"
                  value={form.excitement}
                  onChange={(v) => setForm({ ...form, excitement: v })}
                />
                <ScorePicker
                  label="Potential"
                  tone="potential"
                  value={form.potential}
                  onChange={(v) => setForm({ ...form, potential: v })}
                />
                <ScorePicker
                  label="Effort"
                  tone="effort"
                  value={form.effort}
                  onChange={(v) => setForm({ ...form, effort: v })}
                />
              </div>
            </div>
          ) : null}
          </div>
        ) : null}
        {target === 'area' ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <Label htmlFor="qc-area">Area</Label>
                <Select
                  id="qc-area"
                  value={activeAreaId}
                  onChange={(event) => {
                    setTargetOverride('area')
                    setAreaId(event.target.value)
                    setCollectionId('')
                  }}
                >
                  <option value="">Choose an area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <Label htmlFor="qc-collection">Collection</Label>
                <Select
                  id="qc-collection"
                  value={selectedCollection?.id ?? ''}
                  onChange={(event) => setCollectionId(event.target.value)}
                  disabled={!collections.length}
                >
                  <option value="">Choose a collection</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            {areasState.loading || collectionsState.loading ? (
              <p className="text-sm text-muted-foreground">
                Loading areas and collections
              </p>
            ) : null}
            {areasState.error || collectionsState.error ? (
              <p role="alert" className="text-sm text-destructive">
                Could not load areas. Try again.
              </p>
            ) : null}
            {!areasState.loading && !areasState.error && areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create an area before adding an entry.
              </p>
            ) : null}
            {activeAreaId &&
            !collectionsState.loading &&
            collections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This area has no collections yet.
              </p>
            ) : null}
            {visibleAreaFields.map((field) => (
              <label key={field.id} className="flex flex-col gap-1.5 text-sm">
                <Label htmlFor={`qc-area-field-${field.id}`}>
                  {field.name}{field.unit ? ` (${field.unit})` : ''}
                </Label>
                <QuickCaptureField
                  id={`qc-area-field-${field.id}`}
                  field={field}
                  value={areaDraft[field.id] ?? (field.type === 'date' ? localDateString() : '')}
                  onChange={(value) =>
                    setAreaDraft((current) => ({ ...current, [field.id]: value }))
                  }
                />
              </label>
            ))}
            {selectedCollection && selectedCollection.fields.length > quickFields.length ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
                {expanded ? 'Fewer fields' : 'More fields'}
              </button>
            ) : null}
            {areaError ? (
              <p role="alert" className="text-sm text-destructive">
                {areaError}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" size="lg" onClick={handleClose}>
          Cancel
        </Button>
        {target === 'project' ? (
          <Button
            variant="outline"
            size="lg"
            disabled={!form.name.trim() || submitting}
            onClick={() => handleSubmit(true)}
          >
            Capture & open
          </Button>
        ) : null}
        <Button
          size="lg"
          disabled={
            target === 'project'
              ? !form.name.trim() || submitting
              : !selectedCollection || !activeAreaId || submitting
          }
          onClick={() =>
            target === 'project' ? handleSubmit(false) : handleAreaSubmit()
          }
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          {target === 'project' ? 'Capture' : 'Add entry'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
