import { afterEach, describe, expect, it } from 'vitest'
import { areasApi, collectionsApi, setMockAreasScenario } from './index'

afterEach(() => {
  setMockAreasScenario('normal')
})

describe('Areas mock APIs', () => {
  it('provides sample areas and a two-thousand row purchases collection', async () => {
    const areas = await areasApi.listAreas()
    expect(areas.map((area) => area.id)).toContain('home-budget')
    expect(await collectionsApi.listCollectionItems('purchases')).toHaveLength(
      2000,
    )
    expect(await collectionsApi.listCollectionItems('inventory')).toHaveLength(
      4,
    )
  })

  it('can simulate empty and error responses for preview states', async () => {
    setMockAreasScenario('empty')
    await expect(areasApi.listAreas()).resolves.toEqual([])

    setMockAreasScenario('error')
    await expect(areasApi.listAreas()).rejects.toThrow(
      'Areas preview could not load',
    )
  })
})
