import type { Block } from './types'
import { mockAreas, mockBlocks, cloneMockData } from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

export const blocksApi = {
  async listBlocks(areaId: string): Promise<Block[]> {
    return mockAreasRequest(
      mockBlocks
        .filter((block) => block.areaId === areaId)
        .sort((a, b) => a.order - b.order),
      [],
    )
  },

  async saveBlock(block: Block): Promise<Block> {
    const index = mockBlocks.findIndex((item) => item.id === block.id)
    if (index === -1) mockBlocks.push(cloneMockData(block))
    else mockBlocks[index] = cloneMockData(block)
    const area = mockAreas.find((item) => item.id === block.areaId)
    if (area && !area.blockIds.includes(block.id)) area.blockIds.push(block.id)
    return cloneMockData(block)
  },

  async saveBlockOrder(areaId: string, orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, order) => {
      const block = mockBlocks.find(
        (item) => item.id === id && item.areaId === areaId,
      )
      if (block) block.order = order
    })
  },

  async removeBlock(id: string): Promise<void> {
    const index = mockBlocks.findIndex((block) => block.id === id)
    if (index >= 0) mockBlocks.splice(index, 1)
  },
}
