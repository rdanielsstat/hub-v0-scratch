import type {
  Area,
  Block,
  CreateAreaInput,
  FieldDef,
  ViewDisplay,
} from './types'
import {
  mockAreas,
  mockBlocks,
  mockCollections,
  cloneMockData,
} from './mock-areas-data'
import { areaLayoutApi } from './area-layout'
import {
  getMockAreasScenario,
  mockAreasRequest,
  setMockAreasScenario,
} from './mock-areas-runtime'

export { setMockAreasScenario, getMockAreasScenario }

const templateCollections: Partial<
  Record<
    CreateAreaInput['startFrom'],
    {
      name: string
      fields: Array<[string, string, FieldDef['type']]>
      display: ViewDisplay
    }
  >
> = {
  dashboard: {
    name: 'Entries',
    fields: [
      ['name', 'Name', 'text'],
      ['date', 'Date', 'date'],
      ['value', 'Value', 'number'],
    ],
    display: 'table',
  },
  collection: {
    name: 'Collection',
    fields: [
      ['name', 'Name', 'text'],
      ['date', 'Date', 'date'],
    ],
    display: 'table',
  },
  journal: {
    name: 'Journal entries',
    fields: [
      ['date', 'Date', 'date'],
      ['reflection', 'Reflection', 'longText'],
    ],
    display: 'list',
  },
  tracker: {
    name: 'Tracker',
    fields: [
      ['date', 'Date', 'date'],
      ['value', 'Value', 'number'],
    ],
    display: 'line',
  },
  wiki: {
    name: 'Notes',
    fields: [
      ['topic', 'Topic', 'text'],
      ['content', 'Content', 'longText'],
    ],
    display: 'cards',
  },
  board: {
    name: 'Tasks',
    fields: [
      ['name', 'Name', 'text'],
      ['status', 'Status', 'choice'],
    ],
    display: 'board',
  },
  calendar: {
    name: 'Events',
    fields: [
      ['date', 'Date', 'date'],
      ['description', 'Description', 'longText'],
    ],
    display: 'calendar',
  },
}

export const areasApi = {
  async listAreas(): Promise<Area[]> {
    return mockAreasRequest(mockAreas, [])
  },
  async getArea(id: string): Promise<Area | null> {
    return mockAreasRequest(
      mockAreas.find((area) => area.id === id) ?? null,
      null,
    )
  },
  async createArea(input: CreateAreaInput): Promise<Area> {
    const timestamp = new Date().toISOString()
    const id = `area-${crypto.randomUUID()}`
    const area: Area = {
      id,
      name: input.name,
      description: input.description ?? '',
      collectionIds: [],
      blockIds: [],
      pageIds: [],
      itemCount: 0,
      glance: 'A new space ready to shape',
      lastActiveAt: timestamp,
      icon: '',
      coverTone: 'lavender',
      accent: 'primary',
      order: mockAreas.length,
    }
    mockAreas.unshift(area)
    const page = await areaLayoutApi.createPage(id, 'Overview')
    const section = await areaLayoutApi.createSection(id, page.id)
    const template = templateCollections[input.startFrom]
    if (template) {
      const collectionId = `collection-${crypto.randomUUID()}`
      const fields: FieldDef[] = template.fields.map(
        ([fieldId, name, type], order) => ({ id: fieldId, name, type, order }),
      )
      if (input.startFrom === 'board')
        fields[1].options = ['To do', 'In progress', 'Done']
      mockCollections.unshift({
        id: collectionId,
        areaId: id,
        name: template.name,
        description: '',
        fields,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      area.collectionIds.push(collectionId)
      const view: Block = {
        id: `block-${crypto.randomUUID()}`,
        areaId: id,
        sectionId: section.id,
        type: 'view',
        title: template.name,
        order: 0,
        size: 'wide',
        view: {
          id: `view-${crypto.randomUUID()}`,
          title: template.name,
          collectionId,
          display: template.display,
          filter: [],
          groupBy:
            input.startFrom === 'board'
              ? 'status'
              : input.startFrom === 'tracker'
                ? 'month'
                : undefined,
          aggregate:
            input.startFrom === 'tracker'
              ? { operation: 'average', fieldId: 'value' }
              : undefined,
          period: input.startFrom === 'tracker' ? '12Months' : undefined,
        },
      }
      mockBlocks.push(view)
      area.blockIds.push(view.id)
      section.layout =
        input.startFrom === 'dashboard' || input.startFrom === 'board'
          ? 'grid'
          : 'stack'
      section.columns = 2
      await areaLayoutApi.updateSection(section)
      area.glance = 'A collection and view are ready for your first entry'
    } else if (input.startFrom === 'routine') {
      const checklist: Block = {
        id: `block-${crypto.randomUUID()}`,
        areaId: id,
        sectionId: section.id,
        type: 'checklist',
        title: 'Routine',
        order: 0,
        items: [{ text: 'Add your first step', checked: false }],
      }
      mockBlocks.push(checklist)
      area.blockIds.push(checklist.id)
      area.glance = 'A routine checklist is ready to edit'
    } else if (input.startFrom === 'journal') {
      area.glance = 'A journal collection is ready for reflections'
    } else if (input.startFrom === 'wiki') {
      area.glance = 'A notes collection is ready for references'
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
