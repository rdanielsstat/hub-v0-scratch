import type { Status } from './types'

export type ProjectSortKey =
  | 'updated'
  | 'opportunity'
  | 'excitement'
  | 'effort'
  | 'target'
  | 'name'

export interface ProjectFilterState {
  status: Status | 'all'
  tag: string | null
  q: string
  sort: ProjectSortKey
}

export interface SavedProjectFilter extends ProjectFilterState {
  id: string
  name: string
  order: number
}

let filters: SavedProjectFilter[] = [
  {
    id: 'active-high-excitement',
    name: 'Active, high excitement',
    status: 'Active',
    tag: null,
    q: '',
    sort: 'excitement',
    order: 0,
  },
  {
    id: 'parked-ideas',
    name: 'Parked ideas',
    status: 'Parked',
    tag: null,
    q: '',
    sort: 'updated',
    order: 1,
  },
]

const copy = <T,>(value: T): T => structuredClone(value)

export const savedFiltersApi = {
  async list(): Promise<SavedProjectFilter[]> {
    return copy([...filters].sort((a, b) => a.order - b.order))
  },
  async create(input: Omit<SavedProjectFilter, 'id' | 'order'>) {
    const filter = { ...copy(input), id: `filter-${crypto.randomUUID()}`, order: filters.length }
    filters = [...filters, filter]
    return copy(filter)
  },
  async update(id: string, patch: Partial<Omit<SavedProjectFilter, 'id'>>) {
    filters = filters.map((filter) => filter.id === id ? { ...filter, ...copy(patch) } : filter)
    return copy(filters.find((filter) => filter.id === id) ?? null)
  },
  async reorder(ids: string[]) {
    filters = ids.flatMap((id, order) => {
      const filter = filters.find((item) => item.id === id)
      return filter ? [{ ...filter, order }] : []
    })
  },
  async remove(id: string) {
    filters = filters.filter((filter) => filter.id !== id).map((filter, order) => ({ ...filter, order }))
  },
}
