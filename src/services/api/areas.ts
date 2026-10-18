import type { Area, CreateAreaInput } from './types'
import {
  mockAreas,
  mockBlocks,
  mockCollections,
  cloneMockData,
} from './mock-areas-data'
import {
  getMockAreasScenario,
  mockAreasRequest,
  setMockAreasScenario,
} from './mock-areas-runtime'

export { setMockAreasScenario, getMockAreasScenario }

export const areasApi = {
  async listAreas(): Promise<Area[]> {
    return mockAreasRequest(mockAreas, [])
  },

  async getArea(id: string): Promise<Area | null> {
    return mockAreasRequest(mockAreas.find((area) => area.id === id) ?? null)
  },

  async createArea(input: CreateAreaInput): Promise<Area> {
    const timestamp = new Date().toISOString()
    const id = `area-${crypto.randomUUID()}`
    const area: Area = {
      id,
      name: input.name,
      description: input.description ?? '',
      layout: input.startFrom === 'journal' ? 'stack' : 'grid',
      collectionIds: [],
      blockIds: [],
      itemCount: 0,
      glance:
        input.startFrom === 'blank'
          ? 'A new space, ready when you are'
          : 'Your new space is ready to shape',
      lastActiveAt: timestamp,
      icon: input.startFrom === 'journal' ? 'book' : 'sparkles',
      coverTone: 'lavender',
    }
    mockAreas.unshift(area)
    if (input.startFrom === 'collection') {
      const collectionId = `collection-${crypto.randomUUID()}`
      mockCollections.unshift({
        id: collectionId,
        areaId: id,
        name: 'Untitled collection',
        description: '',
        fields: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      area.collectionIds.push(collectionId)
    }
    if (input.startFrom === 'dashboard') {
      const blockId = `block-${crypto.randomUUID()}`
      mockBlocks.push({
        id: blockId,
        areaId: id,
        type: 'text',
        title: 'Start here',
        order: 0,
        body: 'A little space to begin.',
      })
      area.blockIds.push(blockId)
    }
    return cloneMockData(area)
  },

  async removeArea(id: string): Promise<void> {
    const index = mockAreas.findIndex((area) => area.id === id)
    if (index !== -1) mockAreas.splice(index, 1)
  },

  async health(): Promise<{ scenario: string }> {
    return mockAreasRequest({ scenario: getMockAreasScenario() })
  },
}
