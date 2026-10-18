import { USE_MOCK_API } from '@/lib/config'
import { authApi as realAuthApi } from './auth'
import { mockAuthApi } from './mock-auth'
import { mockNotesApi, mockProjectsApi } from './mock'
import { realNotesApi, realProjectsApi } from './real'

/** Every component/store uses this API boundary and never calls fetch directly. */
export interface ApiClient {
  listProjects: typeof realProjectsApi.listProjects
  getProject: typeof realProjectsApi.getProject
  createProject: typeof realProjectsApi.createProject
  updateProject: typeof realProjectsApi.updateProject
  deleteProject: typeof realProjectsApi.deleteProject
  listNotes: typeof realNotesApi.listNotes
  addNote: typeof realNotesApi.addNote
  deleteNote: typeof realNotesApi.deleteNote
}

export const api: ApiClient = USE_MOCK_API
  ? { ...mockProjectsApi, ...mockNotesApi }
  : { ...realProjectsApi, ...realNotesApi }

export const authApi = USE_MOCK_API ? mockAuthApi : realAuthApi
export { HttpError } from './http'
export * from './types'
export { areasApi, getMockAreasScenario, setMockAreasScenario } from './areas'
export { collectionsApi } from './collections'
export { entriesApi } from './entries'
export { entryDetailsApi } from './entry-details'
export type {
  EntryActivity,
  EntryDetail,
  EntryFile,
  EntrySubItem,
} from './entry-details'
export { blocksApi } from './blocks'
export { itemLinksApi } from './item-links'
export { savedFiltersApi } from './saved-filters'
export { areaLayoutApi } from './area-layout'
export type {
  ProjectFilterState,
  ProjectSortKey,
  SavedProjectFilter,
} from './saved-filters'
export { dataSourcesApi } from './data-sources'
