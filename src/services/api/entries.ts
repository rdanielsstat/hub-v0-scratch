import type { Item } from './types'
import { mockItems, cloneMockData } from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

export const entriesApi = {
  async getEntry(id: string): Promise<Item | null> {
    return mockAreasRequest(mockItems.find((item) => item.id === id) ?? null)
  },

  async listEntries(
    collectionId: string,
    parentItemId?: string,
  ): Promise<Item[]> {
    return mockAreasRequest(
      mockItems.filter(
        (item) =>
          item.collectionId === collectionId &&
          (parentItemId
            ? item.parentItemId === parentItemId
            : !item.parentItemId),
      ),
      [],
    )
  },

  async listReferencedBy(itemId: string): Promise<Item[]> {
    return mockAreasRequest(
      mockItems.filter((item) =>
        Object.values(item.data).some(
          (value) =>
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            'itemId' in value &&
            value.itemId === itemId,
        ),
      ),
    )
  },

  async duplicateEntry(id: string): Promise<Item> {
    const source = mockItems.find((item) => item.id === id)
    if (!source) throw new Error('Entry not found')
    const timestamp = new Date().toISOString()
    const item: Item = {
      ...cloneMockData(source),
      id: `item-${crypto.randomUUID()}`,
      title: `${source.title} copy`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    mockItems.unshift(item)
    return cloneMockData(item)
  },
}
