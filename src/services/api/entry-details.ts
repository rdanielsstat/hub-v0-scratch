export interface EntryActivity {
  id: string
  text: string
  createdAt: string
  note?: boolean
}

export interface EntrySubItem {
  id: string
  title: string
  completed: boolean
  dueDate?: string
}

export interface EntryFile {
  id: string
  name: string
  type: string
  size: number
  addedAt: string
  url?: string
}

export interface EntryDetail {
  itemId: string
  activity: EntryActivity[]
  subItems: EntrySubItem[]
  files: EntryFile[]
  links: string[]
}

const detailStore = new Map<string, EntryDetail>()
const emptyDetail = (itemId: string): EntryDetail => ({
  itemId,
  activity: [],
  subItems: [],
  files: [],
  links: [],
})

function getOrCreate(itemId: string) {
  const current = detailStore.get(itemId) ?? emptyDetail(itemId)
  detailStore.set(itemId, current)
  return current
}

function record(detail: EntryDetail, text: string, note = false) {
  detail.activity.push({
    id: `activity-${crypto.randomUUID()}`,
    text,
    createdAt: new Date().toISOString(),
    note,
  })
}

export const entryDetailsApi = {
  async get(itemId: string): Promise<EntryDetail> {
    return structuredClone(getOrCreate(itemId))
  },

  async recordChange(itemId: string, text: string): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    record(detail, text)
    return structuredClone(detail)
  },

  async addNote(itemId: string, text: string): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    record(detail, text, true)
    return structuredClone(detail)
  },

  async addSubItem(
    itemId: string,
    title: string,
    subItemId?: string,
    dueDate?: string,
  ): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    detail.subItems.push({
      id: subItemId ?? `subitem-${crypto.randomUUID()}`,
      title,
      completed: false,
      dueDate,
    })
    record(detail, `Added sub-item: ${title}`)
    return structuredClone(detail)
  },

  async updateSubItem(
    itemId: string,
    subItemId: string,
    completed: boolean,
  ): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    const subItem = detail.subItems.find((item) => item.id === subItemId)
    if (subItem) {
      subItem.completed = completed
      record(detail, `${completed ? 'Completed' : 'Reopened'} sub-item: ${subItem.title}`)
    }
    return structuredClone(detail)
  },

  async addFile(
    itemId: string,
    file: Omit<EntryFile, 'id' | 'addedAt'>,
  ): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    detail.files.push({
      ...file,
      id: `file-${crypto.randomUUID()}`,
      addedAt: new Date().toISOString(),
    })
    record(detail, `Added a file: ${file.name}`)
    return structuredClone(detail)
  },

  async addLink(itemId: string, url: string): Promise<EntryDetail> {
    const detail = getOrCreate(itemId)
    if (!detail.links.includes(url)) {
      detail.links.push(url)
      record(detail, `Added a link: ${url}`)
    }
    return structuredClone(detail)
  },
}
