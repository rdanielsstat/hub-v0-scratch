import type {
  CollectionPreferences,
  CollectionSchema,
  FieldDef,
  Item,
  ItemValue,
} from './types'
import {
  mockAreas,
  mockCollections,
  mockItems,
  cloneMockData,
} from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

const collectionPreferences = new Map<string, CollectionPreferences>()
const defaultPreferences: CollectionPreferences = {
  display: 'table',
  columnWidths: {},
}

export interface CreateCollectionInput {
  areaId: string
  name: string
  description?: string
  fields?: FieldDef[]
}

export const collectionsApi = {
  async listCollections(areaId?: string): Promise<CollectionSchema[]> {
    const collections = areaId
      ? mockCollections.filter((collection) => collection.areaId === areaId)
      : mockCollections
    return mockAreasRequest(collections, [])
  },

  async getCollection(id: string): Promise<CollectionSchema | null> {
    return mockAreasRequest(
      mockCollections.find((collection) => collection.id === id) ?? null,
      null,
    )
  },

  async getPreferences(collectionId: string): Promise<CollectionPreferences> {
    return mockAreasRequest(
      collectionPreferences.get(collectionId) ?? defaultPreferences,
      defaultPreferences,
    )
  },

  async savePreferences(
    collectionId: string,
    preferences: CollectionPreferences,
  ): Promise<CollectionPreferences> {
    collectionPreferences.set(collectionId, cloneMockData(preferences))
    return cloneMockData(preferences)
  },

  async createCollection(
    input: CreateCollectionInput,
  ): Promise<CollectionSchema> {
    const timestamp = new Date().toISOString()
    const collection: CollectionSchema = {
      id: `collection-${crypto.randomUUID()}`,
      areaId: input.areaId,
      name: input.name,
      description: input.description ?? '',
      fields: cloneMockData(input.fields ?? []),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    mockCollections.unshift(collection)
    const area = mockAreas.find((item) => item.id === input.areaId)
    if (area) area.collectionIds.push(collection.id)
    return cloneMockData(collection)
  },

  async updateCollection(
    collection: CollectionSchema,
  ): Promise<CollectionSchema> {
    const index = mockCollections.findIndex((item) => item.id === collection.id)
    if (index < 0) throw new Error('Collection not found')
    mockCollections[index] = {
      ...cloneMockData(collection),
      updatedAt: new Date().toISOString(),
    }
    return cloneMockData(mockCollections[index])
  },

  async listCollectionItems(collectionId: string): Promise<Item[]> {
    return mockAreasRequest(
      mockItems.filter((item) => item.collectionId === collectionId),
      [],
    )
  },

  async getItem(id: string): Promise<Item | null> {
    return mockAreasRequest(
      mockItems.find((item) => item.id === id) ?? null,
      null,
    )
  },

  async createItem(
    input: Omit<Item, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Item> {
    const timestamp = new Date().toISOString()
    const item: Item = {
      ...cloneMockData(input),
      id: `item-${crypto.randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    mockItems.unshift(item)
    const area = mockAreas.find((entry) => entry.id === item.areaId)
    if (area) area.itemCount += 1
    return cloneMockData(item)
  },

  async updateItem(
    id: string,
    patch: Partial<Pick<Item, 'title' | 'data' | 'occurredAt'>>,
  ): Promise<Item> {
    const index = mockItems.findIndex((item) => item.id === id)
    if (index < 0) throw new Error('Item not found')
    mockItems[index] = {
      ...mockItems[index],
      ...cloneMockData(patch),
      updatedAt: new Date().toISOString(),
    }
    return cloneMockData(mockItems[index])
  },

  async deleteItems(ids: string[]): Promise<void> {
    const removed = mockItems.filter((item) => ids.includes(item.id))
    for (const item of removed) {
      const area = mockAreas.find((entry) => entry.id === item.areaId)
      if (area) area.itemCount = Math.max(0, area.itemCount - 1)
    }
    const removedIds = new Set(ids)
    for (let index = mockItems.length - 1; index >= 0; index -= 1) {
      if (removedIds.has(mockItems[index].id)) mockItems.splice(index, 1)
    }
  },

  async importItems(
    collectionId: string,
    rows: Array<Record<string, ItemValue>>,
  ): Promise<Item[]> {
    const collection = mockCollections.find(
      (entry) => entry.id === collectionId,
    )
    if (!collection) throw new Error('Collection not found')
    const timestamp = new Date().toISOString()
    const imported = rows.map((data, index): Item => ({
      id: `item-${crypto.randomUUID()}-${index}`,
      areaId: collection.areaId,
      collectionId,
      title: String(
        data[collection.fields[0]?.id ?? 'title'] ??
          `Imported item ${index + 1}`,
      ),
      type: collectionId,
      data: cloneMockData(data),
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
    mockItems.unshift(...imported)
    const area = mockAreas.find((entry) => entry.id === collection.areaId)
    if (area) area.itemCount += imported.length
    return cloneMockData(imported)
  },
}
