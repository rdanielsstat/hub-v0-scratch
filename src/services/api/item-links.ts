import type { ItemLink } from './types'
import { mockItemLinks, cloneMockData } from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

export const itemLinksApi = {
  async listItemLinks(itemId?: string): Promise<ItemLink[]> {
    const links = itemId
      ? mockItemLinks.filter(
          (link) => link.fromItemId === itemId || link.toItemId === itemId,
        )
      : mockItemLinks
    return mockAreasRequest(links)
  },

  async createItemLink(
    input: Omit<ItemLink, 'id' | 'createdAt'>,
  ): Promise<ItemLink> {
    const link: ItemLink = {
      ...cloneMockData(input),
      id: `link-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    }
    mockItemLinks.push(link)
    return cloneMockData(link)
  },

  async deleteItemLink(id: string): Promise<void> {
    const index = mockItemLinks.findIndex((link) => link.id === id)
    if (index >= 0) mockItemLinks.splice(index, 1)
  },
}
