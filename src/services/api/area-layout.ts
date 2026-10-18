import type {
  Area,
  AreaGroup,
  AreaPageSettings,
  AreaPageSpec,
  AreaSection,
  AreasListPreferences,
} from './types'
import { mockAreas, mockBlocks, cloneMockData } from './mock-areas-data'
import { mockAreasRequest } from './mock-areas-runtime'

const defaultPageSettings: AreaPageSettings = {
  layout: 'twoColumns',
  width: 'comfortable',
  density: 'comfortable',
  blockStyle: 'cards',
  showBlockTitles: true,
}

const sections: AreaSection[] = [
  {
    id: 'section-inventory',
    areaId: 'personal-inventory',
    pageId: 'page-inventory',
    order: 0,
    layout: 'grid',
    columns: 2,
    blockIds: [
      'inventory-value',
      'inventory-count',
      'inventory-warranties',
      'inventory-location',
      'inventory-recent',
    ],
  },
  {
    id: 'section-budget',
    areaId: 'home-budget',
    pageId: 'page-budget',
    order: 0,
    layout: 'grid',
    columns: 3,
    blockIds: [
      'budget-spent',
      'budget-income',
      'budget-taxes',
      'budget-spending',
      'budget-purchases',
      'budget-investments',
    ],
  },
  {
    id: 'section-health',
    areaId: 'health-fitness',
    pageId: 'page-health',
    order: 0,
    layout: 'grid',
    columns: 2,
    blockIds: [],
  },
  {
    id: 'section-outdoors',
    areaId: 'outdoors',
    pageId: 'page-outdoors',
    order: 0,
    layout: 'stack',
    columns: 1,
    blockIds: [],
  },
  {
    id: 'section-spirituality',
    areaId: 'spirituality-code',
    pageId: 'page-spirituality',
    order: 0,
    layout: 'stack',
    columns: 1,
    blockIds: ['creed', 'concepts-list'],
  },
]

const pages: AreaPageSpec[] = [
  {
    id: 'page-inventory',
    name: 'Overview',
    order: 0,
    sectionIds: ['section-inventory'],
    settings: { ...defaultPageSettings, layout: 'twoColumns' },
    hiddenBlockIds: [],
  },
  {
    id: 'page-budget',
    name: 'Overview',
    order: 0,
    sectionIds: ['section-budget'],
    settings: { ...defaultPageSettings, layout: 'threeColumns' },
    hiddenBlockIds: [],
  },
  {
    id: 'page-health',
    name: 'Overview',
    order: 0,
    sectionIds: ['section-health'],
    settings: { ...defaultPageSettings, layout: 'twoColumns' },
    hiddenBlockIds: [],
  },
  {
    id: 'page-outdoors',
    name: 'Overview',
    order: 0,
    sectionIds: ['section-outdoors'],
    settings: { ...defaultPageSettings, layout: 'oneColumn' },
    hiddenBlockIds: [],
  },
  {
    id: 'page-spirituality',
    name: 'Overview',
    order: 0,
    sectionIds: ['section-spirituality'],
    settings: { ...defaultPageSettings, layout: 'oneColumn' },
    hiddenBlockIds: [],
  },
]

let groups: AreaGroup[] = []
let areasPreferences: AreasListPreferences = {
  density: 'comfortable',
  sort: 'manual',
  groupBy: 'none',
  details: {
    description: true,
    collectionCount: true,
    itemCount: true,
    lastActive: true,
  },
}
const updateArea = (id: string, patch: Partial<Area>) => {
  const index = mockAreas.findIndex((area) => area.id === id)
  if (index < 0) throw new Error('Area not found')
  mockAreas[index] = { ...mockAreas[index], ...cloneMockData(patch) }
  return cloneMockData(mockAreas[index])
}

export const areaLayoutApi = {
  async listPages(areaId: string) {
    return mockAreasRequest(
      pages
        .filter((page) =>
          mockAreas
            .find((area) => area.id === areaId)
            ?.pageIds.includes(page.id),
        )
        .sort((a, b) => a.order - b.order),
      [],
    )
  },
  async createPage(areaId: string, name: string) {
    const area = mockAreas.find((item) => item.id === areaId)
    if (!area) throw new Error('Area not found')
    const page: AreaPageSpec = {
      id: `page-${crypto.randomUUID()}`,
      name,
      order: area.pageIds.length,
      sectionIds: [],
      settings: { ...cloneMockData(defaultPageSettings), layout: 'oneColumn' },
      hiddenBlockIds: [],
    }
    pages.push(page)
    area.pageIds.push(page.id)
    return cloneMockData(page)
  },
  async updatePage(page: AreaPageSpec) {
    const index = pages.findIndex((item) => item.id === page.id)
    if (index < 0) throw new Error('Page not found')
    pages[index] = cloneMockData(page)
    return cloneMockData(page)
  },
  async removePage(areaId: string, pageId: string) {
    const area = mockAreas.find((item) => item.id === areaId)
    if (!area || area.pageIds.length <= 1)
      throw new Error('An area needs one page')
    area.pageIds = area.pageIds.filter((id) => id !== pageId)
    const sectionIds = sections
      .filter((section) => section.pageId === pageId)
      .map((section) => section.id)
    for (let index = sections.length - 1; index >= 0; index -= 1)
      if (sectionIds.includes(sections[index].id)) sections.splice(index, 1)
    for (let index = pages.length - 1; index >= 0; index -= 1)
      if (pages[index].id === pageId) pages.splice(index, 1)
  },
  async reorderPages(areaId: string, ids: string[]) {
    const area = mockAreas.find((item) => item.id === areaId)
    if (!area) return
    area.pageIds = ids.filter((id) => pages.some((page) => page.id === id))
    area.pageIds.forEach((id, order) => {
      const page = pages.find((item) => item.id === id)
      if (page) page.order = order
    })
  },
  async listSections(pageId: string) {
    return mockAreasRequest(
      sections
        .filter((section) => section.pageId === pageId)
        .sort((a, b) => a.order - b.order),
      [],
    )
  },
  async createSection(areaId: string, pageId: string) {
    const section: AreaSection = {
      id: `section-${crypto.randomUUID()}`,
      areaId,
      pageId,
      order: sections.filter((item) => item.pageId === pageId).length,
      layout: 'stack',
      columns: 1,
      blockIds: [],
    }
    sections.push(section)
    const page = pages.find((item) => item.id === pageId)
    if (page) page.sectionIds.push(section.id)
    return cloneMockData(section)
  },
  async updateSection(section: AreaSection) {
    const index = sections.findIndex((item) => item.id === section.id)
    if (index < 0) throw new Error('Section not found')
    sections[index] = cloneMockData(section)
    return cloneMockData(section)
  },
  async reorderSections(pageId: string, ids: string[]) {
    ids.forEach((id, order) => {
      const section = sections.find(
        (item) => item.id === id && item.pageId === pageId,
      )
      if (section) section.order = order
    })
  },
  async removeSection(sectionId: string) {
    const index = sections.findIndex((item) => item.id === sectionId)
    if (index < 0) return
    const [section] = sections.splice(index, 1)
    const page = pages.find((item) => item.id === section.pageId)
    if (page) page.sectionIds = page.sectionIds.filter((id) => id !== sectionId)
    for (let index = mockBlocks.length - 1; index >= 0; index -= 1)
      if (mockBlocks[index].sectionId === sectionId) mockBlocks.splice(index, 1)
  },
  async updateArea(id: string, patch: Partial<Area>) {
    return updateArea(id, patch)
  },
  async reorderAreas(ids: string[]) {
    ids.forEach((id, order) => updateArea(id, { order }))
  },
  async getAreasPreferences() {
    return mockAreasRequest(areasPreferences)
  },
  async saveAreasPreferences(preferences: AreasListPreferences) {
    areasPreferences = cloneMockData(preferences)
    return cloneMockData(areasPreferences)
  },
  async listGroups() {
    return mockAreasRequest([...groups].sort((a, b) => a.order - b.order))
  },
  async createGroup(name: string) {
    const group = {
      id: `group-${crypto.randomUUID()}`,
      name,
      order: groups.length,
    }
    groups.push(group)
    return cloneMockData(group)
  },
  async updateGroup(group: AreaGroup) {
    groups = groups.map((item) =>
      item.id === group.id ? cloneMockData(group) : item,
    )
    return cloneMockData(group)
  },
  async reorderGroups(ids: string[]) {
    groups = ids.flatMap((id, order) => {
      const group = groups.find((item) => item.id === id)
      return group ? [{ ...group, order }] : []
    })
  },
  async removeGroup(id: string) {
    groups = groups.filter((group) => group.id !== id)
    mockAreas.forEach((area) => {
      if (area.groupId === id) area.groupId = null
    })
  },
}
