export const STATUSES = [
  'Inbox',
  'Exploring',
  'Active',
  'Parked',
  'Graduated',
  'Killed',
] as const

export type Status = (typeof STATUSES)[number]

export interface Link {
  label?: string
  url: string
}

export interface Project {
  id: string
  name: string
  /** one-line, scannable pitch, separate from description */
  pitch: string
  /** the full brain-dump */
  description: string
  status: Status
  tags: string[]
  excitement: number // 1–5
  effort: number // 1–5
  potential: number // 1–5
  /** the single next concrete step (GTD core) */
  nextAction: string
  /** ISO date string or null */
  targetDate: string | null
  links: Link[]
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  projectId: string
  body: string
  createdAt: string
}

export interface CreateProjectInput {
  name: string
  pitch?: string
  description?: string
  status?: Status
  tags?: string[]
  excitement?: number
  effort?: number
  potential?: number
  nextAction?: string
  targetDate?: string | null
  links?: Link[]
}

export type UpdateProjectInput = Partial<Omit<Project, 'id' | 'createdAt'>>

export interface User {
  id: string
  email: string
  displayName: string | null
  createdAt: string
  updatedAt: string
}

export interface RegisterInput {
  email: string
  password: string
  displayName?: string
}

export type SectionLayout = 'stack' | 'grid'
export type BlockSize = 'small' | 'medium' | 'wide' | 'tall' | 'full'

export interface AreaPageSettings {
  layout: 'oneColumn' | 'twoColumns' | 'threeColumns' | 'grid'
  width: 'comfortable' | 'full'
  density: 'comfortable' | 'compact'
  blockStyle: 'cards' | 'plain'
  showBlockTitles: boolean
}

export interface AreaPageSpec {
  id: string
  name: string
  order: number
  sectionIds: string[]
  settings?: AreaPageSettings
  hiddenBlockIds?: string[]
}

export interface AreaSection {
  id: string
  areaId: string
  pageId: string
  title?: string
  order: number
  layout: SectionLayout
  columns: 1 | 2 | 3 | 4
  blockIds: string[]
}
export type FieldType =
  | 'text'
  | 'longText'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'duration'
  | 'checkbox'
  | 'choice'
  | 'multiChoice'
  | 'link'
  | 'reference'
  | 'image'

export interface FieldDef {
  id: string
  name: string
  type: FieldType
  required?: boolean
  unit?: string
  options?: string[]
  order: number
}

export interface CollectionPreferences {
  display: 'table' | 'cards' | 'gallery' | 'timeline'
  columnWidths: Record<string, number>
}

export interface CollectionSchema {
  id: string
  areaId: string
  name: string
  description: string
  fields: FieldDef[]
  createdAt: string
  updatedAt: string
}

export interface Area {
  id: string
  name: string
  description: string
  collectionIds: string[]
  blockIds: string[]
  pageIds: string[]
  itemCount: number
  glance: string
  lastActiveAt: string
  icon: string
  coverTone: string
  accent: string
  pinned?: boolean
  order?: number
  groupId?: string | null
}

export interface AreaGroup {
  id: string
  name: string
  order: number
  collapsed?: boolean
}

export interface AreasListPreferences {
  density: 'compact' | 'comfortable' | 'cards'
  sort: 'manual' | 'name' | 'lastActive'
  groupBy: 'none' | 'sidebar'
  details: {
    description: boolean
    collectionCount: boolean
    itemCount: boolean
    lastActive: boolean
  }
}

export type ItemValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | { itemId: string; title: string; areaId: string }

export interface Item {
  id: string
  areaId: string
  collectionId: string
  title: string
  type: string
  occurredAt?: string
  data: Record<string, ItemValue>
  parentItemId?: string
  source?: string
  externalId?: string
  createdAt: string
  updatedAt: string
}

export type ViewDisplay =
  | 'stat'
  | 'line'
  | 'bar'
  | 'donut'
  | 'table'
  | 'cards'
  | 'gallery'
  | 'list'
  | 'timeline'
  | 'board'
  | 'calendar'

export type ViewPeriod = 'thisMonth' | 'last30Days' | '12Months' | 'allTime'
export type AggregateOperation =
  'sum' | 'average' | 'count' | 'min' | 'max' | 'latest'

export interface ViewFilter {
  fieldId: string
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isSet'
  value?: ItemValue
}

export interface ViewSpec {
  id: string
  title: string
  collectionId: string
  display: ViewDisplay
  filter: ViewFilter[]
  period?: ViewPeriod
  groupBy?: string
  aggregate?: { operation: AggregateOperation; fieldId?: string }
  sort?: { fieldId: string; direction: 'asc' | 'desc' }
  limit?: number
  columns?: string[]
  size?: 'small' | 'medium' | 'wide' | 'tall'
  chartType?: 'line' | 'bar' | 'donut'
}

interface BlockBase {
  id: string
  areaId: string
  title?: string
  order: number
  size?: BlockSize
  sectionId?: string
}

export type Block =
  | (BlockBase & { type: 'text'; body: string })
  | (BlockBase & { type: 'collection'; collectionId: string })
  | (BlockBase & { type: 'view'; view: ViewSpec })
  | (BlockBase & { type: 'image'; imageUrl: string; caption?: string })
  | (BlockBase & { type: 'heading'; body: string })
  | (BlockBase & { type: 'list'; items: string[] })
  | (BlockBase & {
      type: 'checklist'
      items: Array<{ text: string; checked: boolean }>
    })
  | (BlockBase & { type: 'divider' })
  | (BlockBase & { type: 'callout'; body: string })
  | (BlockBase & { type: 'linkedItems'; itemIds: string[] })
  | (BlockBase & { type: 'embeddedPage'; pageId: string })

export interface ItemLink {
  id: string
  fromItemId: string
  toItemId: string
  relationship: string
  createdAt: string
}

export interface DataSource {
  id: string
  collectionId: string
  name: string
  provider: string
  kind: 'file' | 'service' | 'manual'
  status: 'connected' | 'syncing' | 'error' | 'manual'
  lastSyncedAt?: string
  nextSyncAt?: string
  errorMessage?: string
}

export type AreaStartFrom =
  | 'blank'
  | 'dashboard'
  | 'collection'
  | 'journal'
  | 'tracker'
  | 'routine'
  | 'wiki'
  | 'board'
  | 'calendar'
export interface CreateAreaInput {
  name: string
  description?: string
  startFrom: AreaStartFrom
}
