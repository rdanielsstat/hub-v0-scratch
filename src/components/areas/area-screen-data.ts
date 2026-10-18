import type { Area, AreaPageSpec, AreaSection, Block, CollectionSchema, Item } from '@/services/api'

export interface AreaScreenData {
  area: Area | null
  pages: AreaPageSpec[]
  sections: AreaSection[]
  blocks: Block[]
  collections: CollectionSchema[]
  items: Item[]
}
