import type { DataSource } from './types'
import { mockDataSources, cloneMockData } from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

export const dataSourcesApi = {
  async listDataSources(collectionId?: string): Promise<DataSource[]> {
    const sources = collectionId
      ? mockDataSources.filter((source) => source.collectionId === collectionId)
      : mockDataSources
    return mockAreasRequest(sources)
  },

  async addDataSource(input: Omit<DataSource, 'id'>): Promise<DataSource> {
    const source: DataSource = {
      ...cloneMockData(input),
      id: `source-${crypto.randomUUID()}`,
    }
    mockDataSources.unshift(source)
    return cloneMockData(source)
  },

  async syncDataSource(id: string): Promise<DataSource> {
    const source = mockDataSources.find((item) => item.id === id)
    if (!source) throw new Error('Data source not found')
    source.status = 'connected'
    source.lastSyncedAt = new Date().toISOString()
    source.nextSyncAt = new Date(Date.now() + 86400000).toISOString()
    source.errorMessage = undefined
    return cloneMockData(source)
  },

  async removeDataSource(id: string): Promise<void> {
    const index = mockDataSources.findIndex((source) => source.id === id)
    if (index >= 0) mockDataSources.splice(index, 1)
  },
}
