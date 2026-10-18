import { HttpError } from './http'
import { mockAreasRequest } from './mock-areas-runtime'
import type {
  CreateProjectInput,
  Note,
  Project,
  UpdateProjectInput,
} from './types'

const now = new Date().toISOString()

let projects: Project[] = [
  {
    id: 'demo-project-garden',
    name: 'Neighborhood garden',
    pitch: 'Turn the unused lot into a shared growing space.',
    description:
      'A small community garden with raised beds, a seed library, and a monthly work day.',
    status: 'Active',
    tags: ['community', 'outdoors'],
    excitement: 5,
    effort: 3,
    potential: 4,
    nextAction: 'Ask the neighborhood association about the lot',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-reading',
    name: 'Reading tracker',
    pitch: 'A calmer way to remember what I read and what stood out.',
    description:
      'Keep a lightweight record of books, favorite passages, and recommendations.',
    status: 'Exploring',
    tags: ['learning', 'personal'],
    excitement: 4,
    effort: 2,
    potential: 3,
    nextAction: 'Sketch the simplest useful book-entry flow',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-meal-planner',
    name: 'Weeknight meal planner',
    pitch: 'Make it easier to decide what is for dinner.',
    description:
      'Collect reliable weeknight meals and build a reusable shopping list.',
    status: 'Inbox',
    tags: ['food', 'home'],
    excitement: 3,
    effort: 2,
    potential: 4,
    nextAction: 'List five meals we already cook often',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-photo-walks',
    name: 'Neighborhood photo walks',
    pitch: 'Notice familiar streets with fresh eyes.',
    description:
      'A small collection of self-guided photo walks, each with a route and a few prompts.',
    status: 'Active',
    tags: ['creative', 'outdoors'],
    excitement: 5,
    effort: 2,
    potential: 4,
    nextAction: 'Map the old railway path',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-studio',
    name: 'Home studio refresh',
    pitch: 'Make a better place for focused creative work.',
    description:
      'Rework lighting, storage, and the desk layout without adding much furniture.',
    status: 'Parked',
    tags: ['home', 'creative'],
    excitement: 4,
    effort: 3,
    potential: 3,
    nextAction: 'Measure the wall beside the window',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-family-recipes',
    name: 'Family recipe book',
    pitch: 'Keep the recipes that tell our family story.',
    description:
      'Gather handwritten recipes, kitchen notes, and the stories behind them.',
    status: 'Exploring',
    tags: ['family', 'food'],
    excitement: 5,
    effort: 4,
    potential: 5,
    nextAction: 'Scan the recipe cards from aunt May',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-bike-tuneup',
    name: 'Bike tune-up guide',
    pitch: 'A friendly checklist for the little fixes I can do myself.',
    description:
      'Document the tools, steps, and seasonal maintenance for the commuter bike.',
    status: 'Inbox',
    tags: ['learning', 'outdoors'],
    excitement: 3,
    effort: 2,
    potential: 3,
    nextAction: 'List the basic tools already on hand',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-language',
    name: 'Everyday Spanish',
    pitch: 'Build a low-pressure daily language habit.',
    description:
      'Collect useful phrases and short listening practice for ordinary days.',
    status: 'Active',
    tags: ['learning', 'personal'],
    excitement: 4,
    effort: 2,
    potential: 4,
    nextAction: 'Save three short listening exercises',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-giving',
    name: 'Thoughtful giving list',
    pitch: 'Remember people and ideas for future gifts.',
    description:
      'A private list of interests, meaningful dates, and small gift ideas.',
    status: 'Parked',
    tags: ['family', 'personal'],
    excitement: 3,
    effort: 1,
    potential: 3,
    nextAction: 'Add the birthdays already in the calendar',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-archive',
    name: 'Digital family archive',
    pitch: 'Make old photographs easier to find and share.',
    description:
      'Organize scans with names, dates, and short notes while preserving the originals.',
    status: 'Graduated',
    tags: ['family', 'history'],
    excitement: 5,
    effort: 4,
    potential: 5,
    nextAction: 'Review the archive plan',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-wildflowers',
    name: 'Native balcony garden',
    pitch: 'Bring more pollinators to the balcony.',
    description:
      'Test a few native plants in containers and note what does well through the seasons.',
    status: 'Killed',
    tags: ['community', 'home'],
    excitement: 2,
    effort: 2,
    potential: 2,
    nextAction: 'Keep the plant notes for later',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-project-weekend-map',
    name: 'Slow weekend map',
    pitch: 'Keep a list of nearby places worth a longer visit.',
    description:
      'A shortlist of parks, small museums, bookstores, and quiet lunch spots.',
    status: 'Exploring',
    tags: ['outdoors', 'personal'],
    excitement: 4,
    effort: 1,
    potential: 3,
    nextAction: 'Add the lakeside path and old market',
    targetDate: null,
    links: [],
    createdAt: now,
    updatedAt: now,
  },
]

let notes: Note[] = [
  {
    id: 'demo-note-garden',
    projectId: 'demo-project-garden',
    body: 'The library has a seed swap table every spring.',
    createdAt: now,
  },
  {
    id: 'demo-note-garden-2',
    projectId: 'demo-project-garden',
    body: 'The lot gets morning sun and has a working water tap.',
    createdAt: now,
  },
  {
    id: 'demo-note-reading',
    projectId: 'demo-project-reading',
    body: 'Keep the first version quick enough to use after finishing a book.',
    createdAt: now,
  },
  {
    id: 'demo-note-reading-2',
    projectId: 'demo-project-reading',
    body: 'A favorite passage field could be more useful than a rating.',
    createdAt: now,
  },
  {
    id: 'demo-note-meal',
    projectId: 'demo-project-meal-planner',
    body: 'Start with meals already in the weekly rotation.',
    createdAt: now,
  },
  {
    id: 'demo-note-photo',
    projectId: 'demo-project-photo-walks',
    body: 'Try a route that follows the old railway line.',
    createdAt: now,
  },
  {
    id: 'demo-note-studio',
    projectId: 'demo-project-studio',
    body: 'The desk feels best near the window, with the shelves on the short wall.',
    createdAt: now,
  },
  {
    id: 'demo-note-recipes',
    projectId: 'demo-project-family-recipes',
    body: 'Aunt May remembers the handwritten pie crust notes.',
    createdAt: now,
  },
  {
    id: 'demo-note-bike',
    projectId: 'demo-project-bike-tuneup',
    body: 'The rear brake needs attention before the next rainy week.',
    createdAt: now,
  },
  {
    id: 'demo-note-language',
    projectId: 'demo-project-language',
    body: 'Short sessions are easier to keep than weekend catch-up.',
    createdAt: now,
  },
  {
    id: 'demo-note-giving',
    projectId: 'demo-project-giving',
    body: 'A list of favorite shops might be enough for the first pass.',
    createdAt: now,
  },
  {
    id: 'demo-note-archive',
    projectId: 'demo-project-archive',
    body: 'The scanned family photos are now sorted by decade.',
    createdAt: now,
  },
  {
    id: 'demo-note-wildflowers',
    projectId: 'demo-project-wildflowers',
    body: 'The balcony does not get enough direct sun for the original plan.',
    createdAt: now,
  },
  {
    id: 'demo-note-weekend',
    projectId: 'demo-project-weekend-map',
    body: 'Keep each recommendation close enough for a spontaneous afternoon.',
    createdAt: now,
  },
]

const copy = <T>(value: T): T => structuredClone(value)
const updatedAt = () => new Date().toISOString()
const missingProject = () => new HttpError(404, 'Project not found')

export const mockProjectsApi = {
  async listProjects(): Promise<Project[]> {
    return mockAreasRequest(copy(projects), [])
  },

  async getProject(id: string): Promise<Project | null> {
    const project = projects.find((item) => item.id === id)
    return project ? copy(project) : null
  },

  async createProject(input: CreateProjectInput): Promise<Project> {
    const timestamp = updatedAt()
    const project: Project = {
      id: `demo-project-${crypto.randomUUID()}`,
      name: input.name,
      pitch: input.pitch ?? '',
      description: input.description ?? '',
      status: input.status ?? 'Inbox',
      tags: copy(input.tags ?? []),
      excitement: input.excitement ?? 3,
      effort: input.effort ?? 3,
      potential: input.potential ?? 3,
      nextAction: input.nextAction ?? '',
      targetDate: input.targetDate ?? null,
      links: copy(input.links ?? []),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    projects = [project, ...projects]
    return copy(project)
  },

  async updateProject(id: string, patch: UpdateProjectInput): Promise<Project> {
    const index = projects.findIndex((project) => project.id === id)
    if (index === -1) throw missingProject()

    const updated = {
      ...projects[index],
      ...copy(patch),
      updatedAt: updatedAt(),
    }
    projects = projects.map((project, itemIndex) =>
      itemIndex === index ? updated : project,
    )
    return copy(updated)
  },

  async deleteProject(id: string): Promise<void> {
    if (!projects.some((project) => project.id === id)) throw missingProject()
    projects = projects.filter((project) => project.id !== id)
    notes = notes.filter((note) => note.projectId !== id)
  },
}

export const mockNotesApi = {
  async listNotes(projectId: string): Promise<Note[]> {
    if (!projects.some((project) => project.id === projectId)) {
      throw missingProject()
    }
    return copy(notes.filter((note) => note.projectId === projectId))
  },

  async addNote(
    projectId: string,
    body: string,
  ): Promise<{ note: Note; project: Project }> {
    const project = projects.find((item) => item.id === projectId)
    if (!project) throw missingProject()

    const note: Note = {
      id: `demo-note-${crypto.randomUUID()}`,
      projectId,
      body,
      createdAt: updatedAt(),
    }
    notes = [note, ...notes]
    const updatedProject = { ...project, updatedAt: updatedAt() }
    projects = projects.map((item) =>
      item.id === projectId ? updatedProject : item,
    )
    return { note: copy(note), project: copy(updatedProject) }
  },

  async deleteNote(id: string): Promise<Project> {
    const note = notes.find((item) => item.id === id)
    if (!note) throw new HttpError(404, 'Note not found')

    notes = notes.filter((item) => item.id !== id)
    const project = projects.find((item) => item.id === note.projectId)
    if (!project) throw missingProject()

    const updatedProject = { ...project, updatedAt: updatedAt() }
    projects = projects.map((item) =>
      item.id === project.id ? updatedProject : item,
    )
    return copy(updatedProject)
  },
}
